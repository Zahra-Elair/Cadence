"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "./ThemeToggle";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/calendar", label: "Calendar" },
  { href: "/assistant", label: "Assistant" },
];

export function Header({ user }: { user: { name?: string | null; email?: string | null; image?: string | null } }) {
  const pathname = usePathname();
  const initials = (user.name ?? user.email ?? "?").slice(0, 1).toUpperCase();
  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2 font-medium">
          <CalendarClock className="h-5 w-5 text-primary" />
          <span className="hidden sm:inline">Cadence</span>
        </Link>
        <nav className="flex items-center gap-1">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}
              className={cn("rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground",
                pathname === n.href && "bg-muted text-foreground")}>
              {n.label}
            </Link>
          ))}
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger className="ml-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Avatar className="h-8 w-8">
                {user.image ? <AvatarImage src={user.image} alt="" /> : null}
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="max-w-[200px] truncate font-normal text-muted-foreground">
                {user.email ?? user.name}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => signOut({ redirectTo: "/" })}>Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
      </div>
    </header>
  );
}
