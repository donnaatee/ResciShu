import { Link } from "@tanstack/react-router";
import { CalendarDays, ChefHat, Home, Receipt, Refrigerator, ShoppingBasket, Scale } from "lucide-react";
import type { ReactNode } from "react";

const NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/inventory", label: "Inventory", icon: Refrigerator },
  { to: "/recipes", label: "Recipes", icon: ChefHat },
  { to: "/grocery", label: "Grocery", icon: ShoppingBasket },
  { to: "/planner", label: "Planner", icon: CalendarDays },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden md:flex w-60 shrink-0 flex-col gap-1 border-r border-sidebar-border bg-sidebar p-4 sticky top-0 h-screen">
        <Link to="/" className="mb-6 flex items-center gap-2 px-2 font-display text-xl font-bold text-sidebar-foreground">
          <span className="grid size-9 place-items-center rounded-full bg-accent text-accent-foreground"><ChefHat className="size-5" /></span>
          Kitchen
        </Link>
        {NAV.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} activeOptions={{ exact: to === "/" }}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent"
            activeProps={{ className: "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary" }}>
            <Icon className="size-4" />{label}
          </Link>
        ))}
        <div className="mt-auto">
          <Link to="/prices" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent"
            activeProps={{ className: "bg-sidebar-accent text-sidebar-foreground" }}>
            <Receipt className="size-4" />Prices &amp; receipts
          </Link>
          <Link to="/convert" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent"
            activeProps={{ className: "bg-sidebar-accent text-sidebar-foreground" }}>
            <Scale className="size-4" />Unit converter
          </Link>
        </div>
      </aside>
      <main className="flex-1 min-w-0 pb-24 md:pb-10">
        <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-10">{children}</div>
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-card/95 backdrop-blur md:hidden">
        {NAV.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} activeOptions={{ exact: to === "/" }}
            className="flex flex-col items-center gap-1 py-2.5 text-[11px] text-muted-foreground"
            activeProps={{ className: "text-primary font-semibold" }}>
            <Icon className="size-5" />{label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground">{title}</h1>
        {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
