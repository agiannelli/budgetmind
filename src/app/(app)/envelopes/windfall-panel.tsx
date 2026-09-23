"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { applyWindfallAction } from "./actions";
import { proposeWaterfall } from "@/lib/allocate/waterfall";
import type { Envelope } from "@/lib/envelope-types";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const num = (s: string) => {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

export function WindfallPanel({
  envelopes,
  monthlyExpenses,
}: {
  envelopes: Envelope[];
  monthlyExpenses: number;
}) {
  const [amount, setAmount] = useState("");
  // Only lines the user has hand-edited; everything else follows the engine's
  // live suggestion. Cleared when the amount changes, so no effect is needed.
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ applied: number; total: number } | null>(null);

  const amt = num(amount);
  const proposal = amt > 0 ? proposeWaterfall(amt, envelopes, monthlyExpenses) : null;

  // Displayed value for a line = the user's edit if any, else the suggestion.
  const lineValue = (id: string, suggested: number) =>
    overrides[id] ?? String(suggested);

  function changeAmount(v: string) {
    setAmount(v);
    setOverrides({});
    setDone(null);
    setError(null);
  }

  function reset() {
    setAmount("");
    setOverrides({});
    setError(null);
    setDone(null);
  }

  const allocated = proposal
    ? proposal.fills.reduce(
        (s, f) => s + num(lineValue(f.envelopeId, f.amount)),
        0,
      )
    : 0;
  const free = Math.round((amt - allocated) * 100) / 100;
  const overAllocated = free < -0.005;
  const nothingToAutoFill = proposal != null && proposal.totalFilled === 0;

  async function approve() {
    if (!proposal) return;
    if (overAllocated) return setError("That's more than the windfall — trim a line.");
    setError(null);
    setPending(true);
    const fills = proposal.fills.map((f) => ({
      envelopeId: f.envelopeId,
      amount: num(lineValue(f.envelopeId, f.amount)),
      rationale: f.rationale || null,
    }));
    const res = await applyWindfallAction({ fills });
    setPending(false);
    if (res.error) return setError(res.error);
    setDone({ applied: res.applied ?? 0, total: res.total ?? 0 });
    setAmount("");
    setOverrides({});
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-primary" />
          Allocate a windfall
        </CardTitle>
        <CardDescription>
          Money in — a vest, bonus, or spare cash. Enter an amount and we&apos;ll
          propose a split down your priority order; approve or adjust.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {done && (
          <div className="space-y-3">
            <p className="text-sm">
              Allocated{" "}
              <span className="font-semibold text-positive">
                {formatCurrency(done.total)}
              </span>{" "}
              across {done.applied} envelope{done.applied === 1 ? "" : "s"}.
            </p>
            <Button size="sm" variant="ghost" onClick={reset}>
              Allocate another
            </Button>
          </div>
        )}

        {!done && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="windfall-amount">Amount</Label>
              <Input
                id="windfall-amount"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                placeholder="6000"
                value={amount}
                onChange={(e) => changeAmount(e.target.value)}
                className="w-40"
              />
            </div>

            {proposal && (
              <div className="space-y-3">
                {nothingToAutoFill && (
                  <p className="rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">
                    None of your envelopes has a dollar target yet, so there&apos;s
                    nothing to fill automatically. Set a{" "}
                    <span className="font-medium text-foreground">Target amount</span>{" "}
                    on an envelope (Edit) to get a real suggestion — or just type
                    amounts below to split it by hand.
                  </p>
                )}

                <div className="space-y-2">
                  {proposal.fills.map((f) => (
                    <div key={f.envelopeId} className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{f.name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {f.rationale}
                          {f.room != null && ` · room ${formatCurrency(f.room)}`}
                        </div>
                      </div>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        inputMode="decimal"
                        value={lineValue(f.envelopeId, f.amount)}
                        onChange={(e) =>
                          setOverrides((o) => ({
                            ...o,
                            [f.envelopeId]: e.target.value,
                          }))
                        }
                        className="w-32 text-right"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between border-t pt-3 text-sm">
                  <span className="text-muted-foreground">
                    Allocated {formatCurrency(allocated)} ·{" "}
                    <span
                      className={cn(
                        "font-medium",
                        overAllocated ? "text-critical" : "text-foreground",
                      )}
                    >
                      {overAllocated ? "over by " : "free "}
                      {formatCurrency(Math.abs(free))}
                    </span>
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={approve}
                      disabled={pending || overAllocated || allocated <= 0}
                    >
                      {pending ? "Applying…" : "Approve"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={reset} disabled={pending}>
                      Clear
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {error && <p className="text-sm text-critical">{error}</p>}
      </CardContent>
    </Card>
  );
}
