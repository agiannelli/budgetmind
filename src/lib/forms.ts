/** Shared shape returned by form server actions, for use with useActionState. */
export type FormState = { error?: string; ok?: boolean };

export const emptyFormState: FormState = {};

/** Native <select> styling that matches the shadcn Input. */
export const nativeSelectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";
