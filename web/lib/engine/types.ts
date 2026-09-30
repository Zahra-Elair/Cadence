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

export interface Summary {
  period: Period;
  start: string; // ISO date (inclusive)
  end: string;   // ISO date (exclusive)
  overview: string;
  keyEvents: string[];
  timeBreakdown: string;
  highlights: string[];
  eventCount: number; // total events in the period (not just the key ones listed)
  empty: boolean;
}
