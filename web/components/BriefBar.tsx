"use client";
import { useEffect, useState } from "react";
import type { Period, Summary } from "@/lib/engine/types";
import { generateSummary } from "@/lib/actions";
import { SummaryView } from "./SummaryView";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS: { value: Period; label: string }[] = [
  { value: "daily", label: "Day" },
  { value: "weekly", label: "Week" },
  { value: "monthly", label: "Month" },
];

function firstSentence(s: string): string {
  const m = /^(.*?[.!?])(\s|$)/.exec(s.trim());
  return m ? m[1] : s.trim();
}

export function BriefBar({ anchorISODate, todayISODate, zone }: { anchorISODate: string; todayISODate: string; zone: string }) {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState<Period>("weekly");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [error, setError] = useState("");

  // Day summarizes today; week/month summarize the viewed week's window.
  const date = period === "daily" ? todayISODate : anchorISODate;

  useEffect(() => {
    let alive = true;
    setStatus("loading");
    generateSummary({ period, date, zone })
      .then((res) => {
        if (!alive) return;
        if (res.ok) { setSummary(res.summary); setStatus("ok"); }
        else { setError(res.error); setStatus("error"); }
      })
      .catch(() => { if (alive) { setError("Couldn't load the brief."); setStatus("error"); } });
    return () => { alive = false; };
  }, [period, date, zone]);

  const oneLiner =
    status === "loading" ? "Summarizing…"
    : status === "error" ? error
    : summary && !summary.empty
      ? `${firstSentence(summary.overview)} · ${summary.timeBreakdown} · ${summary.eventCount} ${summary.eventCount === 1 ? "event" : "events"}`
      : "Nothing scheduled this week.";

  return (
    <div className="rounded-2xl border bg-card">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
        <span className="min-w-0 truncate text-sm">
          <span className="font-medium">Brief</span>
          <span className="text-muted-foreground"> · {oneLiner}</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="space-y-4 border-t p-4">
          <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <TabsList>{TABS.map((t) => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}</TabsList>
          </Tabs>
          {status === "loading" && (
            <div className="space-y-3"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-20" /></div>
          )}
          {status === "error" && <p className="text-sm text-destructive">{error}</p>}
          {status === "ok" && summary && (summary.empty
            ? <p className="text-sm text-muted-foreground">Nothing scheduled for this period.</p>
            : <SummaryView summary={summary} />)}
        </div>
      )}
    </div>
  );
}
