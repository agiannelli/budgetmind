"use client";

import { useState } from "react";
import Link from "next/link";
import {
  parseStatementAction,
  commitImportAction,
  confirmMatchAction,
} from "./actions";
import type { ProposedMatch } from "@/lib/data/reconcile";
import { nativeSelectClass } from "@/lib/forms";
import {
  TXN_TYPES,
  TXN_TYPE_LABELS,
  type TxnType,
} from "@/lib/data/enums";
import type { ImportMode, ParsedRow } from "@/lib/import-types";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
type Row = ParsedRow & { include: boolean };
type Phase = "input" | "review" | "done";

export function ImportClient({
  accounts,
  categories,
}: {
  accounts: AccountOption[];
  categories: CategoryOption[];
}) {
  const [phase, setPhase] = useState<Phase>("input");
  const [text, setText] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [mode, setMode] = useState<ImportMode>("current");
  const [rows, setRows] = useState<Row[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    inserted: number;
    skipped: number;
    merged: number;
  } | null>(null);
  const [proposals, setProposals] = useState<ProposedMatch[]>([]);
  const [resolving, setResolving] = useState<string | null>(null);

  const catById = new Map(categories.map((c) => [c.id, c.name]));
  const catName = (id: string | null) =>
    id ? (catById.get(id) ?? "Uncategorized") : "Uncategorized";

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setText(await file.text());
  }

  async function handleParse() {
    setError(null);
    setPending(true);
    const res = await parseStatementAction({ text });
    setPending(false);
    if (res.error) return setError(res.error);
    const parsed = (res.rows ?? []).map((r) => ({ ...r, include: true }));
    if (parsed.length === 0) {
      return setError("No transactions found in that text.");
    }
    setRows(parsed);
    setPhase("review");
  }

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function handleCommit() {
    setError(null);
    setPending(true);
    const included = rows
      .filter((r) => r.include)
      .map(({ ...r }) => r as ParsedRow);
    const res = await commitImportAction({ accountId, mode, rows: included });
    setPending(false);
    if (res.error) return setError(res.error);
    setResult({
      inserted: res.inserted ?? 0,
      skipped: res.skipped ?? 0,
      merged: res.merged ?? 0,
    });
    setProposals(res.proposals ?? []);
    setPhase("done");
  }

  const matchKey = (p: ProposedMatch) => `${p.feedId}:${p.manualId}`;

  async function handleConfirmMatch(p: ProposedMatch) {
    setError(null);
    setResolving(matchKey(p));
    const res = await confirmMatchAction({ feedId: p.feedId, manualId: p.manualId });
    setResolving(null);
    if (res.error) return setError(res.error);
    // Merged: drop it, and reflect the retired provisional in the summary.
    setProposals((prev) => prev.filter((x) => matchKey(x) !== matchKey(p)));
    setResult((r) => (r ? { ...r, merged: r.merged + 1 } : r));
  }

  function handleDismissMatch(p: ProposedMatch) {
    // "Keep both" — nothing to persist; medium matches were never applied.
    setProposals((prev) => prev.filter((x) => matchKey(x) !== matchKey(p)));
  }

  function reset() {
    setPhase("input");
    setText("");
    setRows([]);
    setResult(null);
    setProposals([]);
    setError(null);
  }

  const includedCount = rows.filter((r) => r.include).length;

  // ---- Done ----------------------------------------------------------------
  if (phase === "done" && result) {
    return (
      <div className="space-y-4">
        <p className="text-sm">
          Imported <span className="font-semibold text-positive">{result.inserted}</span>{" "}
          transaction{result.inserted === 1 ? "" : "s"}
          {result.skipped > 0 && (
            <>
              {" "}
              · skipped{" "}
              <span className="font-medium">{result.skipped}</span> already-imported
              duplicate{result.skipped === 1 ? "" : "s"}
            </>
          )}
          .
        </p>
        {result.merged > 0 && (
          <p className="text-sm text-muted-foreground">
            Auto-merged{" "}
            <span className="font-medium text-foreground">{result.merged}</span> of
            your provisional entr{result.merged === 1 ? "y" : "ies"} that these
            covered — no duplicates.
          </p>
        )}
        {proposals.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm">
              <span className="font-medium">{proposals.length}</span> possible
              match{proposals.length === 1 ? "" : "es"} to something you logged
              yourself. Merge if it&apos;s the same transaction, or keep both.
            </p>
            {proposals.map((p) => {
              const key = matchKey(p);
              const drift = Math.abs(p.amountDelta);
              return (
                <div key={key} className="space-y-2 rounded-md border p-3 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-0.5">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        You logged
                      </div>
                      <div className="font-medium">{p.manual.merchant ?? "—"}</div>
                      <div className="text-muted-foreground">
                        {p.manual.occurred_date} · {formatCurrency(p.manual.amount)} ·{" "}
                        {catName(p.manual.category_id)}
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        Imported
                      </div>
                      <div className="font-medium">{p.feed.merchant ?? "—"}</div>
                      <div className="text-muted-foreground">
                        {p.feed.occurred_date} · {formatCurrency(p.feed.amount)} ·{" "}
                        {catName(p.feed.category_id)}
                      </div>
                    </div>
                  </div>
                  {(drift >= 0.01 || p.dayGap > 0) && (
                    <p className="text-xs text-muted-foreground">
                      {drift >= 0.01 && (
                        <>Amount differs by {formatCurrency(drift)}</>
                      )}
                      {drift >= 0.01 && p.dayGap > 0 && " · "}
                      {p.dayGap > 0 && (
                        <>
                          {p.dayGap} day{p.dayGap === 1 ? "" : "s"} apart
                        </>
                      )}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleConfirmMatch(p)}
                      disabled={resolving === key}
                    >
                      {resolving === key ? "Merging…" : "Merge"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDismissMatch(p)}
                      disabled={resolving === key}
                    >
                      Keep both
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-3">
          <Button asChild>
            <Link href="/transactions">View transactions</Link>
          </Button>
          <Button variant="ghost" onClick={reset}>
            Import more
          </Button>
        </div>
      </div>
    );
  }

  // ---- Review --------------------------------------------------------------
  if (phase === "review") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {mode === "backfill"
            ? "Bulk backfill — spot-check the obvious ones and import. Fine to be light here; this is for learning your patterns."
            : "Review each row and adjust the category or type where needed, then import."}
        </p>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Merchant</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Conf.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={i} className={cn(!r.include && "opacity-40")}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={r.include}
                      onChange={(e) => updateRow(i, { include: e.target.checked })}
                      aria-label="Include row"
                    />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {r.occurred_date}
                  </TableCell>
                  <TableCell className="max-w-40 truncate font-medium">
                    {r.merchant}
                  </TableCell>
                  <TableCell>
                    <select
                      value={r.type}
                      onChange={(e) =>
                        updateRow(i, { type: e.target.value as TxnType })
                      }
                      className={cn(nativeSelectClass, "h-8 w-28")}
                    >
                      {TXN_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {TXN_TYPE_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>
                    <select
                      value={r.category_id ?? ""}
                      onChange={(e) => {
                        const id = e.target.value || null;
                        updateRow(i, {
                          category_id: id,
                          category_name: id ? (catById.get(id) ?? null) : null,
                        });
                      }}
                      className={cn(nativeSelectClass, "h-8 w-40")}
                    >
                      <option value="">— Uncategorized —</option>
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
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(
                      r.type === "income"
                        ? Math.abs(r.amount)
                        : -Math.abs(r.amount),
                    )}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums text-xs",
                      r.confidence < 0.6 && "text-caution",
                    )}
                  >
                    {Math.round(r.confidence * 100)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {error && <p className="text-sm text-critical">{error}</p>}

        <div className="flex items-center gap-3">
          <Button onClick={handleCommit} disabled={pending || includedCount === 0}>
            {pending ? "Importing…" : `Import ${includedCount} selected`}
          </Button>
          <Button variant="ghost" onClick={() => setPhase("input")} disabled={pending}>
            Back
          </Button>
        </div>
      </div>
    );
  }

  // ---- Input ---------------------------------------------------------------
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="account">Account</Label>
          <select
            id="account"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
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
          <Label htmlFor="mode">Import type</Label>
          <select
            id="mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as ImportMode)}
            className={nativeSelectClass}
          >
            <option value="current">Current — review carefully</option>
            <option value="backfill">Backfill — bulk history, light-touch</option>
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="file">Upload a CSV (or paste below)</Label>
        <input
          id="file"
          type="file"
          accept=".csv,.txt,text/csv,text/plain"
          onChange={handleFile}
          className="block text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-transparent file:px-3 file:py-1.5 file:text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="text">Statement text</Label>
        <textarea
          id="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          placeholder="Paste your CSV or a list of transactions here…"
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      {error && <p className="text-sm text-critical">{error}</p>}

      <Button onClick={handleParse} disabled={pending || !text.trim() || !accountId}>
        {pending ? "Reading…" : "Parse with Claude"}
      </Button>
    </div>
  );
}
