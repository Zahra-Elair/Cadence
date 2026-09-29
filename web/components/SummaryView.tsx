import type { Summary } from "@/lib/engine/types";
import { Badge } from "@/components/ui/badge";

export function SummaryView({ summary }: { summary: Summary }) {
  return (
    <div className="space-y-5">
      <p className="text-lg leading-relaxed">{summary.overview}</p>
      <div className="grid grid-cols-2 gap-3">
        <Metric label="Scheduled" value={summary.timeBreakdown} />
        <Metric label="Key events" value={String(summary.keyEvents.length)} />
      </div>
      <Section title="Key events" items={summary.keyEvents} />
      {summary.highlights.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Highlights</h3>
          <div className="flex flex-wrap gap-2">
            {summary.highlights.map((h, i) => <Badge key={i} variant="secondary">{h}</Badge>)}
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/50 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-medium">{value}</p>
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2 text-sm">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
