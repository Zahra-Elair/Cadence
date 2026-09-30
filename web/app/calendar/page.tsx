import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SignInButton } from "@/components/SignInButton";
import { SignOutButton } from "@/components/SignOutButton";
import { Header } from "@/components/Header";
import { CalendarClient } from "@/components/CalendarClient";

export default async function CalendarPage() {
  const session = await auth();
  if (!session) redirect("/");
  if (session.calendarGranted === false) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-5 px-4 text-center">
        <h1 className="text-2xl font-medium">Calendar access needed</h1>
        <p className="text-muted-foreground">This app needs access to your Google Calendar. Please sign in again and allow it.</p>
        <SignInButton label="Sign in and allow access" />
        <SignOutButton />
      </main>
    );
  }
  return (
    <>
      <Header user={{ name: session.user?.name, email: session.user?.email, image: session.user?.image }} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <h1 className="mb-6 text-2xl font-medium">Calendar</h1>
        <CalendarClient />
      </main>
    </>
  );
}
