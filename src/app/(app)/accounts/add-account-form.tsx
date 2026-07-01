"use client";

import { useActionState, useEffect, useRef } from "react";
import { addAccountAction } from "./actions";
import { emptyFormState, nativeSelectClass } from "@/lib/forms";
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS } from "@/lib/data/enums";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AddAccountForm() {
  const [state, formAction, pending] = useActionState(
    addAccountAction,
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
          <Label htmlFor="name">Account name</Label>
          <Input id="name" name="name" placeholder="Chase Checking" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nickname">Nickname (optional)</Label>
          <Input id="nickname" name="nickname" placeholder="House Fund" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="type">Type</Label>
          <select
            id="type"
            name="type"
            defaultValue="checking"
            className={nativeSelectClass}
          >
            {ACCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>
                {ACCOUNT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="institution">Institution (optional)</Label>
          <Input id="institution" name="institution" placeholder="Chase" />
        </div>
      </div>

      {state.error && <p className="text-sm text-critical">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add account"}
      </Button>
    </form>
  );
}
