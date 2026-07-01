"use client";

import { useActionState, useEffect, useRef } from "react";
import { addTransactionAction } from "./actions";
import { emptyFormState, nativeSelectClass } from "@/lib/forms";
import {
  TXN_TYPES,
  TXN_TYPE_LABELS,
  type TxnType,
} from "@/lib/data/enums";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AccountOption = { id: string; label: string };
type CategoryOption = { id: string; name: string; kind: TxnType };

function todayISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function AddTransactionForm({
  accounts,
  categories,
}: {
  accounts: AccountOption[];
  categories: CategoryOption[];
}) {
  const [state, formAction, pending] = useActionState(
    addTransactionAction,
    emptyFormState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="occurred_date">Date</Label>
          <Input
            id="occurred_date"
            name="occurred_date"
            type="date"
            defaultValue={todayISO()}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="amount">Amount</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            placeholder="0.00"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="type">Type</Label>
          <select
            id="type"
            name="type"
            defaultValue="expense"
            className={nativeSelectClass}
          >
            {TXN_TYPES.map((t) => (
              <option key={t} value={t}>
                {TXN_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="account_id">Account</Label>
          <select
            id="account_id"
            name="account_id"
            defaultValue={accounts[0]?.id ?? ""}
            className={nativeSelectClass}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="category_id">Category (optional)</Label>
          <select
            id="category_id"
            name="category_id"
            defaultValue=""
            className={nativeSelectClass}
          >
            <option value="">— None —</option>
            {TXN_TYPES.map((kind) => {
              const inKind = categories.filter((c) => c.kind === kind);
              if (inKind.length === 0) return null;
              return (
                <optgroup key={kind} label={TXN_TYPE_LABELS[kind]}>
                  {inKind.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="merchant">Merchant (optional)</Label>
          <Input id="merchant" name="merchant" placeholder="Home Depot" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Input id="notes" name="notes" placeholder="" />
      </div>

      {state.error && <p className="text-sm text-critical">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Add transaction"}
      </Button>
    </form>
  );
}
