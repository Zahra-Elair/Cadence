import { DateTime } from "luxon";
import type { Period, ScheduleEvent, Summary } from "@/lib/engine/types";
import { Markdown, MarkdownInline } from "@/components/Markdown";

function fmtTime(dt: DateTime): string {
  return dt.minute === 0 ? dt.toFormat("h a") : dt.toFormat("h:mm a");
}

/** Readable "when" for a schedule row: time-only on the day view, date + time otherwise. */
function whenLabel(e: ScheduleEvent, period: Period): string {
  const start = DateTime.fromISO(e.start);
  const day = start.toFormat("EEE d LLL");
  if (e.allDay) return period === "daily" ? "All day" : `${day} · All day`;
  const time = `${fmtTime(start)} – ${fmtTime(DateTime.fromISO(e.end))}`;
  return period === "daily" ? time : `${day} · ${time}`;
}

export function SummaryView({ summary }: { summary: Summary }) {
  const events = `${summary.eventCount} ${summary.eventCount === 1 ? "event" : "events"}`;
  return (
    <div className="space-y-5">
      <Markdown className="prose-base">{summary.overview}</Markdown>

      <p className="text-sm text-muted-foreground">
        {summary.timeBreakdown} · {events}
      </p>

      {summary.events.length > 0 && (
        <div className="overflow-hidden rounded-xl border">
          <div className="border-b bg-muted/40 px-4 py-2.5 text-sm font-medium text-muted-foreground">Your schedule</div>
          <ul className="divide-y">
            {summary.events.map((e, i) => (
              <li key={i} className="flex flex-col gap-0.5 px-4 py-2.5 sm:flex-row sm:items-baseline sm:gap-3">
                <span className="shrink-0 text-sm tabular-nums text-muted-foreground sm:w-44">{whenLabel(e, summary.period)}</span>
                <span className="text-sm font-medium">
                  {e.title}
                  {e.location && <span className="font-normal text-muted-foreground"> · {e.location}</span>}
                </span>
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
