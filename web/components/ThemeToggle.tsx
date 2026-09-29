"use client";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  return (
    <Button variant="ghost" size="icon" aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}>
      <Sun className="size-5 hidden dark:block" />
      <Moon className="size-5 block dark:hidden" />
    </Button>
  );
}
