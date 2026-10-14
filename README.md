# Cadence

**An AI calendar assistant that lets you talk to your Google Calendar instead of clicking through it.**

Ask "what's on today?", say "add lunch with Sam Thursday at 1pm" or "clear Friday afternoon", or snap a photo of a gym timetable and have it schedule the sessions. Everything happens in one workspace, and nothing is written to your calendar until you confirm it.

**Live:** [cadencecalendar.vercel.app](https://cadencecalendar.vercel.app) · **Demo video:** [watch on Google Drive](https://drive.google.com/file/d/129J5ruYd5mWrMr0S8S4om5F52-OLjHnZ/view) · **Case study:** [portfolio](https://zahra-elair-portfolio.vercel.app/projects/cadence)

## Highlights

- **Natural-language event management.** Create, move, and delete events by chat. Each proposed change appears as a confirm card, so a human stays in the loop and nothing is written silently.
- **Multimodal input.** Attach a photo of a schedule or plan; the assistant reads it and proposes the events to add.
- **Unified workspace.** A custom week calendar with overlap-aware layout, a chat docked beside it that knows which week you're viewing, and a live "Now / Next" bar. The grid updates as you chat.
- **AI summaries.** Daily, weekly, and monthly briefs of what's on your calendar.
- **Provider-agnostic AI layer.** Runs on four free LLM providers (Google Gemini, Groq, Mistral, OpenRouter). Images are routed to a vision model, with automatic model fallback to work around free-tier rate limits.
- **Streaming chat with tool calling,** Google sign-in, session-persisted conversations, markdown rendering, and light and dark themes.

## Tech stack

Next.js 16 (App Router, Server Actions) · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui · Auth.js (Google OAuth) · Vercel AI SDK · Luxon · Zod · Vitest · deployed on Vercel

## How it works

1. You sign in with Google and grant read and write access to your calendar.
2. Your message (and any attached image) goes to the chat route, which streams a response from the configured LLM.
3. The model reads your calendar through tools. Reads run automatically.
4. Any change (create, update, delete) comes back as a proposal card. Only when you click **Confirm** is it written to Google Calendar.

## Run it locally

Requirements: Node.js 20+ and a Google Cloud project.

```bash
cd web
npm install
cp .env.local.example .env.local
npm run dev
```

Then open http://localhost:3000.

Fill in `.env.local`:

| Variable | Where to get it |
|---|---|
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | [Google Cloud Console](https://console.cloud.google.com/): enable the **Google Calendar API**, configure the OAuth consent screen (add yourself as a test user), then create an OAuth client ID for a web application with the redirect URI `http://localhost:3000/api/auth/callback/google` |
| `AUTH_SECRET` | run `npx auth secret` |
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) (free) |

To use another provider, set `AI_PROVIDER` to `groq`, `mistral`, or `openrouter` and add its key; `AI_MODEL` overrides the default model. See `web/.env.local.example` for every option.

> While the OAuth app is unverified, only accounts added as test users can sign in, and they see an "unverified app" warning.

## Tests

```bash
cd web
npm test
```

The tests mock the LLM providers and the network, so no API key is needed.

## Repository layout

```
web/          Next.js app: workspace, assistant, calendar, and API routes
python-cli/   The original summarizer engine and command-line tool (first prototype)
docs/         Design notes and implementation plans
```

## Author

Built by [Zahra Elair](https://zahra-elair-portfolio.vercel.app), AI Software Engineer.
