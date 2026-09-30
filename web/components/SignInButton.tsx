import type { ComponentProps } from "react";
import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";

export function SignInButton({
  label = "Continue with Google",
  size = "lg",
  variant = "default",
}: {
  label?: string;
  size?: ComponentProps<typeof Button>["size"];
  variant?: ComponentProps<typeof Button>["variant"];
}) {
  return (
    <form action={async () => { "use server"; await signIn("google", { redirectTo: "/dashboard" }); }}>
      <Button type="submit" size={size} variant={variant}>{label}</Button>
    </form>
  );
}
