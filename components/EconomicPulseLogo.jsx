// Economic Pulse — the maker's logo, shown as-is from public/economic-pulse.png.
// Save the logo file at: public/economic-pulse.png

export default function EconomicPulseLogo({ className = "", imgClassName = "h-7 w-auto" }) {
  return (
    <img
      src="/economic-pulse.png"
      alt="Economic Pulse"
      className={`${imgClassName} ${className}`}
    />
  );
}
