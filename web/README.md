# Calendar Summarizer — Web (Phase 3)

Sign in with Google and get an AI summary of your real Google Calendar
(daily / weekly / monthly), powered by the free tier of Google Gemini. Chat with your calendar — ask questions, create events, update or delete them.

**Permissions:** Requires read and write access to your Google Calendar.

## Setup

1. Install deps: `cd web && npm install`
2. **Google OAuth client** — in [Google Cloud Console](https://console.cloud.google.com/):
   - Create a project → **APIs & Services** → enable the **Google Calendar API**.
   - **OAuth consent screen**: External, add yourself under **Test users**.
   - **Credentials → Create OAuth client ID → Web application**. Add redirect URI
     `http://localhost:3000/api/auth/callback/google`.
   - Copy the Client ID and Client Secret.
3. `cp .env.local.example .env.local` and fill in:
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
   - `AUTH_SECRET` — run `npx auth secret`
   - `GEMINI_API_KEY` — from https://aistudio.google.com/apikey
4. `npm run dev` → open http://localhost:3000

> Note: while the OAuth app is unverified, only accounts added as **Test users**
> can sign in, and they will see an "unverified app" warning.

## Assistant (chat)

Open **Assistant** from the dashboard header. Ask it in plain language, e.g.:
- "What's on my calendar Thursday?"
- "Add lunch with Sam Thursday at 1pm"
- "Move my 3pm to 4pm" / "Delete the dentist appointment"

Reads run automatically; any change (create/update/delete) shows a confirmation
card and only happens when you click **Confirm**.

> Requires the read+write calendar scope — existing users sign in again once to
> grant it.

## Tests

```bash
npm test
```
Engine and mapper tests mock Gemini and the network — no key needed.
