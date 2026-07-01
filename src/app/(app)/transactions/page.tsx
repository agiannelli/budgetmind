import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCurrentUser } from "@/lib/user";
import { listAccounts, accountLabel } from "@/lib/data/accounts";
import { listCategories } from "@/lib/data/categories";
import { listTransactions } from "@/lib/data/transactions";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AddTransactionForm } from "./add-transaction-form";

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
          Log spending and income by hand. Statement import arrives in the next PR.
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Merchant</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDate(t.occurred_date)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {t.merchant_raw ?? "—"}
                    </TableCell>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
