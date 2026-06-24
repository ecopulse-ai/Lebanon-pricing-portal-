"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import MessageContent from "@/components/MessageContent";

// Hydration-safe persisted open/closed state. Reads via useSyncExternalStore
// (server snapshot = closed) so there is no setState-in-effect and no SSR
// mismatch; writes go straight to localStorage and notify subscribers.
const OPEN_KEY = "lpiu-economist-open";
const openListeners = new Set();
function readOpen() {
  try { return localStorage.getItem(OPEN_KEY) === "1"; } catch { return false; }
}
function usePersistentOpen() {
  const subscribe = useCallback((cb) => {
    openListeners.add(cb);
    window.addEventListener("storage", cb);
    return () => { openListeners.delete(cb); window.removeEventListener("storage", cb); };
  }, []);
  const open = useSyncExternalStore(subscribe, readOpen, () => false);
  const setOpen = useCallback((v) => {
    try { localStorage.setItem(OPEN_KEY, v ? "1" : "0"); } catch { /* ignore */ }
    openListeners.forEach((l) => l());
  }, []);
  return [open, setOpen];
}

// Each page gets its own specialist: a distinct title, framing and starters,
// plus a `focus` tag the API uses to bias the briefing toward that dataset.
function contextFor(pathname) {
  if (pathname.startsWith("/cpi")) {
    return {
      focus: "cpi",
      title: "CPI Analyst",
      subtitle: "Lebanon · non-core daily CPI",
      intro: "The non-core daily CPI — category indices against a base of 100. Ask about today's movers and the index trend.",
      starters: [
        { icon: "📈", text: "Summarize today's non-core CPI in two lines" },
        { icon: "📊", text: "Which CPI categories rose fastest day-over-day?" },
        { icon: "🥖", text: "Chart the food categories by current index" },
      ],
    };
  }
  if (pathname.startsWith("/dashboard")) {
    return {
      focus: "retail",
      title: "Retail Analyst",
      subtitle: "Lebanon · retail price levels",
      intro: "Shelf-price levels, affordability and category mix from the live market snapshot — market-level only, no individual stores.",
      starters: [
        { icon: "💵", text: "What's the affordability split across price bands?" },
        { icon: "🗂️", text: "Which categories sit at the highest median price?" },
        { icon: "📊", text: "Chart items by price band" },
      ],
    };
  }
  if (pathname.startsWith("/products")) {
    return {
      focus: "products",
      title: "Catalogue Analyst",
      subtitle: "Lebanon · product catalogue",
      intro: "The full standardized catalogue — prices, brands and origins across 47.8k products. Ask about any item, brand or category.",
      starters: [
        { icon: "🔎", text: "What's the typical price for cooking oil?" },
        { icon: "🏷️", text: "Which categories have the widest price ranges?" },
        { icon: "🌍", text: "Which brands are most listed, and where from?" },
      ],
    };
  }
  if (pathname.startsWith("/trade")) {
    return {
      focus: "trade",
      title: "Sourcing Advisor",
      subtitle: "Lebanon · import dependency",
      intro: "Import single-source concentration, supplier blocs and maritime chokepoints. Ask how to reduce dependency and shipping risk.",
      starters: [
        { icon: "⚓", text: "Which categories are dangerously single-source?" },
        { icon: "🚢", text: "What's our biggest maritime chokepoint exposure?" },
        { icon: "🧭", text: "How can Lebanon diversify away from its top supplier?" },
      ],
    };
  }
  return {
    focus: "general",
    title: "Price Economist",
    subtitle: "Lebanon · prices overview",
    intro: "The headline read on Lebanese prices — CPI, retail levels and import sourcing. Ask anything, or start with one of these.",
    starters: [
      { icon: "🧭", text: "What's the headline on Lebanese prices today?" },
      { icon: "⚖️", text: "Compare the CPI index with the retail snapshot" },
      { icon: "💵", text: "Which goods are squeezing households most?" },
    ],
  };
}

const SealIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
  </svg>
);

export default function EconomistDock() {
  const pathname = usePathname();
  const [open, setOpen] = usePersistentOpen();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  const { focus, title, subtitle, intro, starters } = contextFor(pathname);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, loading, open]);

  // Let any page open this dock (e.g. an "Ask the economist" button).
  useEffect(() => {
    const openIt = () => setOpen(true);
    window.addEventListener("economist:open", openIt);
    return () => window.removeEventListener("economist:open", openIt);
  }, [setOpen]);

  async function send(text) {
    const userMsg = (text ?? input).trim();
    if (!userMsg || loading) return;
    setInput("");
    setError(null);
    const base = [...messages, { role: "user", text: userMsg }];
    setMessages([...base, { role: "assistant", text: "" }]);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, history: base.slice(-10), focus }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || `Error ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages([...base, { role: "assistant", text: acc }]);
      }
    } catch (err) {
      setError(err.message);
      setMessages([...base, { role: "assistant", text: "⚠ " + err.message }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  const empty = messages.length === 0;

  return (
    <>
      {/* Collapsed tab */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open the AI Price Economist"
          className="fixed right-0 top-1/2 -translate-y-1/2 z-[60] flex flex-col items-center gap-2 rounded-l-xl bg-ink text-paper pl-2.5 pr-2 py-4 shadow-lg ring-1 ring-amber-500/30 hover:bg-[#16271e] transition-colors cursor-pointer"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-70" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400" />
          </span>
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ writingMode: "vertical-rl" }}>
            AI Price Economist
          </span>
          <SealIcon className="w-4 h-4 text-amber-400" />
        </button>
      )}

      {/* Mobile backdrop */}
      {open && <div className="fixed inset-0 z-[59] bg-ink/40 backdrop-blur-[1px] sm:hidden" onClick={() => setOpen(false)} aria-hidden="true" />}

      {/* Panel — dark intelligence terminal */}
      {open && (
        <aside
          className="fixed top-0 right-0 bottom-0 z-[60] w-full sm:w-[400px] flex flex-col fade-in text-paper border-l border-white/10 shadow-2xl"
          style={{ background: "#0c130f" }}
          aria-label="AI Price Economist"
        >
          {/* Scan line */}
          <div aria-hidden className="h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(195,164,99,0.5), transparent)" }} />

          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-4 py-3.5 border-b border-white/10">
            <div className="flex items-center gap-3 min-w-0">
              <span className="grid place-items-center w-9 h-9 rounded-lg bg-white/[0.06] ring-1 ring-amber-500/30 text-amber-400 shrink-0">
                <SealIcon className="w-5 h-5" />
              </span>
              <div className="min-w-0 leading-tight">
                <p className="font-mono text-sm font-semibold tracking-[0.08em] truncate">{title.toUpperCase()}</p>
                <p className="font-mono text-[10px] text-paper/45 truncate">{subtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {messages.length > 0 && (
                <button onClick={() => { setMessages([]); setError(null); }} aria-label="Clear conversation"
                  className="text-[10px] font-mono uppercase tracking-wider text-paper/55 hover:text-paper border border-white/15 rounded px-2 py-1 transition-colors cursor-pointer">
                  Clear
                </button>
              )}
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-emerald-500/25 bg-emerald-500/10">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ boxShadow: "0 0 6px rgba(52,211,153,0.7)" }} />
                <span className="font-mono text-[9px] font-semibold tracking-[0.16em] text-emerald-400">LIVE</span>
              </span>
              <button onClick={() => setOpen(false)} aria-label="Collapse"
                className="grid place-items-center w-8 h-8 rounded-md text-paper/70 hover:bg-white/10 cursor-pointer">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m9 18 6-6-6-6" /></svg>
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto scroll-thin px-4 py-5 min-h-0">
            {empty && !loading && (
              <div>
                <div className="text-center pt-2 pb-6">
                  <span className="grid place-items-center w-14 h-14 rounded-2xl bg-white/[0.05] ring-1 ring-amber-500/25 text-amber-400 mx-auto">
                    <SealIcon className="w-7 h-7" />
                  </span>
                  <h2 className="mt-4 font-display text-lg font-semibold text-paper">Ask the {title}</h2>
                  <p className="mt-1.5 text-sm text-paper/55 leading-relaxed">{intro}</p>
                </div>

                <p className="font-mono text-[10px] font-semibold tracking-[0.2em] text-paper/40 mb-2.5">TRY ASKING</p>
                <div className="space-y-2.5">
                  {starters.map((s, i) => (
                    <button key={i} onClick={() => send(s.text)}
                      className="w-full flex items-center gap-3 text-left rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] hover:border-amber-500/40 px-3.5 py-3 text-sm text-paper/85 transition-colors cursor-pointer">
                      <span className="text-base shrink-0">{s.icon}</span>
                      <span>{s.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              {messages.map((m, i) => (
                <div key={i} className={`flex fade-in ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  {m.role === "user" ? (
                    <div className="max-w-[88%] rounded-2xl rounded-br-sm bg-amber-500 text-ink px-3.5 py-2 text-sm font-medium leading-relaxed">{m.text}</div>
                  ) : (
                    <div className="w-full">
                      <div className="flex items-center gap-1.5 text-[11px] text-amber-400 font-mono mb-1.5 tracking-wider">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> ECONOMIST
                      </div>
                      <div className="rounded-2xl rounded-tl-sm border border-white/10 bg-white px-3.5 py-2.5">
                        {m.text ? <MessageContent text={m.text} /> : <span className="text-slate-400 text-sm">…</span>}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {loading && messages[messages.length - 1]?.text === "" && (
                <div className="flex items-center gap-2 px-1">
                  <span className="typing-dot" style={{ background: "#c3a463" }} />
                  <span className="typing-dot" style={{ background: "#c3a463" }} />
                  <span className="typing-dot" style={{ background: "#c3a463" }} />
                  <span className="text-[11px] text-paper/45 font-mono ml-1 tracking-wider">ANALYZING…</span>
                </div>
              )}

              {error && <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>}
              <div ref={endRef} />
            </div>
          </div>

          {/* Input */}
          <div className="border-t border-white/10 px-3 py-3" style={{ background: "#0c130f", paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Ask the price economist…"
                rows={1}
                className="flex-1 resize-none rounded-lg border border-white/15 bg-white/[0.05] px-3 py-2.5 text-sm text-paper placeholder-paper/40 outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/15 max-h-28"
                aria-label="Ask the AI Price Economist"
              />
              <button
                onClick={() => send()}
                disabled={loading || !input.trim()}
                aria-label="Send"
                className="grid place-items-center w-10 h-10 rounded-lg shrink-0 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-paper/30 bg-amber-500 hover:bg-amber-400 text-ink"
              >
                {loading ? (
                  <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" /></svg>
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                )}
              </button>
            </div>
            <p className="mt-2 text-[10px] text-paper/40 font-mono text-right">Enter to send · Shift+Enter new line</p>
          </div>
        </aside>
      )}
    </>
  );
}
