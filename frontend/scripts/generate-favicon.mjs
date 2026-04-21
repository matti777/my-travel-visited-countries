/**
 * Generates favicon and touch icons from assets/images/welcome-polaroid-1.jpg.
 * Run: node scripts/generate-favicon.mjs
 */

import sharp from "sharp";
import { existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const src = join(root, "assets", "images", "welcome-polaroid-1.jpg");
const publicDir = join(root, "public");

if (!existsSync(src)) {
  console.error(`missing source image: ${src}`);
  process.exit(1);
}
mkdirSync(publicDir, { recursive: true });

async function writePng(size, outName) {
  const out = join(publicDir, outName);
  await sharp(src)
    .rotate()
    .resize(size, size, { fit: "cover", position: "centre" })
    .png()
    .toFile(out);
  console.log(`wrote ${out}`);
}

await writePng(16, "favicon-16x16.png");
await writePng(32, "favicon-32x32.png");
await writePng(180, "apple-touch-icon.png");
