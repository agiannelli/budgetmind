import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { auth0 } from "@/lib/auth0";
import { ensureUser } from "@/lib/user";

// Auth-gated and per-user: never prerender.
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Authoritative gate (the proxy redirect is only optimistic).
  const session = await auth0.getSession();
  if (!session) {
    redirect("/auth/login");
  }

  // Create the users row + seed defaults on first login. Tolerant of Supabase
  // not being wired yet, so Auth0 can be verified before the database.
  try {
    await ensureUser({ sub: session.user.sub, email: session.user.email });
  } catch (err) {
    console.error("[budgetmind] ensureUser failed:", err);
  }

  const account = session.user.email ?? session.user.name ?? "Account";

  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-4 border-b border-border px-6">
          <span className="text-sm font-semibold tracking-tight md:hidden">
            BudgetMind
          </span>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{account}</span>
            <a
              href="/auth/logout"
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <LogOut className="size-3.5" />
              Log out
            </a>
          </div>
        </header>
        <main className="flex-1 bg-background px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
