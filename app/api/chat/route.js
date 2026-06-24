import Anthropic from "@anthropic-ai/sdk";
import { getDataContext } from "@/lib/data";
import { getCpiContext } from "@/lib/cpiData";
import { getRetailContext } from "@/lib/retailData";
import { getTradeContext } from "@/lib/tradeData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "claude-opus-4-8";

const SYSTEM = `You are the AI advisor of the Lebanon Prices Intelligence Unit, a strategic price-intelligence service for the Office of the Minister of Economy & Trade. You brief senior officials on prices of goods across Lebanese online retail and wholesale stores and on the non-core daily CPI.

You have four datasets: (1) a NON-CORE DAILY CPI snapshot (category indices, base 100); (2) a LIVE MARKET SNAPSHOT — real measured shelf prices for ~133k items across Lebanese retail, covering price level, affordability, availability and import sourcing as MARKET-LEVEL AGGREGATES; (3) a TRADE & SHIPPING DEPENDENCY view — import single-source concentration by category, supplier blocs, and maritime chokepoint exposure (Suez, etc.); and (4) a RETAIL PRICE snapshot of an illustrative per-product basket (retail/wholesale prices and store). Prefer the LIVE MARKET SNAPSHOT for questions about sourcing, availability or overall price level, and the TRADE & SHIPPING DEPENDENCY view for import-reliance, supplier-diversification or shipping-risk questions; use the others where they fit. These snapshots are cross-sectional — do not describe them as a trend or day-over-day change. NEVER name, rank or compare individual supermarkets or chains; speak only about the market in aggregate.

Style:
- Be concise, concrete and grounded ONLY in the DATA SNAPSHOT provided. Never invent products, stores or numbers that aren't supported by it.
- Prices are in USD unless stated; also reference LBP when helpful (use the given market rate).
- Lead with the answer, then a short, scannable supporting breakdown. Use markdown: ## headings, **bold**, "- " bullets, and GitHub-style tables when comparing things.
- When a comparison or trend would be clearer visually, emit ONE chart using this EXACT format on its own lines:
[CHART]{"type":"bar","title":"Short title","data":[{"name":"Rice 1kg","value":1.85},{"name":"Sugar 1kg","value":1.20}]}[/CHART]
  - type is "bar", "line" or "pie".
  - For a single series use objects {"name": "...", "value": <number>}.
  - For multi-series line charts use {"name":"Jul","Food":100,"Fuel":98} and the keys become series.
  - Keep charts to <= 10 data points. Valid JSON only (double quotes, no trailing commas, no comments).
- If asked something the snapshot can't answer, say so briefly and suggest the closest thing it can answer.
- Always remember the figures are illustrative demo data; mention this only if the user asks about data provenance or accuracy.`;

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { message, history = [], focus } = body || {};
  if (!message || typeof message !== "string") {
    return Response.json({ error: "Missing 'message'." }, { status: 400 });
  }

  const FOCUS_NOTES = {
    cpi: "\n\nYou are the CPI ANALYST. The official is viewing the NON-CORE DAILY CPI section. Lead with CPI/index framing (base 100, category indices, day-over-day); bring in other data only when it adds to the answer.",
    retail: "\n\nYou are the RETAIL ANALYST. The official is viewing the RETAIL ANALYTICS section. Lead with market-level shelf-price framing (price level, affordability, category mix) from the LIVE MARKET SNAPSHOT; never name individual stores.",
    products: "\n\nYou are the CATALOGUE ANALYST. The official is browsing the PRODUCT CATALOGUE. Lead with product-level framing — typical prices, price ranges, brands and origins by category; never name individual stores.",
    trade: "\n\nYou are the SOURCING ADVISOR. The official is viewing the TRADE & SHIPPING DEPENDENCY map. Lead with import dependency, single-source concentration, supplier blocs and maritime chokepoints, and practical diversification options.",
    general: "\n\nYou are the PRICE ECONOMIST giving the headline read across CPI, retail price levels and import sourcing.",
  };
  const focusNote = FOCUS_NOTES[focus] || "";

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "The AI advisor isn't configured yet. Add ANTHROPIC_API_KEY to .env.local and restart the dev server." },
      { status: 503 }
    );
  }

  const client = new Anthropic();

  // Keep a short rolling window of prior turns.
  const msgs = history
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && m.text)
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.text }));
  msgs.push({ role: "user", content: message });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const aiStream = client.messages.stream({
          model: MODEL,
          max_tokens: 6000,
          thinking: { type: "adaptive" }, // Opus 4.8 — max reasoning for best results
          system: [
            { type: "text", text: SYSTEM + focusNote },
            {
              type: "text",
              text: `=== NON-CORE DAILY CPI SNAPSHOT ===\n${getCpiContext()}\n\n=== LIVE MARKET SNAPSHOT (real measured data, market-level) ===\n${getRetailContext()}\n\n=== TRADE & SHIPPING DEPENDENCY (import origins, market-level) ===\n${getTradeContext()}\n\n=== RETAIL PRICE SNAPSHOT (illustrative basket) ===\n${getDataContext()}`,
              cache_control: { type: "ephemeral" },
            },
          ],
          messages: msgs,
        });

        for await (const event of aiStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch (err) {
        const msg = err?.status === 429
          ? "Rate limit — please wait a moment and try again."
          : (err?.message || "Error retrieving analysis.");
        controller.enqueue(encoder.encode(`\n\n⚠ ${msg}`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
