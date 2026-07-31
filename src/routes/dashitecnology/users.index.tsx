import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { adminListUsers } from "@/admin/functions";
import {
  AdminError,
  AdminLoading,
  AdminShell,
  AdminTable,
  Panel,
  fmtNum,
  shortId,
} from "@/admin/ui";
import { runQueryFn } from "@/lib/safe-query";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/dashitecnology/users/")({
  ssr: false,
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["admin", "users", ""],
      queryFn: () => runQueryFn(() => adminListUsers({ data: {} }), "Falha ao listar heróis."),
    }),
  pendingComponent: AdminLoading,
  errorComponent: ({ error }) => (
    <AdminError error={error instanceof Error ? error : new Error(String(error))} />
  ),
  component: UsersPage,
});

function UsersPage() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const { data } = useSuspenseQuery({
    queryKey: ["admin", "users", search],
    queryFn: () =>
      runQueryFn(() => adminListUsers({ data: { q: search || undefined } }), "Falha ao listar heróis."),
  });

  return (
    <AdminShell title="Heróis" subtitle={`${data.users.length} perfis carregados.`}>
      <Panel>
        <form
          className="mb-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(q.trim());
          }}
        >
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome…"
            className="max-w-sm border-white/10 bg-black/30"
          />
          <button
            type="submit"
            className="rounded-md bg-[#FC6E20] px-4 text-sm font-medium text-black"
          >
            Buscar
          </button>
        </form>

        <AdminTable
          headers={["Nome", "XP", "Cap.", "Streak", "Risco", "TG", "Roles", ""]}
        >
          {data.users.map((u) => (
            <tr key={u.userId} className="text-white/80">
              <td className="px-2 py-2">
                <div className="font-medium text-white">{u.displayName || "—"}</div>
                <div className="text-xs text-white/35">{shortId(u.userId)}</div>
              </td>
              <td className="px-2 py-2">{u.xpTotal}</td>
              <td className="px-2 py-2">{u.chapter}</td>
              <td className="px-2 py-2">
                {u.streakCurrent}/{u.streakMax}
              </td>
              <td className="px-2 py-2">{fmtNum(u.riscoAbandono)}</td>
              <td className="px-2 py-2">{u.telegramLinked ? "sim" : "—"}</td>
              <td className="px-2 py-2 text-xs">{u.roles.join(", ")}</td>
              <td className="px-2 py-2">
                <Link
                  to="/dashitecnology/users/$userId"
                  params={{ userId: u.userId }}
                  className="text-[#FC6E20] hover:underline"
                >
                  Abrir
                </Link>
              </td>
            </tr>
          ))}
        </AdminTable>
      </Panel>
    </AdminShell>
  );
}
