/** Cadence logo mark — a "C" monogram. Inherits color via currentColor, so it
 *  matches the brand text wherever it's used. */
export function CadenceMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" aria-hidden="true">
      <path d="M16.8 6.9 A7 7 0 1 0 16.8 17.1" />
    </svg>
  );
}
