import { redirect } from "next/navigation";
import { CalendarClock, Wallet, RotateCcw, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { auth0 } from "@/lib/auth0";

// Reads the session to decide landing vs. redirect — never prerender.
export const dynamic = "force-dynamic";

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: CalendarClock,
    title: "Sees it coming",
    body: "Quarterly taxes, RSU vests, loan payoffs — flagged before they land, not after. No more surprise-tight months.",
  },
  {
    icon: Wallet,
    title: "Intentional, not tedious",
    body: "The clarity of envelope budgeting — every dollar with a job — without categorizing each transaction by hand.",
  },
  {
    icon: RotateCcw,
    title: "Pick up where you left off",
    body: "Drift away for a few weeks? Come back to a 30-second catch-up, not a pile of homework.",
  },
];

export default async function Home() {
  const session = await auth0.getSession();
  if (session) redirect("/dashboard");

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
            B
          </span>
          <span className="text-base font-semibold tracking-tight">
            BudgetMind
          </span>
        </div>
        <Button asChild variant="ghost" size="sm">
          <a href="/auth/login">Log in</a>
        </Button>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mx-auto max-w-2xl space-y-6">
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Money that thinks a few steps ahead.
          </h1>
          <p className="text-lg text-muted-foreground text-pretty">
            BudgetMind is an anticipatory personal finance assistant. It learns
            your rhythm, sees the lumpy months coming, and does the
            reconciliation for you — so you always know what&apos;s safe to
            spend, save, and invest.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button asChild size="lg">
              <a href="/auth/login">Get started</a>
            </Button>
          </div>
        </div>

        <div className="mx-auto mt-20 grid max-w-4xl gap-8 text-left sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="space-y-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Icon className="size-5" />
              </span>
              <h2 className="font-medium">{title}</h2>
              <p className="text-sm text-muted-foreground text-pretty">{body}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="px-6 py-8 text-center text-xs text-muted-foreground">
        A personal finance tool, built for one household.
      </footer>
    </div>
  );
}
