"use client";

import { useRef, useState } from "react";
import { Search } from "lucide-react";
import { editTransactionAction, searchTransactionsAction } from "./actions";
import { nativeSelectClass } from "@/lib/forms";
import { TXN_TYPES, TXN_TYPE_LABELS, type TxnType } from "@/lib/data/enums";
import type { Transaction } from "@/lib/data/transactions";
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

type AccountOption = { id: string; label: string };
type CategoryOption = { id: string; name: string; kind: TxnType };

type Filters = {
  q: string;
  categoryId: string;
  accountId: string;
  type: "" | TxnType;
  from: string;
  to: string;
};

type Draft = {
  occurred_date: string;
  amount: string;
  type: TxnType;
  account_id: string;
  category_id: string;
  merchant: string;
  notes: string;
};

const EMPTY: Filters = {
  q: "",
  categoryId: "",
  accountId: "",
  type: "",
  from: "",
  to: "",
};

export function TransactionsBrowser({
  initialRows,
  initialTotal,
  accounts,
  categories,
}: {
  initialRows: Transaction[];
  initialTotal: number;
  accounts: AccountOption[];
  categories: CategoryOption[];
}) {
  const [rows, setRows] = useState<Transaction[]>(initialRows);
  const [total, setTotal] = useState(initialTotal);
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const catName = (id: string | null) =>
    id ? (categories.find((c) => c.id === id)?.name ?? null) : null;
  const acctLabel = (id: string) =>
    accounts.find((a) => a.id === id)?.label ?? "—";

  async function fetchPage(f: Filters, replace: boolean) {
    setError(null);
    setLoading(true);
    const res = await searchTransactionsAction({
      filters: {
        q: f.q.trim() || undefined,
        categoryId: f.categoryId || undefined,
        accountId: f.accountId || undefined,
        type: f.type || undefined,
        from: f.from || undefined,
        to: f.to || undefined,
      },
      offset: replace ? 0 : rows.length,
    });
    setLoading(false);
    if (res.error) return setError(res.error);
    setRows(replace ? res.rows : [...rows, ...res.rows]);
    setTotal(res.total);
  }

  function applyFilter(patch: Partial<Filters>, debounce = false) {
    const next = { ...filters, ...patch };
    setFilters(next);
    if (editingId) cancel();
    if (debounce) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => fetchPage(next, true), 350);
    } else {
      fetchPage(next, true);
    }
  }

  function clearFilters() {
    setFilters(EMPTY);
    fetchPage(EMPTY, true);
  }

  function startEdit(t: Transaction) {
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
  }

  const set = (patch: Partial<Draft>) =>
    setDraft((d) => (d ? { ...d, ...patch } : d));

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

    // Optimistically reflect the edit in place, so pagination isn't lost.
    const mag = Math.abs(Number(draft.amount));
    const signed = draft.type === "income" ? mag : -mag;
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              occurred_date: draft.occurred_date,
              amount: signed,
              type: draft.type,
              merchant_raw: draft.merchant.trim() || null,
              notes: draft.notes.trim() || null,
              category_id: draft.category_id || null,
              category_name: catName(draft.category_id || null),
              account_id: draft.account_id,
              account_label: acctLabel(draft.account_id),
            }
          : r,
      ),
    );
    cancel();
  }

  const hasMore = rows.length < total;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.q}
            onChange={(e) => applyFilter({ q: e.target.value }, true)}
            placeholder="Search merchant"
            className="pl-8"
            aria-label="Search merchant"
          />
        </div>
        <select
          value={filters.categoryId}
          onChange={(e) => applyFilter({ categoryId: e.target.value })}
          className={nativeSelectClass}
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
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
        <select
          value={filters.accountId}
          onChange={(e) => applyFilter({ accountId: e.target.value })}
          className={nativeSelectClass}
          aria-label="Filter by account"
        >
          <option value="">All accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
        <select
          value={filters.type}
          onChange={(e) => applyFilter({ type: e.target.value as "" | TxnType })}
          className={nativeSelectClass}
          aria-label="Filter by type"
        >
          <option value="">All types</option>
          {TXN_TYPES.map((t) => (
            <option key={t} value={t}>
              {TXN_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1.5">
          <Label htmlFor="from" className="sr-only">
            From
          </Label>
          <Input
            id="from"
            type="date"
            value={filters.from}
            onChange={(e) => applyFilter({ from: e.target.value })}
            aria-label="From date"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            id="to"
            type="date"
            value={filters.to}
            onChange={(e) => applyFilter({ to: e.target.value })}
            aria-label="To date"
          />
        </div>
        <div className="flex items-center">
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {loading
          ? "Loading…"
          : `Showing ${rows.length} of ${total} transaction${total === 1 ? "" : "s"}`}
      </p>

      {error && <p className="text-sm text-critical">{error}</p>}

      {rows.length === 0 && !loading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No transactions match these filters.
        </p>
      ) : (
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
            {rows.map((t) => {
              if (editingId === t.id && draft) {
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
      )}

      {hasMore && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchPage(filters, false)}
            disabled={loading}
          >
            {loading ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
