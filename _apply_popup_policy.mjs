import fs from "fs";
import { spawnSync } from "child_process";

const env = fs.readFileSync(".env", "utf8");
const m = env.match(/^SUPABASE_TOKEN=(.+)$/m);
if (!m) process.exit(1);
const token = m[1].trim();
const sql = `
DROP POLICY IF EXISTS popup_images_public_read ON storage.objects;
CREATE POLICY popup_images_public_read
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'popup-images');
`;
fs.writeFileSync("_tmp_aff_body.json", JSON.stringify({ query: sql }));
const r = spawnSync(
  "curl.exe",
  [
    "-sS", "-X", "POST",
    "https://api.supabase.com/v1/projects/gmzddccyikpxbiozsiue/database/query",
    "-H", `Authorization: Bearer ${token}`,
    "-H", "Content-Type: application/json",
    "--data-binary", "@_tmp_aff_body.json",
  ],
  { encoding: "utf8" },
);
fs.unlinkSync("_tmp_aff_body.json");
process.stdout.write(r.stdout || "");
process.stderr.write(r.stderr || "");
process.exit(r.status ?? 1);
