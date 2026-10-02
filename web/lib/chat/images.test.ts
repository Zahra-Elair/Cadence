import { describe, it, expect } from "vitest";
import type { UIMessage } from "ai";
import { hasImageAttachment, stripImageParts } from "./images";

const user = (parts: UIMessage["parts"]): UIMessage => ({ id: "u", role: "user", parts });
const assistant = (text: string): UIMessage => ({ id: "a", role: "assistant", parts: [{ type: "text", text }] });
const imgPart = { type: "file" as const, mediaType: "image/png", url: "data:image/png;base64,AAAA", filename: "plan.png" };

describe("hasImageAttachment", () => {
  it("detects an image in the latest user message", () => {
    expect(hasImageAttachment([user([imgPart])])).toBe(true);
  });

  it("is false when the latest user message is text-only, even if history has an image", () => {
    const messages = [user([imgPart]), assistant("I read your plan…"), user([{ type: "text", text: "pick one per day" }])];
    expect(hasImageAttachment(messages)).toBe(false);
  });

  it("is false for text-only conversations", () => {
    expect(hasImageAttachment([user([{ type: "text", text: "hi" }])])).toBe(false);
  });
});

describe("stripImageParts", () => {
  it("replaces image parts with a text note and leaves other parts intact", () => {
    const [m] = stripImageParts([user([imgPart, { type: "text", text: "add these" }])]);
    expect(m.parts[0]).toEqual({ type: "text", text: "[image: plan.png]" });
    expect(m.parts[1]).toEqual({ type: "text", text: "add these" });
  });

  it("leaves image-free messages unchanged", () => {
    const msgs = [assistant("hello")];
    expect(stripImageParts(msgs)[0].parts).toEqual([{ type: "text", text: "hello" }]);
  });
});
