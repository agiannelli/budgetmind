"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Landmark,
  Wallet,
  MessageSquareHeart,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  ready: boolean;
};

// Information architecture for the app. Only `ready` items navigate today;
// the rest advertise the shape of the product and light up in later PRs.
const NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, ready: true },
  { label: "Accounts", href: "/accounts", icon: Landmark, ready: true },
  { label: "Transactions", href: "/transactions", icon: ArrowLeftRight, ready: true },
  { label: "Envelopes", href: "/envelopes", icon: Wallet, ready: false },
  { label: "Check-in", href: "/check-in", icon: MessageSquareHeart, ready: false },
  { label: "Settings", href: "/settings", icon: Settings, ready: false },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex h-14 items-center gap-2 px-5">
        <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-semibold">
          B
        </span>
        <span className="text-base font-semibold tracking-tight">BudgetMind</span>
      </div>

      <nav className="flex flex-col gap-1 px-3 py-2">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          if (!item.ready) {
            return (
              <span
                key={item.href}
                aria-disabled="true"
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground/60"
              >
                <Icon className="size-4" />
                <span>{item.label}</span>
                <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground/50">
                  soon
                </span>
              </span>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60",
              )}
            >
              <Icon className="size-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-5 py-4 text-xs text-muted-foreground/70">
        Phase 1 · scaffold
      </div>
    </aside>
  );
}
