export type Period = "daily" | "weekly" | "monthly";

export interface CalEvent {
  id?: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  location?: string;
  attendees: string[];
  description?: string;
}

/** A calendar event serialized for the client, times as ISO with the user's offset. */
export interface ScheduleEvent {
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
}

export interface Summary {
  period: Period;
  start: string; // ISO date (inclusive)
  end: string;   // ISO date (exclusive)
  overview: string;
  keyEvents: string[];
  timeBreakdown: string;
  highlights: string[];
  eventCount: number; // total events in the period (not just the key ones listed)
  events: ScheduleEvent[]; // the actual events, for the schedule card
  empty: boolean;
}
