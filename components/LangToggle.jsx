"use client";

// Language switch (EN ⇄ AR). Persists the choice in a cookie and reloads so the
// server re-renders every page in the new language and the html dir flips.
export default function LangToggle({ locale = "en", className = "" }) {
  const next = locale === "ar" ? "en" : "ar";
  const label = locale === "ar" ? "English" : "العربية";

  const switchTo = () => {
    document.cookie = `locale=${next}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
  };

  return (
    <button
      type="button"
      onClick={switchTo}
      aria-label={`Switch language to ${label}`}
      className={`inline-flex items-center gap-1.5 transition-colors cursor-pointer ${className}`}
    >
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20" /></svg>
      <span className="font-semibold">{label}</span>
    </button>
  );
}
