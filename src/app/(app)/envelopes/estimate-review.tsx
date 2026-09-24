"use client";

import { useState } from "react";
import { setBaselineExclusionAction } from "./actions";
import type { LargePurchase } from "@/lib/data/spending";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function EstimateReview({
  monthlyExpenses,
  monthsObserved,
  excludedCount,
  recurringMonthly,
  variableMonthly,
  purchases,
}: {
  monthlyExpenses: number;
  monthsObserved: number;
  excludedCount: number;
  recurringMonthly: number;
  variableMonthly: number;
  purchases: LargePurchase[];
}) {
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function toggle(p: LargePurchase) {
    setBusyId(p.id);
    await setBaselineExclusionAction(p.id, !p.excluded);
    setBusyId(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Monthly spending estimate</CardTitle>
        <CardDescription>
          Sizes months-based goals like your emergency fund.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">
          {monthlyExpenses > 0 ? (
            <>
              <span className="font-semibold tabular-nums">
                {formatCurrency(monthlyExpenses)}
              </span>
              <span className="text-muted-foreground">
                {" "}
                / month · averaged over {monthsObserved} month
                {monthsObserved === 1 ? "" : "s"}
                {excludedCount > 0 &&
                  ` · ${excludedCount} one-off${
                    excludedCount === 1 ? "" : "s"
                  } excluded`}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">
              No spending yet — import or add transactions to build an estimate.
            </span>
          )}
        </p>

        {monthlyExpenses > 0 && recurringMonthly > 0 && (
          <p className="text-xs text-muted-foreground">
            {formatCurrency(recurringMonthly)}/mo recurring bills (amortized) +{" "}
            {formatCurrency(variableMonthly)}/mo variable spend.
          </p>
        )}

        {purchases.length > 0 && (
          <div className="space-y-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)}>
              {open ? "Hide large purchases" : "Review large purchases"}
            </Button>

            {open && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Exclude one-off purchases (a car, a vacation, a big repair) so
                  they don&apos;t inflate your monthly baseline. Recurring costs
                  should stay in.
                </p>
                {purchases.map((p) => (
                  <div
                    key={p.id}
                    className={cn(
                      "flex items-center gap-3 rounded-md border p-2 text-sm",
                      p.excluded && "opacity-60",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {p.merchant ?? "—"}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {formatDate(p.occurred_date)} ·{" "}
                        {p.category_name ?? "Uncategorized"} ·{" "}
                        {p.occurrences === 1
                          ? "seen once — likely one-off"
                          : `seen ${p.occurrences}× — likely recurring`}
                      </div>
                    </div>
                    <div className="shrink-0 tabular-nums">
                      {formatCurrency(p.amount)}
                    </div>
                    <Button
                      size="sm"
                      variant={p.excluded ? "secondary" : "ghost"}
                      className="h-7 shrink-0 px-2"
                      onClick={() => toggle(p)}
                      disabled={busyId === p.id}
                    >
                      {busyId === p.id
                        ? "…"
                        : p.excluded
                          ? "Excluded"
                          : "Exclude"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
