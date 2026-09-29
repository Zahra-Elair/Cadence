import type { Period, Summary } from "@/lib/engine/types";

export type Cell =
  | { status: "loading" }
  | { status: "loaded"; summary: Summary }
  | { status: "error"; error: string; needsSignIn: boolean };

export interface SummaryState {
  period: Period;
  byPeriod: Partial<Record<Period, Cell>>;
}

export type SummaryAction =
  | { type: "select"; period: Period }
  | { type: "loading"; period: Period }
  | { type: "loaded"; period: Period; summary: Summary }
  | { type: "error"; period: Period; error: string; needsSignIn: boolean };

export function initialSummaryState(period: Period): SummaryState {
  return { period, byPeriod: {} };
}

export function summaryReducer(state: SummaryState, action: SummaryAction): SummaryState {
  switch (action.type) {
    case "select":
      return { ...state, period: action.period };
    case "loading":
      return { ...state, byPeriod: { ...state.byPeriod, [action.period]: { status: "loading" } } };
    case "loaded":
      return { ...state, byPeriod: { ...state.byPeriod, [action.period]: { status: "loaded", summary: action.summary } } };
    case "error":
      return { ...state, byPeriod: { ...state.byPeriod, [action.period]: { status: "error", error: action.error, needsSignIn: action.needsSignIn } } };
    default:
      return state;
  }
}

/** Fetch when the period is uncached or its last attempt errored (so errors retry, successes stay cached). */
export function shouldFetch(state: SummaryState, period: Period): boolean {
  const cell = state.byPeriod[period];
  return cell === undefined || cell.status === "error";
}
