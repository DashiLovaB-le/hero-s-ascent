/**
 * One-shot: seed charlie_wisdom_cards via service role.
 * Usage: npx tsx scripts/seed-wisdom-cards.ts
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { CHARLIE_WISDOM_SEED } from "../src/mentor/wisdom.seed";

function env(name: string): string {
  const raw = readFileSync(".env", "utf8");
  const m = raw.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!m) return "";
  return m[1].trim().replace(/^["']|["']$/g, "");
}

async function main() {
  const url = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("SUPABASE_URL / SERVICE_ROLE_KEY missing");

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const rows = CHARLIE_WISDOM_SEED.map((c) => ({
    slug: c.slug,
    source: c.source,
    titulo: c.titulo,
    principio: c.principio,
    quando_usar: c.quando_usar,
    quando_evitar: c.quando_evitar,
    tags: c.tags,
    keywords: c.keywords,
    blocked_personalities: c.blocked_personalities,
    priority: c.priority,
    ativo: true,
    updated_at: new Date().toISOString(),
  }));

  const { error, count } = await sb
    .from("charlie_wisdom_cards")
    .upsert(rows, { onConflict: "slug", count: "exact" });

  if (error) throw new Error(error.message);

  const { count: total, error: e2 } = await sb
    .from("charlie_wisdom_cards")
    .select("id", { count: "exact", head: true });
  if (e2) throw new Error(e2.message);

  console.log(JSON.stringify({ upserted: count ?? rows.length, total: total ?? 0 }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
