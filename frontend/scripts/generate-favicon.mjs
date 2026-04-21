/**
 * Generates favicon and touch icons from resources/sun-favicon.svg (cartoon sun, transparent background).
 * Run: node scripts/generate-favicon.mjs
 */

import sharp from "sharp";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const src = join(root, "resources", "sun-favicon.svg");
const publicDir = join(root, "public");

if (!existsSync(src)) {
  console.error(`missing source image: ${src}`);
  process.exit(1);
}
mkdirSync(publicDir, { recursive: true });

const svgOut = join(publicDir, "sun-favicon.svg");
writeFileSync(svgOut, readFileSync(src));
console.log(`wrote ${svgOut}`);

async function writePng(size, outName) {
  const out = join(publicDir, outName);
  await sharp(src)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(out);
  console.log(`wrote ${out}`);
}

await writePng(16, "favicon-16x16.png");
await writePng(32, "favicon-32x32.png");
await writePng(180, "apple-touch-icon.png");
