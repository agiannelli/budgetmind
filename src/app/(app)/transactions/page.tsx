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
import { searchTransactions } from "@/lib/data/transactions";
import { AddTransactionForm } from "./add-transaction-form";
import { TransactionsBrowser } from "./recent-transactions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function TransactionsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [accounts, categories, firstPage] = await Promise.all([
    listAccounts(user.id),
    listCategories(user.id),
    searchTransactions(user.id, {}, PAGE_SIZE, 0),
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

      {accounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">History</CardTitle>
            <CardDescription>
              Search and look back through everything, not just the latest.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TransactionsBrowser
              initialRows={firstPage.rows}
              initialTotal={firstPage.total}
              accounts={accounts.map((a) => ({ id: a.id, label: accountLabel(a) }))}
              categories={categories.map((c) => ({
                id: c.id,
                name: c.name,
                kind: c.kind,
              }))}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
