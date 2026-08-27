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
import { ImportClient } from "./import-client";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [accounts, categories] = await Promise.all([
    listAccounts(user.id),
    listCategories(user.id),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Import</h1>
        <p className="text-muted-foreground">
          Upload or paste a statement — Claude sorts it into transactions for you to
          review before anything is saved.
        </p>
      </div>

      {accounts.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add an account first</CardTitle>
            <CardDescription>
              Imported transactions belong to an account. Create one to get started.
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
          <CardContent className="pt-6">
            <ImportClient
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
    </div>
  );
}
