import { redirect } from "next/navigation";
import { CalendarClock, MessageSquareText, ShieldCheck } from "lucide-react";
import { auth } from "@/auth";
import { SignInButton } from "@/components/SignInButton";
import { Card, CardContent } from "@/components/ui/card";

const FEATURES = [
  { icon: CalendarClock, title: "Smart summaries", body: "Daily, weekly, and monthly overviews of your calendar, written for you." },
  { icon: MessageSquareText, title: "Chat to manage events", body: "Create, move, and delete events in plain language — every change is confirmed first." },
  { icon: ShieldCheck, title: "Free and private", body: "Runs on free AI providers you choose. Your calendar isn't sold or mined." },
];

export default async function Home() {
  const session = await auth();
  if (session) redirect("/dashboard");
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-10 px-4 py-16 text-center">
      <div className="flex flex-col items-center gap-5">
        <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm text-muted-foreground">
          <CalendarClock className="h-4 w-4 text-primary" /> Calendar Summarizer
        </span>
        <h1 className="text-4xl font-medium tracking-tight sm:text-5xl">Your calendar, summarized.</h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          AI summaries of your Google Calendar and a chat assistant that manages your events — with a confirmation step before anything changes.
        </p>
        <SignInButton />
      </div>
      <div className="grid w-full gap-4 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <Card key={f.title} className="text-left">
            <CardContent className="flex flex-col gap-2 p-5">
              <f.icon className="h-5 w-5 text-primary" />
              <p className="font-medium">{f.title}</p>
              <p className="text-sm text-muted-foreground">{f.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
