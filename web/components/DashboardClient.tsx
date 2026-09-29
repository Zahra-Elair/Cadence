"use client";
import { useEffect, useReducer } from "react";
import { DateTime } from "luxon";
import { signIn } from "next-auth/react";
import type { Period } from "@/lib/engine/types";
import { generateSummary } from "@/lib/actions";
import { initialSummaryState, summaryReducer, shouldFetch } from "@/lib/dashboard/summary-state";
import { SummaryView } from "./SummaryView";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const TABS: { value: Period; label: string }[] = [
  { value: "daily", label: "Day" },
  { value: "weekly", label: "Week" },
  { value: "monthly", label: "Month" },
];

export function DashboardClient() {
  const [state, dispatch] = useReducer(summaryReducer, undefined, () => initialSummaryState("weekly"));
  const period = state.period;

  useEffect(() => {
    if (!shouldFetch(state, period)) return;
    let cancelled = false;
    dispatch({ type: "loading", period });
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const date = DateTime.now().toISODate()!;
    generateSummary({ period, date, zone }).then((res) => {
      if (cancelled) return;
      if (res.ok) dispatch({ type: "loaded", period, summary: res.summary });
      else dispatch({ type: "error", period, error: res.error, needsSignIn: Boolean(res.needsSignIn) });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const cell = state.byPeriod[period];

  return (
    <div className="space-y-6">
      <Tabs value={period} onValueChange={(v) => dispatch({ type: "select", period: v as Period })}>
        <TabsList>
          {TABS.map((t) => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      {(!cell || cell.status === "loading") && (
        <Card><CardContent className="space-y-4 p-6">
          <Skeleton className="h-6 w-3/4" />
          <div className="grid grid-cols-2 gap-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
          <Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-2/3" />
        </CardContent></Card>
      )}

      {cell?.status === "error" && (
        <Alert variant="destructive">
          <AlertDescription className="space-y-3">
            <p>{cell.error}</p>
            {cell.needsSignIn && (
              <Button onClick={() => signIn("google", { redirectTo: "/dashboard" })}>Sign in with Google</Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {cell?.status === "loaded" && (cell.summary.empty
        ? <Card><CardContent className="p-6 text-muted-foreground">Nothing scheduled for this period.</CardContent></Card>
        : <Card><CardContent className="p-6"><SummaryView summary={cell.summary} /></CardContent></Card>)}
    </div>
  );
}
