import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/lib/user";
import { listEnvelopes } from "@/lib/data/envelopes";
import { ENVELOPE_CATALOG } from "@/lib/envelope-types";
import { EnvelopesManager } from "./envelopes-client";

export const dynamic = "force-dynamic";

export default async function EnvelopesPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const envelopes = await listEnvelopes(user.id);

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
          <EnvelopesManager envelopes={envelopes} suggestions={suggestions} />
        </CardContent>
      </Card>
    </div>
  );
}
