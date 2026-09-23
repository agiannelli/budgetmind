"use client";

import { useState } from "react";
import { ArrowUp, ArrowDown, Lock, Plus } from "lucide-react";
import {
  createEnvelopeAction,
  editEnvelopeAction,
  reorderEnvelopeAction,
  deactivateEnvelopeAction,
  addStarterEnvelopeAction,
} from "./actions";
import {
  ENVELOPE_KINDS,
  ENVELOPE_KIND_LABELS,
  FUNDING_TYPES,
  FUNDING_TYPE_LABELS,
  COVERAGE_TIERS,
  COVERAGE_TIER_LABELS,
  type Envelope,
  type EnvelopeInput,
  type EnvelopeKind,
  type FundingType,
  type CoverageTier,
  type EnvelopePreset,
} from "@/lib/envelope-types";
import { nativeSelectClass } from "@/lib/forms";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Draft = {
  name: string;
  kind: EnvelopeKind;
  funding_type: FundingType;
  target_amount: string;
  target_months: string;
  target_date: string;
  monthly_contribution: string;
  current_balance: string;
  coverage: CoverageTier;
  is_protected: boolean;
  notes: string;
};

const blankDraft = (): Draft => ({
  name: "",
  kind: "custom",
  funding_type: "build_to_target",
  target_amount: "",
  target_months: "",
  target_date: "",
  monthly_contribution: "",
  current_balance: "0",
  coverage: "flex",
  is_protected: false,
  notes: "",
});

const draftFrom = (e: Envelope): Draft => ({
  name: e.name,
  kind: e.kind,
  funding_type: e.funding_type,
  target_amount: e.target_amount != null ? String(e.target_amount) : "",
  target_months: e.target_months != null ? String(e.target_months) : "",
  target_date: e.target_date ?? "",
  monthly_contribution:
    e.monthly_contribution != null ? String(e.monthly_contribution) : "",
  current_balance: String(e.current_balance),
  coverage: e.coverage,
  is_protected: e.is_protected,
  notes: e.notes ?? "",
});

const numOrNull = (s: string): number | null =>
  s.trim() === "" ? null : Number(s);

const toInput = (d: Draft): EnvelopeInput => ({
  name: d.name,
  kind: d.kind,
  funding_type: d.funding_type,
  target_amount: numOrNull(d.target_amount),
  target_months: numOrNull(d.target_months),
  target_date: d.target_date || null,
  monthly_contribution: numOrNull(d.monthly_contribution),
  current_balance: numOrNull(d.current_balance) ?? 0,
  is_protected: d.is_protected,
  coverage: d.coverage,
  notes: d.notes,
});

export function EnvelopesManager({
  envelopes,
  suggestions,
}: {
  envelopes: Envelope[];
  suggestions: EnvelopePreset[];
}) {
  // mode: null (viewing), "add", or an envelope id (editing)
  const [mode, setMode] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [addingKey, setAddingKey] = useState<string | null>(null);

  async function addStarter(key: string) {
    setAddingKey(key);
    await addStarterEnvelopeAction(key);
    setAddingKey(null);
  }

  function openAdd() {
    setError(null);
    setDraft(blankDraft());
    setMode("add");
  }
  function openEdit(e: Envelope) {
    setError(null);
    setDraft(draftFrom(e));
    setMode(e.id);
  }
  function close() {
    setMode(null);
    setDraft(null);
    setError(null);
  }

  const set = (patch: Partial<Draft>) =>
    setDraft((d) => (d ? { ...d, ...patch } : d));

  async function submit() {
    if (!draft) return;
    if (!draft.name.trim()) return setError("Give the envelope a name.");
    setError(null);
    setPending(true);
    const input = toInput(draft);
    const res =
      mode === "add"
        ? await createEnvelopeAction(input)
        : await editEnvelopeAction(mode as string, input);
    setPending(false);
    if (res.error) return setError(res.error);
    close();
  }

  async function reorder(id: string, direction: "up" | "down") {
    setBusyId(id);
    await reorderEnvelopeAction(id, direction);
    setBusyId(null);
  }

  async function remove(e: Envelope) {
    if (
      !window.confirm(
        `Remove "${e.name}"? It stays in your history but leaves the active list.`,
      )
    )
      return;
    setBusyId(e.id);
    await deactivateEnvelopeAction(e.id);
    setBusyId(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Money with a job, in priority order — the order windfalls fill and
          coverage pulls respect.
        </p>
        {mode === null && <Button size="sm" onClick={openAdd}>Add envelope</Button>}
      </div>

      {mode === "add" && draft && (
        <EnvelopeForm
          draft={draft}
          set={set}
          onSubmit={submit}
          onCancel={close}
          pending={pending}
          error={error}
          submitLabel="Create envelope"
        />
      )}

      <div className="space-y-3">
        {envelopes.map((e, i) => {
          const isEditing = mode === e.id;
          if (isEditing && draft) {
            return (
              <div key={e.id} className="rounded-lg border bg-muted/40 p-4">
                <EnvelopeForm
                  draft={draft}
                  set={set}
                  onSubmit={submit}
                  onCancel={close}
                  pending={pending}
                  error={error}
                  submitLabel="Save changes"
                />
              </div>
            );
          }
          return (
            <EnvelopeCard
              key={e.id}
              envelope={e}
              isFirst={i === 0}
              isLast={i === envelopes.length - 1}
              busy={busyId === e.id}
              disabled={mode !== null}
              onEdit={() => openEdit(e)}
              onUp={() => reorder(e.id, "up")}
              onDown={() => reorder(e.id, "down")}
              onRemove={() => remove(e)}
            />
          );
        })}
      </div>

      {mode === null && suggestions.length > 0 && (
        <div className="space-y-2 border-t pt-4">
          <p className="text-sm font-medium">Suggested envelopes</p>
          <p className="text-xs text-muted-foreground">
            Common jobs for money. Tap to add one — you can tune it after.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {suggestions.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => addStarter(s.key)}
                disabled={addingKey !== null}
                className="group flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors hover:bg-accent disabled:opacity-50"
                title={s.blurb}
              >
                <Plus className="size-3.5 text-muted-foreground group-hover:text-foreground" />
                <span>{s.name}</span>
                {addingKey === s.key && (
                  <span className="text-xs text-muted-foreground">adding…</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EnvelopeCard({
  envelope: e,
  isFirst,
  isLast,
  busy,
  disabled,
  onEdit,
  onUp,
  onDown,
  onRemove,
}: {
  envelope: Envelope;
  isFirst: boolean;
  isLast: boolean;
  busy: boolean;
  disabled: boolean;
  onEdit: () => void;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
}) {
  const hasTarget =
    (e.funding_type === "build_to_target" || e.funding_type === "refill_to_cap") &&
    e.target_amount != null &&
    e.target_amount > 0;
  const pct = hasTarget
    ? Math.min(100, Math.round((e.current_balance / (e.target_amount as number)) * 100))
    : null;

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-0.5 pt-0.5">
          <button
            type="button"
            aria-label="Move up"
            onClick={onUp}
            disabled={isFirst || busy || disabled}
            className="text-muted-foreground hover:text-foreground disabled:opacity-30"
          >
            <ArrowUp className="size-4" />
          </button>
          <span className="text-xs font-medium tabular-nums text-muted-foreground">
            {e.priority}
          </span>
          <button
            type="button"
            aria-label="Move down"
            onClick={onDown}
            disabled={isLast || busy || disabled}
            className="text-muted-foreground hover:text-foreground disabled:opacity-30"
          >
            <ArrowDown className="size-4" />
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{e.name}</span>
            {e.is_protected && (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                <Lock className="size-3" /> Floor
              </span>
            )}
            <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
              {ENVELOPE_KIND_LABELS[e.kind]}
            </span>
            <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
              {COVERAGE_TIER_LABELS[e.coverage]}
            </span>
          </div>

          <div className="mt-2 text-sm">
            <span className="font-semibold tabular-nums">
              {formatCurrency(e.current_balance)}
            </span>{" "}
            <span className="text-muted-foreground">{targetDescriptor(e)}</span>
          </div>

          {pct != null && (
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </div>

        <div className="flex shrink-0 gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={onEdit}
            disabled={disabled || busy}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-muted-foreground"
            onClick={onRemove}
            disabled={disabled || busy}
          >
            Remove
          </Button>
        </div>
      </div>
    </div>
  );
}

function targetDescriptor(e: Envelope): string {
  if (e.funding_type === "monthly_fund") {
    return e.monthly_contribution != null
      ? `· ${formatCurrency(e.monthly_contribution)}/mo`
      : "· monthly set-aside";
  }
  if (e.target_amount != null && e.target_amount > 0) {
    const cap = e.funding_type === "refill_to_cap" ? "cap" : "target";
    const by = e.target_date ? ` by ${e.target_date}` : "";
    return `of ${formatCurrency(e.target_amount)} ${cap}${by}`;
  }
  if (e.target_months != null && e.target_months > 0) {
    return `· target: ${e.target_months} months of expenses`;
  }
  return "";
}

function EnvelopeForm({
  draft,
  set,
  onSubmit,
  onCancel,
  pending,
  error,
  submitLabel,
}: {
  draft: Draft;
  set: (patch: Partial<Draft>) => void;
  onSubmit: () => void;
  onCancel: () => void;
  pending: boolean;
  error: string | null;
  submitLabel: string;
}) {
  const showTargetAmount =
    draft.funding_type === "build_to_target" ||
    draft.funding_type === "refill_to_cap";
  const showMonths =
    draft.funding_type === "build_to_target" && draft.kind === "emergency_fund";
  const showMonthly = draft.funding_type === "monthly_fund";

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="e-name">Name</Label>
          <Input
            id="e-name"
            value={draft.name}
            onChange={(ev) => set({ name: ev.target.value })}
            placeholder="Emergency Fund"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="e-kind">Kind</Label>
          <select
            id="e-kind"
            value={draft.kind}
            onChange={(ev) => set({ kind: ev.target.value as EnvelopeKind })}
            className={nativeSelectClass}
          >
            {ENVELOPE_KINDS.map((k) => (
              <option key={k} value={k}>
                {ENVELOPE_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="e-funding">Funding</Label>
          <select
            id="e-funding"
            value={draft.funding_type}
            onChange={(ev) => set({ funding_type: ev.target.value as FundingType })}
            className={nativeSelectClass}
          >
            {FUNDING_TYPES.map((f) => (
              <option key={f} value={f}>
                {FUNDING_TYPE_LABELS[f]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="e-coverage">Coverage</Label>
          <select
            id="e-coverage"
            value={draft.coverage}
            onChange={(ev) => set({ coverage: ev.target.value as CoverageTier })}
            className={nativeSelectClass}
          >
            {COVERAGE_TIERS.map((c) => (
              <option key={c} value={c}>
                {COVERAGE_TIER_LABELS[c]}
              </option>
            ))}
          </select>
        </div>

        {showTargetAmount && (
          <div className="space-y-1.5">
            <Label htmlFor="e-target">
              {draft.funding_type === "refill_to_cap" ? "Cap" : "Target amount"}
            </Label>
            <Input
              id="e-target"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={draft.target_amount}
              onChange={(ev) => set({ target_amount: ev.target.value })}
              placeholder="10000"
            />
          </div>
        )}
        {showMonths && (
          <div className="space-y-1.5">
            <Label htmlFor="e-months">Target (months of expenses)</Label>
            <Input
              id="e-months"
              type="number"
              step="0.5"
              min="0"
              inputMode="decimal"
              value={draft.target_months}
              onChange={(ev) => set({ target_months: ev.target.value })}
              placeholder="6"
            />
          </div>
        )}
        {draft.funding_type === "build_to_target" && (
          <div className="space-y-1.5">
            <Label htmlFor="e-date">Target date (optional)</Label>
            <Input
              id="e-date"
              type="date"
              value={draft.target_date}
              onChange={(ev) => set({ target_date: ev.target.value })}
            />
          </div>
        )}
        {showMonthly && (
          <div className="space-y-1.5">
            <Label htmlFor="e-monthly">Monthly amount</Label>
            <Input
              id="e-monthly"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={draft.monthly_contribution}
              onChange={(ev) => set({ monthly_contribution: ev.target.value })}
              placeholder="500"
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="e-balance">Current balance</Label>
          <Input
            id="e-balance"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={draft.current_balance}
            onChange={(ev) => set({ current_balance: ev.target.value })}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={draft.is_protected}
          onChange={(ev) => set({ is_protected: ev.target.checked })}
        />
        Protected floor — never dipped without a loud warning
      </label>

      <div className="space-y-1.5">
        <Label htmlFor="e-notes">Notes (optional)</Label>
        <Input
          id="e-notes"
          value={draft.notes}
          onChange={(ev) => set({ notes: ev.target.value })}
        />
      </div>

      {error && <p className="text-sm text-critical">{error}</p>}

      <div className="flex gap-2">
        <Button size="sm" onClick={onSubmit} disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
