import Link from "next/link";
import { CalendarClock } from "lucide-react";

export const metadata = {
  title: "Privacy Policy — Cadence",
  description: "How Cadence accesses and uses your Google Calendar data.",
};

const UPDATED = "1 October 2026";
// TODO: replace with the contact email you want shown publicly (can match the
// developer contact on your Google OAuth consent screen).
const CONTACT = "zahraelair17@gmail.com";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-medium">{title}</h2>
      <div className="space-y-2 text-sm text-muted-foreground">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <CalendarClock className="h-5 w-5 text-primary" /> Cadence
          </Link>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">Home</Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-12">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">Last updated: {UPDATED}</p>
        </div>

        <p className="text-sm text-muted-foreground">
          Cadence is an AI assistant for your Google Calendar. It creates summaries of your schedule and
          lets you create, move, and delete events by chatting. This policy explains what data Cadence
          accesses, how it is used, and the choices you have.
        </p>

        <Section title="What Cadence accesses">
          <p>When you sign in with Google, Cadence requests permission to:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Your basic Google profile — your name, email address, and profile picture — to identify you.</li>
            <li>Your Google Calendar events (the <code>calendar.events</code> scope) — to read your schedule and, when you confirm, to create, update, or delete events.</li>
          </ul>
          <p>Google lets you decline the calendar permission on the consent screen; Cadence then limits itself accordingly.</p>
        </Section>

        <Section title="How your data is used">
          <p>
            Calendar data is fetched on demand to build the summary or to carry out a change you ask for in chat.
            To generate summaries and interpret your chat requests, the relevant event details are sent to the AI
            provider configured for the app (one of Google Gemini, Groq, Mistral, or OpenRouter). No change to your
            calendar is made without an explicit confirmation step in the app.
          </p>
        </Section>

        <Section title="What is stored">
          <p>
            Cadence has no database and does not store your calendar events on its servers. Your session — including
            the access token used to reach Google on your behalf — is kept in an encrypted cookie in your browser and
            is used only to serve your own requests. Closing your session or signing out ends that access.
          </p>
        </Section>

        <Section title="Sharing">
          <p>
            Your data is not sold, rented, or used for advertising. It is shared only with the services required to
            provide the feature you requested: Google (to read and change your calendar) and the configured AI
            provider (to generate a summary or interpret a request). It is not shared with anyone else.
          </p>
        </Section>

        <Section title="Google API Services User Data Policy">
          <p>
            Cadence&rsquo;s use and transfer of information received from Google APIs will adhere to the{" "}
            <a className="underline hover:text-foreground" href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements.
          </p>
        </Section>

        <Section title="Your choices">
          <p>
            You can revoke Cadence&rsquo;s access to your Google account at any time from your{" "}
            <a className="underline hover:text-foreground" href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">
              Google Account permissions
            </a>
            . Doing so immediately stops Cadence from accessing your calendar.
          </p>
        </Section>

        <Section title="Contact">
          <p>Questions about this policy? Contact {CONTACT}.</p>
        </Section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-6 text-sm text-muted-foreground">
          <span className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-primary" /> Cadence</span>
          <Link href="/" className="hover:text-foreground">Home</Link>
        </div>
      </footer>
    </div>
  );
}
