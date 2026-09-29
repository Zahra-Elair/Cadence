import { describe, it, expect } from "vitest";
import { RetryError } from "ai";
import { statusOf, isQuota, isOverload } from "./errors";

function retry(last: Error) {
  return new RetryError({ message: "retries exhausted", reason: "maxRetriesExceeded", errors: [last] });
}

describe("ai error helpers", () => {
  it("plain 429 → isQuota", () => {
    expect(isQuota({ statusCode: 429 })).toBe(true);
    expect(statusOf({ statusCode: 429 })).toBe(429);
  });
  it("plain 503 → isOverload", () => {
    expect(isOverload({ statusCode: 503 })).toBe(true);
  });
  it("RetryError-wrapped 429 → isQuota (and statusOf unwraps)", () => {
    const err = retry(Object.assign(new Error("boom"), { statusCode: 429 }));
    expect(statusOf(err)).toBe(429);
    expect(isQuota(err)).toBe(true);
    expect(isOverload(err)).toBe(false);
  });
  it("RetryError-wrapped 503 → isOverload", () => {
    const err = retry(Object.assign(new Error("boom"), { statusCode: 503 }));
    expect(isOverload(err)).toBe(true);
    expect(isQuota(err)).toBe(false);
  });
  it("message-only quota / overload", () => {
    expect(isQuota(new Error("quota exceeded"))).toBe(true);
    expect(isOverload(new Error("model is overloaded"))).toBe(true);
  });
  it("unrelated error → both false", () => {
    const err = new Error("something else");
    expect(isQuota(err)).toBe(false);
    expect(isOverload(err)).toBe(false);
  });
});
