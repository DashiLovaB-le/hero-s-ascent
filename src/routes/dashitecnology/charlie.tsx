import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  adminCharlieOverview,
  adminResetCharliePrompt,
  adminSaveCharliePrompt,
} from "@/admin/functions";
import {
  AdminError,
  AdminLoading,
  AdminShell,
  AdminTable,
  Panel,
  StatCard,
  StatGrid,
  shortId,
} from "@/admin/ui";
import { Button } from "@/components/ui/button";
import { runQueryFn } from "@/lib/safe-query";

export const Route = createFileRoute("/dashitecnology/charlie")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["admin", "charlie"],
      queryFn: () => runQueryFn(() => adminCharlieOverview(), "Falha Charlie."),
    }),
  pendingComponent: AdminLoading,
  errorComponent: ({ error }) => (
    <AdminError error={error instanceof Error ? error : new Error(String(error))} />
  ),
  component: CharlieAdminPage,
});

function CharlieAdminPage() {
  const qc = useQueryClient();
  const saveFn = useServerFn(adminSaveCharliePrompt);
  const resetFn = useServerFn(adminResetCharliePrompt);

  const { data } = useSuspenseQuery({
    queryKey: ["admin", "charlie"],
    queryFn: () => runQueryFn(() => adminCharlieOverview(), "Falha Charlie."),
  });

  const [prompt, setPrompt] = useState(data.systemPrompt);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setPrompt(data.systemPrompt);
    setDirty(false);
  }, [data.systemPrompt]);

  const save = useMutation({
    mutationFn: () => saveFn({ data: { prompt } }),
    onSuccess: () => {
      toast.success("Prompt do Charlie salvo. Já vale nas próximas mensagens.");
      void qc.invalidateQueries({ queryKey: ["admin", "charlie"] });
      setDirty(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reset = useMutation({
    mutationFn: () => resetFn(),
    onSuccess: () => {
      toast.success("Voltou ao prompt padrão do código.");
      void qc.invalidateQueries({ queryKey: ["admin", "charlie"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AdminShell
      title="Charlie"
      subtitle="Desafios, mensagens e system prompt (sem editar código)."
    >
      <StatGrid>
        <StatCard label="Mensagens (7d)" value={data.messagesWeek} />
        <StatCard label="Desafios (7d)" value={data.challenges.length} />
        <StatCard
          label="Por status"
          value={Object.keys(data.byStatus).length}
          hint={Object.entries(data.byStatus)
            .map(([k, v]) => `${k}:${v}`)
            .join(" · ")}
        />
        <StatCard
          label="Prompt"
          value={data.promptSource === "database" ? "banco" : "código"}
          hint={
            data.promptUpdatedAt
              ? `atualizado ${data.promptUpdatedAt.slice(0, 16)}`
              : "usando default do repositório"
          }
        />
      </StatGrid>

      <Panel className="mt-6" title="System prompt">
        <p className="mb-3 text-sm text-white/50">
          Este texto é a identidade do Charlie (mensagem <code className="text-[#FC6E20]">system</code>
          ). Alterações aqui sobrescrevem o default do código até você restaurar.
        </p>
        <textarea
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            setDirty(true);
          }}
          rows={22}
          className="w-full resize-y rounded-md border border-white/10 bg-black/40 px-3 py-3 font-mono text-xs leading-relaxed text-white/85 outline-none focus:border-[#FC6E20]/50"
          spellCheck={false}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            disabled={save.isPending || !dirty}
            className="bg-[#FC6E20] text-black hover:bg-[#FC6E20]/90"
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Salvando…" : "Salvar prompt"}
          </Button>
          <Button
            variant="outline"
            disabled={reset.isPending || data.promptSource === "code"}
            onClick={() => {
              if (
                confirm(
                  "Remover o prompt do banco e voltar ao texto padrão versionado no código?",
                )
              ) {
                reset.mutate();
              }
            }}
          >
            Restaurar default do código
          </Button>
          <span className="self-center text-xs text-white/35">
            {prompt.length.toLocaleString("pt-BR")} caracteres
            {dirty ? " · alterações não salvas" : ""}
          </span>
        </div>
      </Panel>

      <Panel className="mt-6" title="Desafios recentes">
        <AdminTable headers={["Título", "User", "Status", "XP", "Criado"]}>
          {data.challenges.map((c) => (
            <tr key={c.id} className="text-white/75">
              <td className="px-2 py-1.5">{c.titulo}</td>
              <td className="px-2 py-1.5 text-xs">{shortId(c.user_id)}</td>
              <td className="px-2 py-1.5">{c.status}</td>
              <td className="px-2 py-1.5">{c.xp_recompensa}</td>
              <td className="px-2 py-1.5 text-xs">{c.created_at.slice(0, 10)}</td>
            </tr>
          ))}
        </AdminTable>
      </Panel>
    </AdminShell>
  );
}
