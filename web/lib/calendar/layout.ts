export interface CalendarEvent {
  id?: string;
  title: string;
  start: string; // ISO 8601 with the user's offset
  end: string;
  allDay: boolean;
  location?: string;
  description?: string;
}

export interface PositionedEvent {
  event: CalendarEvent;
  top: number;
  height: number;
  laneIndex: number;
  laneCount: number;
}

/** Minutes from midnight of the ISO string's wall-clock time (offset-agnostic). */
export function wallMinutes(iso: string): number {
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function layoutDayEvents(
  events: CalendarEvent[],
  { pxPerHour, minHeight = 18 }: { pxPerHour: number; minHeight?: number },
): PositionedEvent[] {
  const timed = events
    .filter((e) => !e.allDay)
    .map((e) => ({ e, s: wallMinutes(e.start), en: Math.max(wallMinutes(e.start) + 1, wallMinutes(e.end)) }))
    .sort((a, b) => a.s - b.s || a.en - b.en);

  // Assign each event the lowest lane whose last event ended at/before this start.
  const laneEnds: number[] = [];
  const laneOf = new Map<number, number>();
  timed.forEach((t, i) => {
    let lane = laneEnds.findIndex((end) => end <= t.s);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(t.en); }
    else laneEnds[lane] = t.en;
    laneOf.set(i, lane);
  });

  // laneCount per event = max concurrent lanes across its connected overlap cluster.
  const clusterCount = new Array(timed.length).fill(1);
  let i = 0;
  while (i < timed.length) {
    let j = i;
    let clusterEnd = timed[i].en;
    let lanesUsed = new Set<number>([laneOf.get(i)!]);
    while (j + 1 < timed.length && timed[j + 1].s < clusterEnd) {
      j += 1;
      clusterEnd = Math.max(clusterEnd, timed[j].en);
      lanesUsed.add(laneOf.get(j)!);
    }
    const count = lanesUsed.size;
    for (let k = i; k <= j; k++) clusterCount[k] = count;
    i = j + 1;
  }

  return timed.map((t, idx) => ({
    event: t.e,
    top: (t.s / 60) * pxPerHour,
    height: Math.max(minHeight, ((t.en - t.s) / 60) * pxPerHour),
    laneIndex: laneOf.get(idx)!,
    laneCount: clusterCount[idx],
  }));
}
