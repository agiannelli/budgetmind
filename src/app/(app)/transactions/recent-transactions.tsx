"use client";

import { useState } from "react";
import { editTransactionAction } from "./actions";
import { nativeSelectClass } from "@/lib/forms";
import { TXN_TYPES, TXN_TYPE_LABELS, type TxnType } from "@/lib/data/enums";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type TxnView = {
  id: string;
  occurred_date: string;
  amount: number;
  type: TxnType;
  merchant_raw: string | null;
  notes: string | null;
  category_id: string | null;
  category_name: string | null;
  account_id: string;
  account_label: string;
};
type AccountOption = { id: string; label: string };
type CategoryOption = { id: string; name: string; kind: TxnType };

type Draft = {
  occurred_date: string;
  amount: string;
  type: TxnType;
  account_id: string;
  category_id: string;
  merchant: string;
  notes: string;
};

export function RecentTransactions({
  transactions,
  accounts,
  categories,
}: {
  transactions: TxnView[];
  accounts: AccountOption[];
  categories: CategoryOption[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit(t: TxnView) {
    setError(null);
    setEditingId(t.id);
    setDraft({
      occurred_date: t.occurred_date,
      amount: String(Math.abs(t.amount)),
      type: t.type,
      account_id: t.account_id,
      category_id: t.category_id ?? "",
      merchant: t.merchant_raw ?? "",
      notes: t.notes ?? "",
    });
  }

  function cancel() {
    setEditingId(null);
    setDraft(null);
    setError(null);
  }

  async function save(id: string) {
    if (!draft) return;
    setError(null);
    setPending(true);
    const res = await editTransactionAction({
      id,
      account_id: draft.account_id,
      occurred_date: draft.occurred_date,
      amount: Number(draft.amount),
      type: draft.type,
      merchant: draft.merchant,
      category_id: draft.category_id || null,
      notes: draft.notes,
    });
    setPending(false);
    if (res.error) return setError(res.error);
    cancel();
  }

  const set = (patch: Partial<Draft>) =>
    setDraft((d) => (d ? { ...d, ...patch } : d));

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Merchant</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Account</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead className="w-16 text-right">Edit</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((t) => {
          const isEditing = editingId === t.id;
          if (isEditing && draft) {
            return (
              <TableRow key={t.id} className="bg-muted/40 align-top">
                <TableCell colSpan={6} className="p-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor={`date-${t.id}`}>Date</Label>
                      <Input
                        id={`date-${t.id}`}
                        type="date"
                        value={draft.occurred_date}
                        onChange={(e) => set({ occurred_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`amount-${t.id}`}>Amount</Label>
                      <Input
                        id={`amount-${t.id}`}
                        type="number"
                        step="0.01"
                        min="0"
                        inputMode="decimal"
                        value={draft.amount}
                        onChange={(e) => set({ amount: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`type-${t.id}`}>Type</Label>
                      <select
                        id={`type-${t.id}`}
                        value={draft.type}
                        onChange={(e) => set({ type: e.target.value as TxnType })}
                        className={nativeSelectClass}
                      >
                        {TXN_TYPES.map((ty) => (
                          <option key={ty} value={ty}>
                            {TXN_TYPE_LABELS[ty]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`account-${t.id}`}>Account</Label>
                      <select
                        id={`account-${t.id}`}
                        value={draft.account_id}
                        onChange={(e) => set({ account_id: e.target.value })}
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
                      <Label htmlFor={`category-${t.id}`}>Category</Label>
                      <select
                        id={`category-${t.id}`}
                        value={draft.category_id}
                        onChange={(e) => set({ category_id: e.target.value })}
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
                      <Label htmlFor={`merchant-${t.id}`}>Merchant</Label>
                      <Input
                        id={`merchant-${t.id}`}
                        value={draft.merchant}
                        onChange={(e) => set({ merchant: e.target.value })}
                        placeholder="Home Depot"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor={`notes-${t.id}`}>Notes</Label>
                      <Input
                        id={`notes-${t.id}`}
                        value={draft.notes}
                        onChange={(e) => set({ notes: e.target.value })}
                      />
                    </div>
                  </div>

                  {error && <p className="mt-3 text-sm text-critical">{error}</p>}

                  <div className="mt-4 flex gap-2">
                    <Button size="sm" onClick={() => save(t.id)} disabled={pending}>
                      {pending ? "Saving…" : "Save"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={cancel}
                      disabled={pending}
                    >
                      Cancel
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          }

          return (
            <TableRow key={t.id}>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {formatDate(t.occurred_date)}
              </TableCell>
              <TableCell className="font-medium">{t.merchant_raw ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">
                {t.category_name ?? "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {t.account_label}
              </TableCell>
              <TableCell
                className={cn(
                  "text-right tabular-nums",
                  t.amount > 0 && "text-positive",
                )}
              >
                {formatCurrency(t.amount)}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => startEdit(t)}
                  disabled={editingId !== null}
                >
                  Edit
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
