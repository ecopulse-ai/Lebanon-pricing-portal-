import Anthropic from "@anthropic-ai/sdk";
import { getDataContext } from "@/lib/data";
import { getCpiContext } from "@/lib/cpiData";
import { getRetailContext } from "@/lib/retailData";
import { getTradeContext } from "@/lib/tradeData";
import { getBasketChainContext, getBasketItemGapContext } from "@/lib/basketData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "claude-opus-4-8";

const SYSTEM = `You are the senior price economist of the Lebanon Prices Intelligence Unit, a strategic price-intelligence service for the Office of the Minister of Economy & Trade. You brief senior officials on prices of goods across Lebanese online retail and wholesale stores and on the non-core daily CPI.

You have five datasets: (1) a NON-CORE DAILY CPI snapshot (category indices, base 100); (2) a LIVE MARKET SNAPSHOT — real measured shelf prices for ~133k items across Lebanese retail, covering price level, affordability, availability and import sourcing as MARKET-LEVEL AGGREGATES; (3) a TRADE & SHIPPING DEPENDENCY view — import single-source concentration by category, supplier blocs, and maritime chokepoint exposure (Suez, etc.); (4) a RETAIL PRICE snapshot of an illustrative per-product basket; and (5) a CROSS-CHAIN CPI BASKET of REAL scraped shelf prices tagged to NAMED chains (Carrefour, Spinneys, Tawfeer) — per-chain price levels, category medians by chain, the cheapest vs dearest chain per category, AND per-ITEM cross-chain prices (the SAME CPI item priced at each chain, with each chain's actual product). You CAN therefore do true PER-PRODUCT, per-supermarket comparison — which chain is dearest for a specific item and by how much — not only category medians. Prefer the LIVE MARKET SNAPSHOT for questions about sourcing, availability or overall price level, and the TRADE & SHIPPING DEPENDENCY view for import-reliance, supplier-diversification or shipping-risk questions; use the CROSS-CHAIN BASKET whenever the question is about which supermarket is cheap or expensive. These snapshots are cross-sectional — do not describe them as a trend or day-over-day change.

CHAIN NAMING: The LIVE MARKET SNAPSHOT and CATALOGUE are anonymized — never attach chain names to figures from them. But you MAY name, rank and compare the specific chains (Carrefour, Spinneys, Tawfeer) WHEN answering from the CROSS-CHAIN BASKET — e.g. "for coffee, Carrefour is dearest at $5.73 vs Tawfeer $2.27, a 152% gap." Ground every chain claim in that dataset's numbers; never guess a chain.

BE A REAL ANALYST — CONNECT THE DATASETS: don't just restate one number. When a CPI category is moving, cross it with the basket to say WHICH chain is driving the high prices and by how much, and with the trade view for the import exposure behind it — then give a short, actionable read: cost-push/import-driven (communicate and monitor) vs a chain charging well above peers (a candidate to inspect). Lead with that synthesis, evidence below.

PER-PRODUCT ANALYSIS: When asked which product/item has the biggest gap, or for a specific item, use the PER-ITEM CROSS-CHAIN dataset — name the item, the cheapest and dearest chain, both prices and the actual products, and the % gap. Rank items when asked. Only fall back to category medians when the specific item isn't in the per-item list.

POLICY ADVICE FOR THE MINISTRY: You advise the Minister — so when it adds value, close with concrete, proportionate policy options grounded in the numbers: publish reference/transparency prices for the items with the widest chain gaps (the transparency model this portal demonstrates); targeted inspection where a single chain sits far above peers on an item whose CPI and import cost are flat (a chain-specific markup, not cost-push); monitor import-cost pass-through for genuinely cost-push categories; and prefer transparency + targeted enforcement over blanket price caps, which distort supply. Distinguish a chain being broadly premium (legitimate market positioning) from an unexplained item-level outlier. Never allege wrongdoing — say "candidate to inspect", not "guilty".

IMPORTANT — two separate data-source sets, do not conflate them:
- The NON-CORE DAILY CPI (dataset 1) is built from daily web-scraped prices at **Spinneys, Carrefour, and Al Makhazen**.
- The LIVE MARKET SNAPSHOT and TRADE & SHIPPING DEPENDENCY views (datasets 2–3) are built from a separate daily catalogue covering **Promarche, Al-Makhazen, and Spinneys**.
These overlap (Spinneys and Al Makhazen appear in both) but are not the same collection — Carrefour only feeds the CPI; Promarche only feeds the market/trade views. If asked which sources back a given figure, answer according to which dataset the figure came from.

NON-CORE CPI METHODOLOGY (reference this when asked how the CPI is built, what it covers, its base period, or how missing data is handled):
- Scope: a non-core inflation index covering food (and non-alcoholic beverages) and gasoline only — not the full official CPI basket.
- Basket weights: interpolated from a comparable Arab country's CPI basket and lightly adjusted to the Lebanese context, since Lebanon-specific item-level weights aren't yet available from the Ministry. Weights will be recalculated once the Ministry provides actual Lebanese food/beverage/gasoline weights.
- Collection: daily web-scraping of the three sources above for each basket item, followed by cleaning, unit/price standardization, rescaling, and geometric-mean computation before the index is built. Discounted prices are used where shown, since they reflect the actual transaction price paid.
- Elementary index: for each item, on each day, the geometric mean of matched products within a source gives that source's price; the geometric mean is then taken across sources for the item's final price. Day-to-day, this uses the Jevons formula (geometric mean of price relatives), per the IMF CPI Manual (2020): I_Jevons(0:t) = product of (p_i^t / p_i^0)^(1/n).
- Base period: 15 June 2026 (index = 100).
- Higher-level aggregation: elementary Jevons indices are combined via Young's index (a Laspeyres-type index where the weight-reference period can differ from the quantity-reference period): I(0:t) = sum of w_j^b × I_j(0:t), weights summing to 1. This proceeds class → category → division → the final non-core index.
- Weight cascade: each level's share of its parent is computed from original relative weights, multiplied by the parent's adjusted weight, cascading division → group → class → item; a consistency check confirms items sum to their class, classes to their group, groups to their division, and divisions to 100.
- Missing data (per IMF 2020 guidance): if one source is missing for an item, use the geometric mean of the available source(s). If both are missing, impute from the average of prior-period geometric means, and flag the item if it's been out of stock for two consecutive weeks (triggering a search for a replacement source). When both sources are present, certain items — notably meat, fruit, and vegetables — follow a priority rule determining which source leads.

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
- Provenance: the NON-CORE CPI and the CROSS-CHAIN / PER-ITEM BASKET are REAL measured data — do NOT call them "demo" or "illustrative". Only dataset (4), the per-product retail snapshot, is illustrative. Mention provenance only if the user asks about it.`;

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { message, history = [], focus, locale } = body || {};
  if (!message || typeof message !== "string") {
    return Response.json({ error: "Missing 'message'." }, { status: 400 });
  }

  const FOCUS_NOTES = {
    cpi: "\n\nYou are the CPI ANALYST. The official is viewing the NON-CORE DAILY CPI section. Lead with CPI/index framing (base 100, category indices, day-over-day); bring in other data only when it adds to the answer.",
    retail: "\n\nYou are the RETAIL ANALYST. The official is viewing the RETAIL ANALYTICS section. Lead with market-level shelf-price framing (price level, affordability, category mix) from the LIVE MARKET SNAPSHOT; keep that anonymized snapshot chain-free, but switch to the cross-chain basket when asked which supermarket.",
    products: "\n\nYou are the CATALOGUE ANALYST. The official is browsing the PRODUCT CATALOGUE. Lead with product-level framing — typical prices, price ranges, brands and origins by category; keep that anonymized snapshot chain-free, but switch to the cross-chain basket when asked which supermarket.",
    trade: "\n\nYou are the SOURCING ADVISOR. The official is viewing the TRADE & SHIPPING DEPENDENCY map. Lead with import dependency, single-source concentration, supplier blocs and maritime chokepoints, and practical diversification options.",
    general: "\n\nYou are the PRICE ECONOMIST giving the headline read across CPI, retail price levels and import sourcing.",
  };
  const focusNote = FOCUS_NOTES[focus] || "";

  const langNote = locale === "ar"
    ? "\n\nRespond in Modern Standard Arabic (العربية). Keep all numbers, currency symbols ($, LBP), percentages, dates, and any [CHART]...[/CHART] block exactly as specified (chart titles and data labels may be Arabic). Markdown still uses the same syntax."
    : "";

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "The AI advisor isn't configured yet. Add ANTHROPIC_API_KEY to .env.local and restart the dev server." },
      { status: 503 }
    );
  }

  // All three now hit live data (Azure Function / Data Lake pipeline) behind
  // the shared server cache — resolve them once up front rather than calling
  // async functions inside the template literal below.
  const [cpiContext, retailContext, tradeContext] = await Promise.all([
    getCpiContext(),
    getRetailContext(),
    getTradeContext(),
  ]);
  const basketChainContext = getBasketChainContext();
  const basketItemContext = getBasketItemGapContext();

  const client = new Anthropic();

  // Keep a short rolling window of prior turns.
  const msgs = history
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && m.text)
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.text }));
  msgs.push({ role: "user", content: message });

  const encoder = new TextEncoder();
  const startedAt = Date.now();
  let answer = "";
  const logQA = (status) => {
    // Structured advisor Q&A log -> Vercel runtime logs. Product/ministry signal:
    // what officials ask, on which page, and a preview of the reply.
    try {
      console.log(JSON.stringify({
        type: "advisor_qa",
        ts: new Date().toISOString(),
        focus: focus || "general",
        status,
        ms: Date.now() - startedAt,
        question: message.slice(0, 1000),
        answerChars: answer.length,
        answerPreview: answer.slice(0, 500),
      }));
    } catch { /* never let logging break the response */ }
  };

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const aiStream = client.messages.stream({
          model: MODEL,
          max_tokens: 6000,
          thinking: { type: "adaptive" }, // Opus 4.8 — max reasoning for best results
          system: [
            { type: "text", text: SYSTEM + focusNote + langNote },
            {
              type: "text",
              text: `=== NON-CORE DAILY CPI SNAPSHOT ===\n${cpiContext}\n\n=== LIVE MARKET SNAPSHOT (real measured data, market-level) ===\n${retailContext}\n\n=== TRADE & SHIPPING DEPENDENCY (import origins, market-level) ===\n${tradeContext}\n\n=== CROSS-CHAIN CPI BASKET (real scraped prices; chains NAMED — Carrefour, Spinneys, Tawfeer) ===\n${basketChainContext}\n\n=== PER-ITEM CROSS-CHAIN PRICES (same CPI item at each chain) ===\n${basketItemContext}\n\n=== RETAIL PRICE SNAPSHOT (illustrative basket) ===\n${getDataContext()}`,
              cache_control: { type: "ephemeral" },
            },
          ],
          messages: msgs,
        });

        for await (const event of aiStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            answer += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        logQA("ok");
        controller.close();
      } catch (err) {
        const msg = err?.status === 429
          ? "Rate limit — please wait a moment and try again."
          : (err?.message || "Error retrieving analysis.");
        logQA(`error:${err?.status || "unknown"}`);
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
