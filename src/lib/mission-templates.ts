import type { Database } from "@/integrations/supabase/types";

type MissionKind = Database["public"]["Enums"]["mission_kind"];

export type MissionTemplate = {
  kind: MissionKind;
  titulo: string;
  descricao: string;
  xp_recompensa: number;
  progresso_alvo: number;
  track: "habit_completions";
};

/** Templates por capítulo — seed em código (sem tabela mission_templates). */
export function missionTemplatesForChapter(capitulo: number): MissionTemplate[] {
  const c = Math.min(7, Math.max(1, capitulo));
  const principalAlvo = 5 + c * 2; // 7, 9, 11…
  const secundariaAlvo = 3 + c;

  const nomes: Record<number, { principal: string; sec: string }> = {
    1: {
      principal: "Primeiros passos firmes",
      sec: "Consistência inicial",
    },
    2: {
      principal: "Cruzar o limiar",
      sec: "Disciplina na travessia",
    },
    3: {
      principal: "Provas diárias",
      sec: "Não falhar o chamado",
    },
    4: {
      principal: "Resistir ao abismo",
      sec: "Uma vitória por dia",
    },
    5: {
      principal: "Colher a recompensa",
      sec: "Manter o ritmo",
    },
    6: {
      principal: "Trazer o elixir",
      sec: "Servir pelo exemplo",
    },
    7: {
      principal: "Viver como lenda",
      sec: "Legado em ação",
    },
  };

  const label = nomes[c] ?? nomes[1];

  return [
    {
      kind: "principal",
      titulo: label.principal,
      descricao: `Complete ${principalAlvo} hábitos neste capítulo.`,
      xp_recompensa: 80 + c * 40,
      progresso_alvo: principalAlvo,
      track: "habit_completions",
    },
    {
      kind: "secundaria",
      titulo: label.sec,
      descricao: `Complete ${secundariaAlvo} hábitos adicionais.`,
      xp_recompensa: 40 + c * 20,
      progresso_alvo: secundariaAlvo,
      track: "habit_completions",
    },
  ];
}
