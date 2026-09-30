import type { Summary } from "@/lib/engine/types";
import { Markdown, MarkdownInline } from "@/components/Markdown";

export function SummaryView({ summary }: { summary: Summary }) {
  const events = `${summary.eventCount} ${summary.eventCount === 1 ? "event" : "events"}`;
  return (
    <div className="space-y-5">
      <Markdown className="prose-base">{summary.overview}</Markdown>

      <p className="text-sm text-muted-foreground">
        {summary.timeBreakdown} · {events}
      </p>

      {summary.keyEvents.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Your schedule</h3>
          <ul className="space-y-1.5">
            {summary.keyEvents.map((it, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span><MarkdownInline>{it}</MarkdownInline></span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary.highlights.length > 0 && (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Worth noting: </span>
          {summary.highlights.map((h, i) => (
            <span key={i}>
              {i > 0 && " · "}
              <MarkdownInline>{h}</MarkdownInline>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
