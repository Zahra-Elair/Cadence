import { isFileUIPart, type UIMessage } from "ai";

/** True when any message carries an image attachment — used to route the
 *  request to a vision-capable model instead of the text model. */
export function hasImageAttachment(messages: UIMessage[]): boolean {
  return messages.some((m) =>
    m.parts.some((p) => isFileUIPart(p) && (p.mediaType ?? "").startsWith("image/")),
  );
}
