import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  adminCharlieOverview,
  adminResetCharliePersonality,
  adminSaveCharliePersonality,
  adminSeedCharliePersonalities,
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
import { Input } from "@/components/ui/input";
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
  const saveFn = useServerFn(adminSaveCharliePersonality);
  const resetFn = useServerFn(adminResetCharliePersonality);
  const seedFn = useServerFn(adminSeedCharliePersonalities);

  const { data } = useSuspenseQuery({
    queryKey: ["admin", "charlie"],
    queryFn: () => runQueryFn(() => adminCharlieOverview(), "Falha Charlie."),
  });

  const personalities = data.personalities;
  const [selectedSlug, setSelectedSlug] = useState(personalities[0]?.slug ?? "classico");

  const selected = useMemo(
    () => personalities.find((p) => p.slug === selectedSlug) ?? personalities[0],
    [personalities, selectedSlug],
  );

  const [name, setName] = useState(selected?.name ?? "");
  const [tagline, setTagline] = useState(selected?.tagline ?? "");
  const [description, setDescription] = useState(selected?.description ?? "");
  const [prompt, setPrompt] = useState(selected?.system_prompt ?? "");
  const [active, setActive] = useState(selected?.is_active ?? true);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!selected) return;
    setName(selected.name);
    setTagline(selected.tagline);
    setDescription(selected.description);
    setPrompt(selected.system_prompt);
    setActive(selected.is_active);
    setDirty(false);
  }, [selected]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "charlie"] });

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          slug: selected.slug,
          name,
          tagline,
          description,
          system_prompt: prompt,
          is_active: active,
        },
      }),
    onSuccess: () => {
      toast.success(`Personalidade ${selected.name} salva.`);
      setDirty(false);
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reset = useMutation({
    mutationFn: () => resetFn({ data: { slug: selected.slug } }),
    onSuccess: () => {
      toast.success("Prompt restaurado ao seed do código.");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const seed = useMutation({
    mutationFn: (forceOverwrite: boolean) => seedFn({ data: { forceOverwrite } }),
    onSuccess: (r) => {
      toast.success(
        r.upserted
          ? `Seeds aplicados (${r.upserted}).`
          : "Catálogo já estava completo.",
      );
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!selected) {
    return (
      <AdminShell title="Charlie" subtitle="Nenhuma personalidade no catálogo.">
        <Button onClick={() => seed.mutate(true)}>Semear personalidades</Button>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="Charlie"
      subtitle="Personalidades, prompts e desafios — sem editar código."
    >
      <StatGrid>
        <StatCard label="Mensagens (7d)" value={data.messagesWeek} />
        <StatCard label="Desafios (7d)" value={data.challenges.length} />
        <StatCard label="Personalidades" value={personalities.length} />
        <StatCard
          label="Ativas"
          value={personalities.filter((p) => p.is_active).length}
          hint={Object.entries(
            personalities.reduce<Record<string, number>>((acc, p) => {
              acc[p.slug] = p.usage;
              return acc;
            }, {}),
          )
            .map(([k, v]) => `${k}:${v}`)
            .join(" · ")}
        />
      </StatGrid>

      <Panel className="mt-6" title="Personalidades">
        <div className="mb-4 flex flex-wrap gap-2">
          {personalities.map((p) => (
            <button
              key={p.slug}
              type="button"
              onClick={() => setSelectedSlug(p.slug)}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                p.slug === selected.slug
                  ? "border-[#FC6E20]/60 bg-[#FC6E20]/15 text-white"
                  : "border-white/10 text-white/70 hover:border-white/25"
              }`}
            >
              {p.name}
              {!p.is_active ? " (off)" : ""}
              <span className="ml-2 text-xs text-white/35">{p.usage}</span>
            </button>
          ))}
        </div>

        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-white/50">
            Nome
            <Input
              className="mt-1"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setDirty(true);
              }}
            />
          </label>
          <label className="block text-xs text-white/50">
            Tagline
            <Input
              className="mt-1"
              value={tagline}
              onChange={(e) => {
                setTagline(e.target.value);
                setDirty(true);
              }}
            />
          </label>
          <label className="block text-xs text-white/50 sm:col-span-2">
            Descrição
            <Input
              className="mt-1"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setDirty(true);
              }}
            />
          </label>
        </div>

        <label className="mb-3 flex items-center gap-2 text-sm text-white/70">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => {
              setActive(e.target.checked);
              setDirty(true);
            }}
          />
          Ativa (visível para usuários)
        </label>

        <p className="mb-2 text-xs text-white/40">
          slug <code className="text-[#FC6E20]">{selected.slug}</code>
          {selected.updated_at
            ? ` · atualizado ${selected.updated_at.slice(0, 16)}`
            : ""}
        </p>

        <textarea
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            setDirty(true);
          }}
          rows={20}
          className="w-full resize-y rounded-md border border-white/10 bg-black/40 px-3 py-3 font-mono text-xs leading-relaxed text-white/85 outline-none focus:border-[#FC6E20]/50"
          spellCheck={false}
        />

        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            disabled={save.isPending || !dirty}
            className="bg-[#FC6E20] text-black hover:bg-[#FC6E20]/90"
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Salvando…" : "Salvar personalidade"}
          </Button>
          <Button
            variant="outline"
            disabled={reset.isPending}
            onClick={() => {
              if (confirm(`Restaurar seed do código para ${selected.name}?`)) {
                reset.mutate();
              }
            }}
          >
            Restaurar seed
          </Button>
          <Button
            variant="outline"
            disabled={seed.isPending}
            onClick={() => seed.mutate(false)}
          >
            Completar seeds faltantes
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
