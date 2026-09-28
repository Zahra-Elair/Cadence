import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { SignInButton } from "@/components/SignInButton";
import { SignOutButton } from "@/components/SignOutButton";
import { ChatClient } from "@/components/ChatClient";

export default async function AssistantPage() {
  const session = await auth();
  if (!session) redirect("/");
  if (session.calendarGranted === false) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-5 p-6 text-center">
        <h1 className="text-2xl font-bold">Calendar access needed</h1>
        <p className="text-gray-600">The assistant needs read+write access to your Google Calendar. Please sign in again and allow it.</p>
        <SignInButton />
        <SignOutButton />
      </main>
    );
  }
  return (
    <main className="mx-auto max-w-2xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Calendar assistant</h1>
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <Link href="/dashboard" className="hover:text-black">Summary</Link>
          <SignOutButton />
        </div>
      </header>
      <ChatClient />
    </main>
  );
}
