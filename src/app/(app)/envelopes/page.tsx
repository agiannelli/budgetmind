import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/lib/user";
import { listEnvelopes } from "@/lib/data/envelopes";
import { estimateMonthlyExpenses, listLargePurchases } from "@/lib/data/spending";
import {
  listRecurringItems,
  detectRecurringCandidates,
} from "@/lib/data/recurring";
import { ENVELOPE_CATALOG } from "@/lib/envelope-types";
import { EnvelopesManager } from "./envelopes-client";
import { WindfallPanel } from "./windfall-panel";
import { EstimateReview } from "./estimate-review";
import { RecurringBills } from "./recurring-bills";

export const dynamic = "force-dynamic";

export default async function EnvelopesPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [envelopes, spending, largePurchases, recurringItems, recurringCandidates] =
    await Promise.all([
      listEnvelopes(user.id),
      estimateMonthlyExpenses(user.id),
      listLargePurchases(user.id),
      listRecurringItems(user.id),
      detectRecurringCandidates(user.id),
    ]);

  // Offer any standard envelope the user doesn't already have (match by name).
  const have = new Set(envelopes.map((e) => e.name.trim().toLowerCase()));
  const suggestions = ENVELOPE_CATALOG.filter(
    (p) => !have.has(p.name.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Envelopes</h1>
        <p className="text-muted-foreground">
          Give your money a job. Set goals, targets, and the priority order the
          engine fills and pulls from.
        </p>
      </div>

      <EstimateReview
        monthlyExpenses={spending.monthlyExpenses}
        monthsObserved={spending.monthsObserved}
        excludedCount={spending.excludedCount}
        recurringMonthly={spending.recurringMonthly}
        variableMonthly={spending.variableMonthly}
        purchases={largePurchases}
      />

      <RecurringBills items={recurringItems} candidates={recurringCandidates} />

      {envelopes.length > 0 && (
        <WindfallPanel
          envelopes={envelopes}
          monthlyExpenses={spending.monthlyExpenses}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your envelopes</CardTitle>
          <CardDescription>
            {envelopes.length === 0
              ? "Nothing here yet — add your first envelope."
              : `${envelopes.length} active, highest priority first.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EnvelopesManager
            envelopes={envelopes}
            suggestions={suggestions}
            monthlyExpenses={spending.monthlyExpenses}
          />
        </CardContent>
      </Card>
    </div>
  );
}
