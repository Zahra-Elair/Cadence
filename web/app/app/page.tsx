import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SignInButton } from "@/components/SignInButton";
import { SignOutButton } from "@/components/SignOutButton";
import { Header } from "@/components/Header";
import { WorkspaceClient } from "@/components/WorkspaceClient";

export default async function AppPage() {
  const session = await auth();
  if (!session) redirect("/");
  if (session.calendarGranted === false) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-5 px-4 text-center">
        <h1 className="text-2xl font-medium">Calendar access needed</h1>
        <p className="text-muted-foreground">Cadence needs read and write access to your Google Calendar. Please sign in again and allow it.</p>
        <SignInButton label="Sign in and allow access" />
        <SignOutButton />
      </main>
    );
  }
  return (
    <>
      <Header user={{ name: session.user?.name, email: session.user?.email, image: session.user?.image }} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <WorkspaceClient />
      </main>
    </>
  );
}
