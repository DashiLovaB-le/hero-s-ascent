import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ADMIN_NAV, type AdminNavItem } from "@/admin/nav";
import { cn } from "@/lib/utils";

type AdminTo = AdminNavItem["to"];

function AdminNavLink({
  item,
  className,
}: {
  item: AdminNavItem;
  className?: string;
}) {
  return (
    <Link to={item.to as AdminTo} className={className}>
      {item.label}
    </Link>
  );
}

export function AdminShell({
  title,
  subtitle,
  children,
  actions,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-[#FFE7D0]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(252,110,32,0.12),_transparent_55%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-white/10 bg-black/40 p-4 backdrop-blur md:flex">
          <Link to="/dashitecnology" className="mb-6 block">
            <p className="font-display text-[10px] uppercase tracking-[0.28em] text-[#FC6E20]">
              Dashi Technology
            </p>
            <p className="mt-1 text-sm text-white/70">Sala de controle</p>
          </Link>
          <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
            {ADMIN_NAV.map((item) => {
              const active = item.exact
                ? pathname === item.to
                : pathname === item.to || pathname.startsWith(`${item.to}/`);
              return (
                <AdminNavLink
                  key={item.to}
                  item={item}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-[#FC6E20]/15 text-[#FC6E20]"
                      : "text-white/60 hover:bg-white/5 hover:text-white",
                  )}
                />
              );
            })}
          </nav>
          <Link to="/journey" className="mt-4 text-xs text-white/40 hover:text-white/70">
            ← Voltar ao app
          </Link>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-white/10 px-4 py-4 md:px-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="font-display text-xl tracking-wide text-white md:text-2xl">{title}</h1>
                {subtitle ? <p className="mt-1 text-sm text-white/50">{subtitle}</p> : null}
              </div>
              {actions}
            </div>
            <nav className="mt-4 flex gap-2 overflow-x-auto pb-1 md:hidden">
              {ADMIN_NAV.map((item) => (
                <AdminNavLink
                  key={item.to}
                  item={item}
                  className="shrink-0 rounded-full border border-white/10 px-3 py-1 text-xs text-white/70"
                />
              ))}
            </nav>
          </header>
          <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-[11px] uppercase tracking-wider text-white/45">{label}</p>
      <p className="mt-2 font-display text-2xl text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-white/40">{hint}</p> : null}
    </div>
  );
}

export function Panel({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-white/10 bg-white/[0.03] p-4", className)}>
      {title ? <h2 className="mb-3 text-sm font-medium text-white/80">{title}</h2> : null}
      {children}
    </section>
  );
}

export function AdminTable({
  headers,
  children,
}: {
  headers: string[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-white/40">
            {headers.map((h) => (
              <th key={h} className="px-2 py-2 font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">{children}</tbody>
      </table>
    </div>
  );
}

export function fmtNum(n: number | null | undefined, digits = 2) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toFixed(digits);
}

export function shortId(id: string) {
  return `${id.slice(0, 8)}…`;
}

export function AdminLoading() {
  return (
    <AdminShell title="Carregando…">
      <div className="animate-pulse space-y-3">
        <div className="h-24 rounded-xl bg-white/5" />
        <div className="h-48 rounded-xl bg-white/5" />
      </div>
    </AdminShell>
  );
}

export function AdminError({ error }: { error: Error }) {
  return (
    <AdminShell title="Erro">
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
        {error.message}
      </div>
    </AdminShell>
  );
}
