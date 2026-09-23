import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/lib/user";
import { listAccounts, accountLabel } from "@/lib/data/accounts";
import { listCategories } from "@/lib/data/categories";
import { listTransactions } from "@/lib/data/transactions";
import { AddTransactionForm } from "./add-transaction-form";
import { RecentTransactions } from "./recent-transactions";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [accounts, categories, transactions] = await Promise.all([
    listAccounts(user.id),
    listCategories(user.id),
    listTransactions(user.id),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
        <p className="text-muted-foreground">
          Log spending and income by hand, or{" "}
          <Link href="/import" className="font-medium text-primary hover:underline">
            import a statement
          </Link>
          . Edit any row inline.
        </p>
      </div>

      {accounts.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add an account first</CardTitle>
            <CardDescription>
              Transactions belong to an account. Create one to get started.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/accounts"
              className="text-sm font-medium text-primary hover:underline"
            >
              Go to Accounts →
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add a transaction</CardTitle>
          </CardHeader>
          <CardContent>
            <AddTransactionForm
              accounts={accounts.map((a) => ({
                id: a.id,
                label: accountLabel(a),
              }))}
              categories={categories.map((c) => ({
                id: c.id,
                name: c.name,
                kind: c.kind,
              }))}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent</CardTitle>
          <CardDescription>
            {transactions.length === 0
              ? "Nothing here yet."
              : `Showing your ${transactions.length} most recent.`}
          </CardDescription>
        </CardHeader>
        {transactions.length > 0 && (
          <CardContent>
            <RecentTransactions
              transactions={transactions}
              accounts={accounts.map((a) => ({ id: a.id, label: accountLabel(a) }))}
              categories={categories.map((c) => ({
                id: c.id,
                name: c.name,
                kind: c.kind,
              }))}
            />
          </CardContent>
        )}
      </Card>
    </div>
  );
}
