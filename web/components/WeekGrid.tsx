"use client";
import { DateTime } from "luxon";
import { layoutDayEvents, type CalendarEvent } from "@/lib/calendar/layout";
import { cn } from "@/lib/utils";

const PX_PER_HOUR = 48;
const HOURS = Array.from({ length: 24 }, (_, h) => h);

export function WeekGrid({ weekDays, events, todayISODate, onEventClick, onSlotClick }: {
  weekDays: DateTime[];
  events: CalendarEvent[];
  todayISODate: string;
  onEventClick: (event: CalendarEvent) => void;
  onSlotClick: (dayISODate: string, hour: number) => void;
}) {
  const dayKey = (d: DateTime) => d.toISODate()!;
  const eventsByDay = new Map<string, CalendarEvent[]>();
  for (const d of weekDays) eventsByDay.set(dayKey(d), []);
  for (const e of events) {
    const key = e.start.slice(0, 10); // YYYY-MM-DD wall date
    if (eventsByDay.has(key)) eventsByDay.get(key)!.push(e);
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="grid" style={{ gridTemplateColumns: "44px repeat(7, minmax(0, 1fr))" }}>
        <div className="border-b" />
        {weekDays.map((d) => {
          const isToday = dayKey(d) === todayISODate;
          return (
            <div key={dayKey(d)} className="border-b border-l py-1.5 text-center text-xs text-muted-foreground">
              <div>{d.toFormat("ccc")}</div>
              <div className={cn("mx-auto mt-0.5 w-7 rounded-md text-sm", isToday ? "bg-primary text-primary-foreground" : "text-foreground")}>
                {d.day}
              </div>
            </div>
          );
        })}

        <div className="border-b py-1 pr-1 text-right text-[10px] text-muted-foreground">all-day</div>
        {weekDays.map((d) => {
          const allDay = (eventsByDay.get(dayKey(d)) ?? []).filter((e) => e.allDay);
          return (
            <div key={"ad-" + dayKey(d)} className="border-b border-l p-1 space-y-0.5">
              {allDay.map((e, i) => (
                <button key={i} onClick={() => onEventClick(e)}
                  className="block w-full truncate rounded-sm border-l-2 border-primary bg-primary/10 px-1.5 py-0.5 text-left text-[11px] text-primary">
                  {e.title}
                </button>
              ))}
            </div>
          );
        })}
      </div>

      <div className="max-h-[65vh] overflow-y-auto">
        <div className="grid" style={{ gridTemplateColumns: "44px repeat(7, minmax(0, 1fr))" }}>
          <div className="relative" style={{ height: 24 * PX_PER_HOUR }}>
            {HOURS.map((h) => (
              <div key={h} className="absolute right-1 -translate-y-1/2 text-[10px] text-muted-foreground" style={{ top: h * PX_PER_HOUR }}>
                {h === 0 ? "" : `${h}:00`}
              </div>
            ))}
          </div>
          {weekDays.map((d) => {
            const positioned = layoutDayEvents(eventsByDay.get(dayKey(d)) ?? [], { pxPerHour: PX_PER_HOUR });
            return (
              <div key={"col-" + dayKey(d)} className="relative border-l" style={{ height: 24 * PX_PER_HOUR }}>
                {HOURS.map((h) => (
                  <button key={h} onClick={() => onSlotClick(dayKey(d), h)}
                    className="absolute inset-x-0 border-t border-border/60 hover:bg-muted/40"
                    style={{ top: h * PX_PER_HOUR, height: PX_PER_HOUR }} aria-label={`New event ${d.toFormat("ccc")} ${h}:00`} />
                ))}
                {positioned.map((p, i) => (
                  <button key={i} onClick={() => onEventClick(p.event)}
                    className="absolute overflow-hidden rounded-sm border-l-2 border-primary bg-primary/10 px-1.5 py-0.5 text-left text-[11px] text-primary hover:bg-primary/20"
                    style={{ top: p.top, height: p.height, left: `calc(${(p.laneIndex / p.laneCount) * 100}% + 2px)`, width: `calc(${100 / p.laneCount}% - 4px)` }}>
                    <span className="block truncate font-medium">{p.event.title}</span>
                    <span className="block truncate opacity-80">{p.event.start.slice(11, 16)}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
