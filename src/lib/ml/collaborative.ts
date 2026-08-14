/**
 * Collaborative filtering leve — similaridade por weekday_rates + atributos.
 * Nunca persiste nem recomenda o título de hábito de outro herói.
 */

import { MIN_CF_PEERS, type CfSuggestion } from "@/lib/ml/agent";

export type CfUser = {
  user_id: string;
  weekday_rates: Record<string, number>;
  /** Atributos já cobertos pelos hábitos do próprio usuário. */
  habit_attrs: string[];
};

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function rateVec(rates: Record<string, number>): number[] {
  return Array.from({ length: 7 }, (_, i) => Number(rates[String(i)] ?? rates[i] ?? 0));
}

function normalizeAttr(value: string | null | undefined): string | null {
  const key = (value ?? "").trim().toLowerCase();
  return key || null;
}

/**
 * Para cada usuário, encontra peers por cosine(weekday_rates) e sugere
 * um atributo comum entre peers que o usuário ainda não cobre.
 */
export function computeCfRecommendations(
  users: CfUser[],
  opts?: { minPeers?: number; topK?: number },
): Map<string, { peer_count: number; suggestions: CfSuggestion[]; explicacao: Record<string, unknown> }> {
  const minPeers = opts?.minPeers ?? MIN_CF_PEERS;
  const topK = opts?.topK ?? 3;
  const out = new Map<
    string,
    { peer_count: number; suggestions: CfSuggestion[]; explicacao: Record<string, unknown> }
  >();

  if (users.length < minPeers + 1) {
    for (const u of users) {
      out.set(u.user_id, {
        peer_count: 0,
        suggestions: [],
        explicacao: { skip: "insufficient_global_n", n: users.length, minPeers },
      });
    }
    return out;
  }

  for (const target of users) {
    const tv = rateVec(target.weekday_rates);
    const scored = users
      .filter((u) => u.user_id !== target.user_id)
      .map((u) => ({ user: u, sim: cosine(tv, rateVec(u.weekday_rates)) }))
      .filter((x) => x.sim > 0.35)
      .sort((a, b) => b.sim - a.sim);

    const peers = scored.slice(0, 12);
    if (peers.length < minPeers) {
      out.set(target.user_id, {
        peer_count: peers.length,
        suggestions: [],
        explicacao: { skip: "insufficient_peers", peers: peers.length, minPeers },
      });
      continue;
    }

    const mine = new Set(
      target.habit_attrs.map((a) => normalizeAttr(a)).filter((a): a is string => Boolean(a)),
    );
    const votes = new Map<string, { score: number; count: number }>();

    for (const p of peers) {
      const seen = new Set<string>();
      for (const raw of p.user.habit_attrs) {
        const attr = normalizeAttr(raw);
        if (!attr || mine.has(attr) || seen.has(attr)) continue;
        seen.add(attr);
        const prev = votes.get(attr) ?? { score: 0, count: 0 };
        prev.score += p.sim;
        prev.count += 1;
        votes.set(attr, prev);
      }
    }

    const suggestions: CfSuggestion[] = [...votes.entries()]
      .map(([atributo, v]) => ({
        titulo: atributo,
        atributo,
        score: Math.round((v.score / Math.max(1, v.count)) * 1000) / 1000,
        from_peers: v.count,
      }))
      .filter((s) => s.from_peers >= 2)
      .sort((a, b) => b.score - a.score || b.from_peers - a.from_peers)
      .slice(0, topK);

    out.set(target.user_id, {
      peer_count: peers.length,
      suggestions,
      explicacao: {
        model: "cf_weekday_v1",
        top_peer_sims: peers.slice(0, 3).map((p) => Math.round(p.sim * 1000) / 1000),
      },
    });
  }

  return out;
}
