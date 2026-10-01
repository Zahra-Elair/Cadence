import { streamText, smoothStream, convertToModelMessages, stepCountIs, type UIMessage } from "ai";
import { auth } from "@/auth";
import { getGoogleAccessToken } from "@/lib/auth-token";
import { resolveModel, resolveVisionModel, ProviderConfigError, GENERATION_PROVIDER_OPTIONS } from "@/lib/ai/provider";
import { isQuota, isOverload } from "@/lib/ai/errors";
import { buildTools } from "@/lib/chat/tools";
import { buildSystem } from "@/lib/chat/system";
import { hasImageAttachment } from "@/lib/chat/images";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return new Response("Please sign in.", { status: 401 });
  const token = await getGoogleAccessToken();
  if (!token) return new Response("Your session expired. Please sign in again.", { status: 401 });

  let body: { messages: UIMessage[]; timeZone: string; viewContext?: { weekStartISO?: string; selectedDayISO?: string } };
  try {
    body = (await req.json()) as { messages: UIMessage[]; timeZone: string; viewContext?: { weekStartISO?: string; selectedDayISO?: string } };
  } catch {
    return new Response("Invalid request body.", { status: 400 });
  }
  const { messages, timeZone, viewContext } = body;

  // Messages carrying an image go to a vision model (Gemini); text stays on the
  // configured text provider.
  const useVision = hasImageAttachment(messages);
  let model: ReturnType<typeof resolveModel>;
  try {
    model = useVision ? resolveVisionModel() : resolveModel();
  } catch (err) {
    if (err instanceof ProviderConfigError)
      return new Response(
        useVision
          ? "Image understanding isn't configured on the server (missing GEMINI_API_KEY)."
          : "The assistant isn't configured on the server (missing or invalid AI provider settings).",
        { status: 500 },
      );
    throw err;
  }

  const result = streamText({
    model,
    system: buildSystem(timeZone ?? "UTC", viewContext),
    messages: await convertToModelMessages(messages),
    tools: buildTools(token, timeZone ?? "UTC"),
    stopWhen: stepCountIs(8),
    providerOptions: GENERATION_PROVIDER_OPTIONS,
    // Pace the stream to a readable word-by-word cadence — Groq's models emit
    // tokens near-instantly, so without this the reply "types" too fast to read.
    experimental_transform: smoothStream({ delayInMs: 25, chunking: "word" }),
  });

  return result.toUIMessageStreamResponse({
    onError: (error) => {
      console.error("[chat stream] error:", error);
      if (isQuota(error))
        return "Free-tier limit reached (it resets daily). Try again later, or switch AI_PROVIDER/AI_MODEL.";
      if (isOverload(error)) return "The assistant is busy right now — please try again in a moment.";
      return "Something went wrong. Please try again.";
    },
  });
}
