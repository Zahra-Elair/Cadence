import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from "ai";
import { auth } from "@/auth";
import { getGoogleAccessToken } from "@/lib/auth-token";
import { resolveModel, GENERATION_PROVIDER_OPTIONS } from "@/lib/ai/provider";
import { buildTools } from "@/lib/chat/tools";
import { buildSystem } from "@/lib/chat/system";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return new Response("Please sign in.", { status: 401 });
  const token = await getGoogleAccessToken();
  if (!token) return new Response("Your session expired. Please sign in again.", { status: 401 });

  const { messages, timeZone } = (await req.json()) as { messages: UIMessage[]; timeZone: string };

  const result = streamText({
    model: resolveModel(),
    system: buildSystem(timeZone ?? "UTC"),
    messages: await convertToModelMessages(messages),
    tools: buildTools(token, timeZone ?? "UTC"),
    stopWhen: stepCountIs(8),
    providerOptions: GENERATION_PROVIDER_OPTIONS,
  });

  return result.toUIMessageStreamResponse({
    onError: (error) => {
      const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
      if (msg.includes("quota") || msg.includes("rate limit") || msg.includes("resource_exhausted"))
        return "Free-tier limit reached (it resets daily). Try again later, or switch AI_PROVIDER/AI_MODEL.";
      if (msg.includes("overload") || msg.includes("unavailable")) return "The assistant is busy right now — please try again in a moment.";
      return "Something went wrong. Please try again.";
    },
  });
}
