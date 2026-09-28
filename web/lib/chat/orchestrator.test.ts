import { describe, it, expect, vi } from "vitest";
import { runTurn, continueAfterToolResult } from "./orchestrator";
import type { ChatContent } from "./types";

const userMsg = (t: string): ChatContent => ({ role: "user", parts: [{ text: t }] });

describe("runTurn", () => {
  it("returns a plain text reply", async () => {
    const generate = vi.fn(async () => ({ text: "Hello!", functionCall: null }));
    const cal = { listEvents: vi.fn() };
    const res = await runTurn([userMsg("hi")], generate, cal);
    expect(res.kind).toBe("reply");
    if (res.kind === "reply") expect(res.reply).toBe("Hello!");
    expect(cal.listEvents).not.toHaveBeenCalled();
  });

  it("executes a read tool then returns the follow-up reply", async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce({ text: null, functionCall: { name: "list_events", args: { timeMin: "a", timeMax: "b" } } })
      .mockResolvedValueOnce({ text: "You have 2 meetings.", functionCall: null });
    const cal = { listEvents: vi.fn(async () => [{ id: "e1" }]) };
    const res = await runTurn([userMsg("what's on?")], generate, cal);
    expect(cal.listEvents).toHaveBeenCalledOnce();
    expect(res.kind).toBe("reply");
    if (res.kind === "reply") expect(res.reply).toContain("2 meetings");
  });

  it("returns a pending confirm for a valid write WITHOUT executing it", async () => {
    const generate = vi.fn(async () => ({
      text: null,
      functionCall: { name: "create_event", args: { title: "Lunch", start: "2026-09-25T13:00:00Z", end: "2026-09-25T14:00:00Z" } },
    }));
    const cal = { listEvents: vi.fn() };
    const res = await runTurn([userMsg("add lunch")], generate, cal);
    expect(res.kind).toBe("confirm");
    if (res.kind === "confirm") {
      expect(res.pending.tool).toBe("create_event");
      expect(res.pending.summary).toContain("Lunch");
    }
    expect(cal.listEvents).not.toHaveBeenCalled();
  });

  it("feeds an invalid-write error back to the model instead of confirming", async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce({ text: null, functionCall: { name: "create_event", args: { title: "X", start: "bad", end: "bad" } } })
      .mockResolvedValueOnce({ text: "What time should it start?", functionCall: null });
    const cal = { listEvents: vi.fn() };
    const res = await runTurn([userMsg("add x")], generate, cal);
    expect(res.kind).toBe("reply");
    expect(generate).toHaveBeenCalledTimes(2);
  });
});

describe("continueAfterToolResult", () => {
  it("appends the tool result and gets the model's follow-up", async () => {
    const generate = vi.fn(async () => ({ text: "Done ✅", functionCall: null }));
    const cal = { listEvents: vi.fn() };
    const historyEndingInWrite: ChatContent[] = [
      userMsg("add lunch"),
      { role: "model", parts: [{ functionCall: { name: "create_event", args: {} } }] },
    ];
    const res = await continueAfterToolResult(historyEndingInWrite, "create_event", { id: "new1" }, generate, cal);
    expect(res.kind).toBe("reply");
    if (res.kind === "reply") expect(res.reply).toContain("Done");
  });
});
