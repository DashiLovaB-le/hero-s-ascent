import fs from "fs";

const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const projectRef = process.env.SUPABASE_PROJECT_ID?.trim() || "gmzddccyikpxbiozsiue";
const migrationPath =
  process.argv[2] || "supabase/migrations/20260811160000_discord_notifications.sql";

if (!token) {
  console.error("SUPABASE_ACCESS_TOKEN missing");
  process.exit(1);
}

const query = fs.readFileSync(migrationPath, "utf8");
const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query }),
});

const text = await res.text();
console.log(res.status, text.slice(0, 3000));
if (!res.ok) process.exit(1);
