"use client";

import { useState } from "react";
import { Plus, Repeat } from "lucide-react";
import { addRecurringItemAction, removeRecurringItemAction } from "./actions";
import {
  CADENCE_LABELS,
  RECURRING_CADENCES,
  monthlyEquivalent,
  type RecurringItem,
  type RecurringCandidate,
  type RecurringCadence,
} from "@/lib/recurring-types";
import { nativeSelectClass } from "@/lib/forms";
import { formatCurrency } from "@/lib/format";
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

export function RecurringBills({
  items,
  candidates,
}: {
  items: RecurringItem[];
  candidates: RecurringCandidate[];
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [merchant, setMerchant] = useState("");
  const [cadence, setCadence] = useState<RecurringCadence>("monthly");
  const [amount, setAmount] = useState("");
  const [pending, setPending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const monthlyTotal = items.reduce(
    (s, i) => s + monthlyEquivalent(i.amount, i.cadence),
    0,
  );

  async function track(c: RecurringCandidate) {
    setBusyId(`c:${c.match_merchant}`);
    await addRecurringItemAction({
      name: c.name,
      cadence: c.cadence,
      amount: c.amount,
      category_id: c.category_id,
      match_merchant: c.match_merchant,
    });
    setBusyId(null);
  }

  async function remove(id: string) {
    setBusyId(id);
    await removeRecurringItemAction(id);
    setBusyId(null);
  }

  async function submitManual() {
    if (!name.trim()) return setError("Name the bill.");
    const amt = Number(amount);
    if (!(amt > 0)) return setError("Enter the amount per charge.");
    setError(null);
    setPending(true);
    const res = await addRecurringItemAction({
      name,
      cadence,
      amount: amt,
      match_merchant: merchant.trim() || name,
    });
    setPending(false);
    if (res.error) return setError(res.error);
    setName("");
    setMerchant("");
    setCadence("monthly");
    setAmount("");
    setAdding(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Repeat className="size-4 text-primary" />
          Recurring bills
        </CardTitle>
        <CardDescription>
          Quarterly and yearly bills, amortized into your monthly baseline so they
          don&apos;t land as lumps.
          {monthlyTotal > 0 && (
            <>
              {" "}
              <span className="font-medium text-foreground">
                ~{formatCurrency(monthlyTotal)}/mo
              </span>{" "}
              tracked.
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((i) => (
              <div
                key={i.id}
                className="flex items-center gap-3 rounded-md border p-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{i.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {CADENCE_LABELS[i.cadence]} · {formatCurrency(i.amount)}/charge
                    {i.category_name ? ` · ${i.category_name}` : ""}
                  </div>
                </div>
                <div className="shrink-0 tabular-nums text-muted-foreground">
                  ~{formatCurrency(monthlyEquivalent(i.amount, i.cadence))}/mo
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 shrink-0 px-2"
                  onClick={() => remove(i.id)}
                  disabled={busyId === i.id}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}

        {candidates.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Detected from repeating charges — track one to amortize it:
            </p>
            <div className="flex flex-wrap gap-2">
              {candidates.map((c) => (
                <button
                  key={c.match_merchant}
                  type="button"
                  onClick={() => track(c)}
                  disabled={busyId !== null}
                  title={`${CADENCE_LABELS[c.cadence]} · ~${formatCurrency(
                    monthlyEquivalent(c.amount, c.cadence),
                  )}/mo · seen ${c.occurrences}×`}
                  className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors hover:bg-accent disabled:opacity-50"
                >
                  <Plus className="size-3.5 text-muted-foreground" />
                  <span>{c.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {CADENCE_LABELS[c.cadence]} · {formatCurrency(c.amount)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {adding ? (
          <div className="space-y-3 rounded-md border p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="rb-name">Name</Label>
                <Input
                  id="rb-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Cat insurance"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rb-amount">Amount per charge</Label>
                <Input
                  id="rb-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="2255"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rb-cadence">Cadence</Label>
                <select
                  id="rb-cadence"
                  value={cadence}
                  onChange={(e) => setCadence(e.target.value as RecurringCadence)}
                  className={nativeSelectClass}
                >
                  {RECURRING_CADENCES.map((c) => (
                    <option key={c} value={c}>
                      {CADENCE_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rb-merchant">Matches merchant (optional)</Label>
                <Input
                  id="rb-merchant"
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                  placeholder="International Cat Insurance"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={submitManual} disabled={pending}>
                {pending ? "Saving…" : "Add bill"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setAdding(false)}
                disabled={pending}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
            Add a bill manually
          </Button>
        )}

        {error && <p className="text-sm text-critical">{error}</p>}
      </CardContent>
    </Card>
  );
}
