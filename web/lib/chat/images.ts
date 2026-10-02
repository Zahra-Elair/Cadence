import { isFileUIPart, type UIMessage } from "ai";

type Part = UIMessage["parts"][number];

const isImagePart = (p: Part): boolean => isFileUIPart(p) && (p.mediaType ?? "").startsWith("image/");

/**
 * True when the LATEST user message carries an image — route only that turn to
 * a vision model. Images earlier in the thread don't count: a text follow-up
 * should go to the text model (with history images stripped), both to conserve
 * the scarce vision quota and because the vision model already transcribed the
 * image into the conversation as text.
 */
export function hasImageAttachment(messages: UIMessage[]): boolean {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  return !!lastUser && lastUser.parts.some(isImagePart);
}

/**
 * Replace image parts with a short text note, so a text-only model doesn't
 * receive images it can't handle. The vision model's description of the image
 * already lives in the conversation as assistant text.
 */
export function stripImageParts(messages: UIMessage[]): UIMessage[] {
  return messages.map((m) => ({
    ...m,
    parts: m.parts.map((p) =>
      isImagePart(p)
        ? ({ type: "text", text: `[image: ${(p as { filename?: string }).filename ?? "attachment"}]` } as const)
        : p,
    ),
  }));
}
