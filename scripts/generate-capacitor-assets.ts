/**
 * Gera assets/icon.png + splash a partir de public/charlie-ico.ico e logo.png
 * Usage: npx tsx scripts/generate-capacitor-assets.ts
 */
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import decodeIco from "decode-ico";
import sharp from "sharp";

const root = process.cwd();
const assets = join(root, "assets");
mkdirSync(assets, { recursive: true });

const srcIco = join(root, "public", "charlie-ico.ico");
const srcLogo = join(root, "public", "logo.png");
const bg = { r: 27, g: 27, b: 27, alpha: 1 };

async function makeIcon() {
  const out = join(assets, "icon.png");
  try {
    const frames = decodeIco(readFileSync(srcIco));
    const best = [...frames].sort((a, b) => b.width * b.height - a.width * a.height)[0];
    if (!best) throw new Error("ICO sem frames");
    const pngBuf =
      best.type === "png"
        ? Buffer.from(best.data)
        : await sharp(Buffer.from(best.data), {
            raw: { width: best.width, height: best.height, channels: 4 },
          })
            .png()
            .toBuffer();
    await sharp(pngBuf)
      .resize(1024, 1024, { fit: "contain", background: bg })
      .png()
      .toFile(out);
    console.log("icon.png ← charlie-ico.ico");
  } catch (e) {
    console.warn("ICO decode failed, fallback logo:", (e as Error).message);
    await sharp(srcLogo)
      .resize(1024, 1024, { fit: "contain", background: bg })
      .png()
      .toFile(out);
    console.log("icon.png ← logo.png (fallback)");
  }
}

async function makeSplash() {
  const logoBuf = await sharp(srcLogo).resize(640, 640, { fit: "inside" }).png().toBuffer();
  const size = 2732;
  const splashPath = join(assets, "splash.png");
  await sharp({
    create: { width: size, height: size, channels: 3, background: { r: 27, g: 27, b: 27 } },
  })
    .composite([{ input: logoBuf, gravity: "centre" }])
    .png()
    .toFile(splashPath);
  await sharp(splashPath).toFile(join(assets, "splash-dark.png"));
  console.log("splash.png / splash-dark.png");
}

await makeIcon();
await makeSplash();
console.log("OK → assets/");
