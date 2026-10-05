/** Cadence logo mark — three ascending "cadence" bars (a beat/rhythm). Inherits
 *  color via currentColor, so it matches the brand text wherever it's used. */
export function CadenceMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <rect x="4" y="13" width="3.2" height="7" rx="1.6" />
      <rect x="10.4" y="9" width="3.2" height="11" rx="1.6" />
      <rect x="16.8" y="5" width="3.2" height="15" rx="1.6" />
    </svg>
  );
}
