/**
 * Provas de identidade (Alter Ego Fase 2) — emissão idempotente + stats.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { addDaysToDateKey, hojeISO } from "@/lib/datetime";

type Client = SupabaseClient<Database>;

export type IdentityProofSource = "habit" | "goal" | "challenge" | "alarm" | "other";

export type IdentityProof = {
  id: string;
  user_id: string;
  source_type: IdentityProofSource;
  source_id: string;
  atributo: string | null;
  label: string;
  dia: string;
  created_at: string;
};

export type IdentityProofStats = {
  week: number;
  total: number;
};

const PROOF_COLS =
  "id, user_id, source_type, source_id, atributo, label, dia, created_at";

export async function emitIdentityProof(
  _supabase: Client,
  opts: {
    userId: string;
    sourceType: IdentityProofSource;
    sourceId: string;
    label: string;
    atributo?: string | null;
    dia?: string;
  },
): Promise<{ created: boolean; proof: IdentityProof | null }> {
  const dia = opts.dia ?? hojeISO();
  const label = opts.label.trim().slice(0, 160);
  if (!label) return { created: false, proof: null };

  const row = {
    user_id: opts.userId,
    source_type: opts.sourceType,
    source_id: opts.sourceId,
    atributo: opts.atributo?.trim() || null,
    label,
    dia,
  };

  const { data, error } = await supabaseAdmin
    .from("identity_proofs")
    .upsert(row, {
      onConflict: "user_id,source_type,source_id,dia",
      ignoreDuplicates: true,
    })
    .select(PROOF_COLS)
    .maybeSingle();

  if (error) {
    if (/does not exist|identity_proofs/i.test(error.message)) {
      return { created: false, proof: null };
    }
    // duplicate / race
    if (/duplicate|unique/i.test(error.message)) {
      return { created: false, proof: null };
    }
    console.warn("[identity-proof] emit", error.message);
    return { created: false, proof: null };
  }

  if (!data) {
    // ignoreDuplicates → sem row quando já existia
    return { created: false, proof: null };
  }

  return {
    created: true,
    proof: data as unknown as IdentityProof,
  };
}

export async function getIdentityProofStats(
  supabase: Client,
  userId: string,
  dia = hojeISO(),
): Promise<IdentityProofStats> {
  const weekStart = addDaysToDateKey(dia, -6);

  const [weekRes, totalRes] = await Promise.all([
    supabase
      .from("identity_proofs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("dia", weekStart)
      .lte("dia", dia),
    supabase
      .from("identity_proofs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);

  if (weekRes.error && /does not exist|identity_proofs/i.test(weekRes.error.message)) {
    return { week: 0, total: 0 };
  }
  if (totalRes.error && /does not exist|identity_proofs/i.test(totalRes.error.message)) {
    return { week: 0, total: 0 };
  }

  return {
    week: weekRes.count ?? 0,
    total: totalRes.count ?? 0,
  };
}

export async function listRecentIdentityProofs(
  supabase: Client,
  userId: string,
  limit = 20,
): Promise<IdentityProof[]> {
  const { data, error } = await supabase
    .from("identity_proofs")
    .select(PROOF_COLS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (/does not exist|identity_proofs/i.test(error.message)) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as unknown as IdentityProof[];
}

/** Arco narrativo de identidade (copy) — não altera capitulo_atual. */
export function identityArcForChapter(capitulo: number): {
  nivel: number;
  nome: string;
  frase: string;
} {
  const arcs = [
    { nivel: 1, nome: "Intenção", frase: "Quero mudar." },
    { nivel: 2, nome: "Experimentação", frase: "Estou tentando." },
    { nivel: 3, nome: "Consistência", frase: "Estou começando a me tornar." },
    { nivel: 4, nome: "Identidade", frase: "Isso começa a fazer parte de quem sou." },
    { nivel: 5, nome: "Consolidação", frase: "A nova identidade se estabiliza." },
    { nivel: 6, nome: "Integração", frase: "Levo isso de volta à vida comum." },
    { nivel: 7, nome: "Maestria", frase: "Não preciso mais pensar para agir." },
  ] as const;
  const idx = Math.min(Math.max(capitulo, 1), 7) - 1;
  return arcs[idx];
}

export function formatIdentityProofsForMentor(opts: {
  alterEgoNome?: string | null;
  stats: IdentityProofStats;
  recentLabels?: string[];
  identidadeHoje?: string | null;
}): string {
  const lines = [
    "PROVAS DE IDENTIDADE",
    opts.alterEgoNome
      ? `Alter Ego ativo: ${opts.alterEgoNome}`
      : "Alter Ego: ainda não definido",
    `Provas esta semana: ${opts.stats.week}`,
    `Provas totais: ${opts.stats.total}`,
  ];
  if (opts.identidadeHoje) {
    lines.push(`Check-in identidade hoje: ${opts.identidadeHoje}`);
  } else {
    lines.push("Check-in identidade hoje: ausente");
  }
  if (opts.recentLabels?.length) {
    lines.push(`Provas recentes: ${opts.recentLabels.slice(0, 5).join(" | ")}`);
  }
  lines.push(
    "No fechamento do dia (evening), faça um relatório curto de identidade: compromissos, provas, e que um dia fraco não destrói quem o herói decidiu se tornar.",
  );
  return lines.join("\n");
}
