import { APICallError, RetryError } from "ai";

// After the SDK's built-in retries are exhausted it wraps the real error in a
// RetryError (no top-level statusCode), so every helper unwraps lastError first.

function msgOf(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).toLowerCase();
}

export function statusOf(err: unknown): number | undefined {
  if (RetryError.isInstance(err)) return statusOf(err.lastError);
  if (APICallError.isInstance(err)) return err.statusCode;
  const e = err as { statusCode?: number; status?: number; code?: number } | null | undefined;
  return e?.statusCode ?? e?.status ?? e?.code;
}

export function isQuota(err: unknown): boolean {
  if (RetryError.isInstance(err)) return isQuota(err.lastError);
  if (statusOf(err) === 429) return true;
  const m = msgOf(err);
  return m.includes("quota") || m.includes("resource_exhausted") || m.includes("rate limit");
}

export function isOverload(err: unknown): boolean {
  if (RetryError.isInstance(err)) return isOverload(err.lastError);
  if (statusOf(err) === 503) return true;
  const m = msgOf(err);
  return m.includes("overload") || m.includes("high demand") || m.includes("unavailable");
}
