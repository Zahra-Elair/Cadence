import { signOut } from "@/auth";
import { Button } from "@/components/ui/button";

export function SignOutButton({ className }: { className?: string }) {
  return (
    <form className={className} action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
      <Button type="submit" variant="ghost" className="w-full justify-start px-2">Sign out</Button>
    </form>
  );
}
