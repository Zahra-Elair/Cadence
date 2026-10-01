import { describe, it, expect } from "vitest";
import type { UIMessage } from "ai";
import { hasImageAttachment } from "./images";

const msg = (parts: UIMessage["parts"]): UIMessage => ({ id: "m", role: "user", parts });

describe("hasImageAttachment", () => {
  it("detects an image file part", () => {
    expect(hasImageAttachment([msg([{ type: "file", mediaType: "image/png", url: "data:image/png;base64,AAAA" }])])).toBe(true);
  });

  it("is false for text-only messages", () => {
    expect(hasImageAttachment([msg([{ type: "text", text: "hello" }])])).toBe(false);
  });

  it("ignores non-image file parts", () => {
    expect(hasImageAttachment([msg([{ type: "file", mediaType: "application/pdf", url: "data:application/pdf;base64,AAAA" }])])).toBe(false);
  });

  it("finds an image anywhere in the history", () => {
    const messages = [
      msg([{ type: "text", text: "earlier" }]),
      msg([{ type: "file", mediaType: "image/jpeg", url: "data:image/jpeg;base64,AAAA" }]),
    ];
    expect(hasImageAttachment(messages)).toBe(true);
  });
});
