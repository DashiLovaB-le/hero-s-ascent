/**
 * Metas enriquecidas para o contexto do Charlie — lógica pura (testável).
 */

export type MentorGoalStatus = "ativa" | "pausada" | "concluida";

export type MentorGoalHabit = {
  titulo: string;
  doneToday: boolean;
  completions7d: number;
};

export type MentorGoalItem = {
  titulo: string;
  categoria: string;
  status: MentorGoalStatus;
  is_norte: boolean;
  motivo: string | null;
  prazo: string | null;
  overdue: boolean;
  progressPct: number;
  progressSource: "linked" | "category" | "none";
  linkedHabits: MentorGoalHabit[];
};

type RawGoal = {
  id: string;
  titulo: string;
  categoria: string;
  status: MentorGoalStatus;
  is_norte: boolean;
  motivo: string | null;
  prazo: string | null;
  completed_at: string | null;
};

type RawHabit = {
  id: string;
  titulo: string;
  categoria: string | null;
  goal_id: string | null;
  ativo: boolean;
};

type RawComp = { habit_id: string; dia: string };

function progressFor(
  habits: MentorGoalHabit[],
  source: "linked" | "category" | "none",
): Pick<MentorGoalItem, "progressPct" | "progressSource"> {
  if (!habits.length) return { progressPct: 0, progressSource: "none" };
  const rate =
    habits.reduce((s, h) => s + Math.min(7, h.completions7d) / 7, 0) / habits.length;
  return {
    progressPct: Math.round(rate * 100),
    progressSource: source,
  };
}

/**
 * Monta itens de meta para o mentor a partir de goals + hábitos + completions (7d).
 * Inclui ativas/pausadas e concluídas recentes (já filtradas pelo caller).
 */
export function assembleMentorGoals(input: {
  goals: RawGoal[];
  habits: RawHabit[];
  completions7d: RawComp[];
  hoje: string;
}): MentorGoalItem[] {
  const comps = new Map<string, { n: number; today: boolean }>();
  for (const c of input.completions7d) {
    const cur = comps.get(c.habit_id) ?? { n: 0, today: false };
    cur.n += 1;
    if (c.dia === input.hoje) cur.today = true;
    comps.set(c.habit_id, cur);
  }

  const habitViews = input.habits
    .filter((h) => h.ativo)
    .map((h) => {
      const c = comps.get(h.id);
      return {
        id: h.id,
        titulo: h.titulo,
        categoria: h.categoria,
        goal_id: h.goal_id,
        doneToday: c?.today ?? false,
        completions7d: c?.n ?? 0,
      };
    });

  return input.goals.map((g) => {
    const linkedRaw = habitViews.filter((h) => h.goal_id === g.id);
    const linked: MentorGoalHabit[] = linkedRaw.map((h) => ({
      titulo: h.titulo,
      doneToday: h.doneToday,
      completions7d: h.completions7d,
    }));

    let used = linked;
    let source: "linked" | "category" | "none" = linked.length ? "linked" : "none";
    if (!linked.length) {
      const byCat = habitViews
        .filter((h) => !h.goal_id && h.categoria === g.categoria)
        .map((h) => ({
          titulo: h.titulo,
          doneToday: h.doneToday,
          completions7d: h.completions7d,
        }));
      if (byCat.length) {
        used = byCat;
        source = "category";
      }
    }

    const { progressPct, progressSource } = progressFor(
      source === "linked" ? linked : used,
      source,
    );

    return {
      titulo: g.titulo,
      categoria: g.categoria,
      status: g.status,
      is_norte: g.is_norte,
      motivo: g.motivo,
      prazo: g.prazo,
      overdue: !!g.prazo && g.status === "ativa" && g.prazo < input.hoje,
      progressPct,
      progressSource,
      linkedHabits: linked,
    };
  });
}

export function formatMentorGoalsBlock(goals: MentorGoalItem[]): string {
  if (!goals.length) {
    return [
      "METAS DO HERÓI: nenhuma cadastrada.",
      "METAS — REGRAS: se o herói não tiver metas, pode sugerir 1–3 nortes alinhados às categorias; não invente progresso.",
    ].join("\n");
  }

  const ativas = goals.filter((g) => g.status === "ativa");
  const pausadas = goals.filter((g) => g.status === "pausada");
  const concluidas = goals.filter((g) => g.status === "concluida");
  const nortes = ativas.filter((g) => g.is_norte);
  const semHabito = ativas.filter((g) => g.linkedHabits.length === 0);
  const fracas = ativas.filter((g) => g.progressPct < 40 && g.linkedHabits.length > 0);
  const atrasadas = ativas.filter((g) => g.overdue);

  const lines: string[] = [];
  lines.push(
    `METAS DO HERÓI — resumo: ${ativas.length} ativa(s), ${nortes.length} norte(s), ${pausadas.length} pausada(s), ${concluidas.length} conquistada(s) recente(s)`,
  );

  if (semHabito.length) {
    lines.push(
      `Alerta: ${semHabito.length} meta(s) sem hábitos ligados — incentive vínculo ou criar hábito a partir da meta.`,
    );
  }
  if (fracas.length) {
    lines.push(
      `Alerta ritmo baixo (<40%/7d): ${fracas.map((g) => `"${g.titulo}" ${g.progressPct}%`).join("; ")}`,
    );
  }
  if (atrasadas.length) {
    lines.push(
      `Alerta prazo vencido: ${atrasadas.map((g) => `"${g.titulo}" (prazo ${g.prazo})`).join("; ")}`,
    );
  }

  const detailGoals = [
    ...nortes,
    ...ativas.filter((g) => !g.is_norte),
    ...pausadas,
    ...concluidas,
  ].slice(0, 8);

  for (const g of detailGoals) {
    const bits = [
      g.is_norte ? "NORTE" : null,
      g.status,
      `[${g.categoria}]`,
      `"${g.titulo}"`,
      g.motivo ? `porquê: ${g.motivo.slice(0, 120)}` : null,
      g.prazo ? `prazo ${g.prazo}${g.overdue ? " ATRASADO" : ""}` : null,
      `ritmo7d ${g.progressPct}% (${g.progressSource})`,
    ].filter(Boolean);

    const habits =
      g.linkedHabits.length > 0
        ? g.linkedHabits
            .slice(0, 4)
            .map(
              (h) =>
                `${h.titulo}${h.doneToday ? "✓hoje" : ""} ${h.completions7d}/7d`,
            )
            .join("; ")
        : "sem hábitos ligados";

    lines.push(`- ${bits.join(" · ")} · hábitos: ${habits}`);
  }

  lines.push(
    `METAS — REGRAS: use estes dados (não invente ritmo/prazo/hábitos). Priorize nortes. Cobre vínculo meta↔hábito e prazo. Celebre conquistadas recentes com parcimônia. Ao sugerir hábito novo, alinhe a uma meta ativa se fizer sentido.`,
  );

  return lines.join("\n");
}
