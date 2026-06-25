import { AppSidebar } from "@/components/app-sidebar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center border-b border-border px-6">
          <span className="text-sm font-semibold tracking-tight md:hidden">
            BudgetMind
          </span>
          <span className="ml-auto text-xs text-muted-foreground">Personal</span>
        </header>
        <main className="flex-1 bg-background px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
