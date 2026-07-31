/**
 * Aplica DDL de personalidades + seed via Management API.
 * Uso: node --import tsx scripts/seed-charlie-personalities.mts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CHARLIE_PERSONALITY_SEEDS } from "../src/mentor/personalities.seed.ts";

const PROJECT_ID = "gmzddccyikpxbiozsiue";
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!TOKEN) {
  console.error("Missing SUPABASE_ACCESS_TOKEN");
  process.exit(1);
}

async function runSql(query: string, label: string) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    },
  );
  const text = await res.text();
  if (!res.ok) {
    console.error(`FAIL ${label}`, res.status, text);
    throw new Error(`${label} failed`);
  }
  console.log(`OK ${label}`, res.status);
  return text;
}

function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

async function main() {
  const migrationPath = resolve(
    "supabase/migrations/20260729170000_mentor_personalities.sql",
  );
  const ddl = readFileSync(migrationPath, "utf8");
  await runSql(ddl, "ddl mentor_personalities");

  for (const seed of CHARLIE_PERSONALITY_SEEDS) {
    const sql = `
INSERT INTO public.mentor_personalities (
  slug, name, tagline, description, system_prompt, is_active, sort_order, updated_at
) VALUES (
  ${sqlLiteral(seed.slug)},
  ${sqlLiteral(seed.name)},
  ${sqlLiteral(seed.tagline)},
  ${sqlLiteral(seed.description)},
  ${sqlLiteral(seed.system_prompt)},
  ${seed.is_active},
  ${seed.sort_order},
  now()
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  tagline = EXCLUDED.tagline,
  description = EXCLUDED.description,
  system_prompt = CASE
    WHEN public.mentor_personalities.system_prompt LIKE 'PLACEHOLDER%'
      OR length(trim(public.mentor_personalities.system_prompt)) < 80
    THEN EXCLUDED.system_prompt
    ELSE public.mentor_personalities.system_prompt
  END,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();
`;
    await runSql(sql, `seed ${seed.slug}`);
  }

  const check = await runSql(
    `select slug, length(system_prompt) as prompt_len, is_active, sort_order from public.mentor_personalities order by sort_order;`,
    "verify",
  );
  console.log(check);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
