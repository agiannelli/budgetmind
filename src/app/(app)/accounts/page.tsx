import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/lib/user";
import { listAccounts, accountLabel } from "@/lib/data/accounts";
import { ACCOUNT_TYPE_LABELS } from "@/lib/data/enums";
import { AddAccountForm } from "./add-account-form";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const user = await getCurrentUser();
  const accounts = user ? await listAccounts(user.id) : [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
        <p className="text-muted-foreground">
          The places your money moves. Add the ones you want BudgetMind to track.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your accounts</CardTitle>
          <CardDescription>
            {accounts.length === 0
              ? "No accounts yet — add your first one below."
              : `${accounts.length} account${accounts.length === 1 ? "" : "s"}.`}
          </CardDescription>
        </CardHeader>
        {accounts.length > 0 && (
          <CardContent>
            <ul className="divide-y divide-border">
              {accounts.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between py-2.5"
                >
                  <span className="font-medium">{accountLabel(a)}</span>
                  <span className="text-xs text-muted-foreground">
                    {ACCOUNT_TYPE_LABELS[a.type]}
                    {a.institution ? ` · ${a.institution}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add an account</CardTitle>
        </CardHeader>
        <CardContent>
          <AddAccountForm />
        </CardContent>
      </Card>
    </div>
  );
}
