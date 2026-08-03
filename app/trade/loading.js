// Automatically shown by Next.js (App Router streaming) while app/trade/page.js
// is fetching its server data.
export default function TradeLoading() {
  return (
    <div className="max-w-7xl mx-auto w-full px-5 pt-24 pb-24 flex flex-col items-center justify-center min-h-[50vh]">
      <div
        className="w-10 h-10 rounded-full border-4 border-slate-200 border-t-cedar animate-spin"
        role="status"
        aria-label="Loading"
      />
      <p className="mt-4 text-sm text-slate-500">Loading Trade Map data…</p>
    </div>
  );
}
