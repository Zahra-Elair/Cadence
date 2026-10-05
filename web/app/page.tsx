import { redirect } from "next/navigation";
import Link from "next/link";
import { MessageSquareText, ShieldCheck, LayoutGrid, Sparkles, LogIn } from "lucide-react";
import { CadenceMark } from "@/components/CadenceMark";
import { auth } from "@/auth";
import { SignInButton } from "@/components/SignInButton";
import { ThemeToggle } from "@/components/ThemeToggle";

const FEATURES = [
  { icon: Sparkles, title: "Smart summaries", body: "Daily, weekly, and monthly overviews of your calendar, written for you." },
  { icon: MessageSquareText, title: "Chat to manage", body: "Create, move, and delete events in plain language — every change confirmed first." },
  { icon: LayoutGrid, title: "Week at a glance", body: "A clean week calendar with overlap-aware layout, plus quick add and edit." },
  { icon: ShieldCheck, title: "Free & private", body: "Runs on free AI providers you choose. Your calendar isn't sold or mined." },
];

const STEPS = [
  { n: "1", icon: LogIn, title: "Connect", body: "Sign in with Google in one click. Cadence asks only for calendar access." },
  { n: "2", icon: Sparkles, title: "See", body: "Get AI summaries and a week view that make your schedule instantly clear." },
  { n: "3", icon: MessageSquareText, title: "Command", body: "Tell Cadence to add, move, or clear events — it confirms before anything changes." },
];

export default async function Home() {
  const session = await auth();
  if (session) redirect("/app");

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <span className="flex items-center gap-2 font-semibold tracking-tight">
            <CadenceMark className="h-5 w-5 text-primary" /> Cadence
          </span>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <SignInButton label="Sign in" size="sm" variant="ghost" />
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative isolate overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[460px] bg-gradient-to-b from-primary/10 to-transparent" />
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:py-24 lg:grid-cols-2">
            <div className="flex flex-col items-start gap-6 text-left">
              <span className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-sm text-muted-foreground">
                <Sparkles className="h-4 w-4 text-primary" /> AI calendar assistant
              </span>
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                Command your week&rsquo;s <span className="text-primary">cadence</span>.
              </h1>
              <p className="max-w-xl text-lg text-muted-foreground">
                Cadence reads your Google Calendar, briefs you with AI summaries, and lets you create, move, and delete events just by chatting — with a confirmation step before anything changes.
              </p>
              <div className="flex flex-col items-start gap-3">
                <SignInButton />
                <span className="text-sm text-muted-foreground">Free · Works with your Google Calendar</span>
              </div>
            </div>
            <PreviewMock />
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-center text-sm font-medium uppercase tracking-wide text-muted-foreground">How it works</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-2xl border bg-card p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <s.icon className="h-5 w-5" />
                </div>
                <p className="mt-4 text-xs font-medium text-muted-foreground">Step {s.n}</p>
                <p className="mt-1 text-lg font-medium">{s.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-4 pb-16">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border bg-card p-5">
                <f.icon className="h-5 w-5 text-primary" />
                <p className="mt-3 font-medium">{f.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Closing CTA */}
        <section className="mx-auto max-w-6xl px-4 pb-24">
          <div className="overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/10 via-card to-card p-10 text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Ready to take command of your calendar?</h2>
            <p className="mx-auto mt-2 max-w-md text-muted-foreground">Connect your Google Calendar and let Cadence handle the busywork.</p>
            <div className="mt-6 flex justify-center"><SignInButton /></div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row">
          <span className="flex items-center gap-2"><CadenceMark className="h-4 w-4 text-primary" /> Cadence</span>
          <div className="flex items-center gap-4">
            <span>AI summaries &amp; chat for Google Calendar · Your data isn&rsquo;t sold or mined.</span>
            <Link href="/privacy" className="shrink-0 hover:text-foreground">Privacy</Link>
            <Link href="/terms" className="shrink-0 hover:text-foreground">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** A static mock of the product shown in the hero. */
function PreviewMock() {
  const rows: [string, string][] = [
    ["Wed · 9 – 6 PM", "Work"],
    ["Wed · 2 – 3 PM", "Hair appointment"],
    ["Fri · 5 – 6:30 PM", "Gym"],
  ];
  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-md rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex items-baseline justify-between">
          <p className="font-medium">This week</p>
          <p className="text-xs text-muted-foreground">12h · 5 events</p>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Busy midweek, lighter toward the weekend.</p>
        <div className="mt-4 overflow-hidden rounded-xl border">
          <div className="border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">Your schedule</div>
          <ul className="divide-y text-sm">
            {rows.map(([when, title]) => (
              <li key={title} className="flex items-baseline gap-3 px-3 py-2">
                <span className="w-28 shrink-0 tabular-nums text-muted-foreground">{when}</span>
                <span className="font-medium">{title}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-4 w-full max-w-md rounded-2xl border bg-card p-4 shadow-sm sm:ml-auto sm:mr-0 sm:w-80">
        <div className="flex justify-end">
          <span className="rounded-2xl bg-primary px-3 py-1.5 text-sm text-primary-foreground">clear friday afternoon</span>
        </div>
        <div className="mt-3 rounded-xl border border-destructive/40 p-3">
          <p className="text-sm font-medium">Delete &ldquo;Gym&rdquo; · Fri 5 PM</p>
          <div className="mt-2 flex gap-2">
            <span className="rounded-md bg-destructive px-2.5 py-1 text-xs text-white">Confirm delete</span>
            <span className="rounded-md px-2.5 py-1 text-xs text-muted-foreground">Cancel</span>
          </div>
        </div>
      </div>
    </div>
  );
}
