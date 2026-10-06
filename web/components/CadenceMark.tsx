/** Cadence logo mark (gradient calendar-C with a sparkle). Sized via className. */
export function CadenceMark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/cadence-mark.png" alt="Cadence logo" className={`rounded-md ${className ?? ""}`} />
  );
}
