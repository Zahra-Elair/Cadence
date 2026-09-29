import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";

export function SignInButton({ label = "Continue with Google" }: { label?: string }) {
  return (
    <form action={async () => { "use server"; await signIn("google", { redirectTo: "/dashboard" }); }}>
      <Button type="submit" size="lg">{label}</Button>
    </form>
  );
}
