import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          A calm view of what&apos;s safe to spend, what&apos;s coming, and where
          you stand.
        </p>
      </div>

      {/* Hero — the forward-looking "safe to spend" number (PRD §6.1). Empty
          until accounts, goals, and upcoming events exist. */}
      <Card>
        <CardHeader>
          <CardDescription>Safe to spend</CardDescription>
          <CardTitle className="text-5xl font-semibold tabular-nums text-primary">
            &mdash;
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your forward-looking number appears here once your accounts, goals,
            and upcoming events are set up.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Envelopes</CardTitle>
            <CardDescription>
              Emergency fund, tax reserve, and your monthly invest — at a glance.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Nothing here yet.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Coming up</CardTitle>
            <CardDescription>
              Timed events — taxes, vests, payoffs — before they hit.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Nothing scheduled yet.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
