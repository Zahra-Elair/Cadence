import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SignInButton } from "@/components/SignInButton";
import { SignOutButton } from "@/components/SignOutButton";
import { Header } from "@/components/Header";
import { ChatClient } from "@/components/ChatClient";

export default async function AssistantPage() {
  const session = await auth();
  if (!session) redirect("/");
  if (session.calendarGranted === false) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-5 px-4 text-center">
        <h1 className="text-2xl font-medium">Calendar access needed</h1>
        <p className="text-muted-foreground">The assistant needs read and write access to your Google Calendar. Please sign in again and allow it.</p>
        <SignInButton label="Sign in and allow access" />
        <SignOutButton />
      </main>
    );
  }
  return (
    <>
      <Header user={{ name: session.user?.name, email: session.user?.email, image: session.user?.image }} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-medium">Assistant</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ask about your schedule or make changes in plain language — every change is confirmed first.</p>
        </div>
        <ChatClient />
      </main>
    </>
  );
}
