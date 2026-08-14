/**
 * Falha se o bundle **client** (o que o browser baixa) contiver
 * nomes de secret, JWT service_role ou valores do .env.
 *
 * Uso: npm run build && npm run check:bundle
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const CLIENT_DIRS = [
  ".vercel/output/static",
  ".output/public",
  "dist/client",
];

const FILE_RE = /\.(js|mjs|cjs|css|html|json|map)$/i;
const MAX_FILE_BYTES = 20 * 1024 * 1024;

/** Identificadores que não podem aparecer no JS/CSS/HTML do browser. */
const FORBIDDEN_MARKERS = [
  "service_role",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENROUTER",
  "CRON_SECRET",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_WEBHOOK_SECRET",
  "DISCORD_BOT_TOKEN",
  "DISCORD_PUBLIC_KEY",
  "DASHI_BOOTSTRAP_EMAIL",
];

const ENV_VALUE_KEYS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENROUTER_API_KEY",
  "CRON_SECRET",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_WEBHOOK_SECRET",
  "DISCORD_BOT_TOKEN",
  "DISCORD_PUBLIC_KEY",
  "DASHI_BOOTSTRAP_EMAIL",
  "ADMIN_BOOTSTRAP_EMAIL",
  "SUPABASE_TOKEN",
  "FIREBASE_SERVICE_ACCOUNT_JSON",
];

const JWT_RE = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;

function walkFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, acc);
      continue;
    }
    if (FILE_RE.test(entry.name)) acc.push(full);
  }
  return acc;
}

function parseEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  for (const raw of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function jwtRole(token) {
  try {
    const payload = token.split(".")[1];
    const json = Buffer.from(payload, "base64url").toString("utf8");
    const parsed = JSON.parse(json);
    return typeof parsed.role === "string" ? parsed.role : null;
  } catch {
    return null;
  }
}

function rel(file) {
  return path.relative(ROOT, file).replaceAll("\\", "/");
}

const hits = [];

function addHit(kind, file, detail) {
  hits.push({ kind, file: rel(file), detail });
}

const dirs = CLIENT_DIRS.map((d) => path.join(ROOT, d)).filter((d) => fs.existsSync(d));
if (dirs.length === 0) {
  console.error(
    "check:bundle: nenhum diretório client encontrado. Rode `npm run build` antes.",
  );
  process.exit(1);
}

const files = [...new Set(dirs.flatMap((d) => walkFiles(d)))];
if (files.length === 0) {
  console.error("check:bundle: diretórios client vazios.", dirs.map(rel));
  process.exit(1);
}

const env = {
  ...parseEnvFile(path.join(ROOT, ".env")),
  ...parseEnvFile(path.join(ROOT, ".env.local")),
};

for (const file of files) {
  const stat = fs.statSync(file);
  if (stat.size > MAX_FILE_BYTES) continue;
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    continue;
  }

  for (const marker of FORBIDDEN_MARKERS) {
    if (text.includes(marker)) addHit("marker", file, marker);
  }

  for (const key of ENV_VALUE_KEYS) {
    const value = env[key];
    if (!value || value.length < 8) continue;
    if (text.includes(value)) addHit("env-value", file, key);
  }

  const jwts = text.match(JWT_RE) ?? [];
  for (const token of jwts) {
    if (jwtRole(token) === "service_role") {
      addHit("service-jwt", file, "JWT com role service_role");
    }
  }
}

if (hits.length) {
  console.error("check:bundle: FALHOU — material sensível no bundle client:\n");
  for (const h of hits) {
    console.error(`  [${h.kind}] ${h.detail}  ←  ${h.file}`);
  }
  console.error(`\n${hits.length} ocorrência(s) em ${dirs.map(rel).join(", ")}`);
  process.exit(1);
}

console.log(
  `check:bundle: ok — ${files.length} arquivo(s) em ${dirs.map(rel).join(", ")} sem service_role / secrets / tokens de bot.`,
);
