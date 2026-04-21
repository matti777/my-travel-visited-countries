/**
 * Builds assets/images/og-preview.jpg (1200×630) for Open Graph link previews.
 * Title uses @resvg/resvg-js + official Dancing Script TTF (same family as the app).
 * Title gradient is light (white → pale gray) for contrast on the darkened OG background; soft drop shadow unchanged.
 * Run: node scripts/generate-og-preview.mjs
 */

import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import { readFileSync, existsSync, statSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const repoRoot = join(__dirname, "..", "..");
const imagesDir = join(root, "assets", "images");
const outPath = join(imagesDir, "og-preview.jpg");
const fontPath = join(repoRoot, "resources", "fonts", "DancingScript-wght.ttf");

const W = 1200;
const H = 630;

/** Top white, bottom slightly light gray — readable on dark overlay */
const GRAD_TOP = "#ffffff";
const GRAD_BOTTOM = "#e4e4e4";

/** Matches welcome-view__brand-title: font-size ~108px; em relative to font-size */
const TITLE_FONT_SIZE = 108;
/** drop-shadow(0 0.06em 0.14em rgba(0, 0, 0, 0.28)) */
const TITLE_SHADOW_DY = TITLE_FONT_SIZE * 0.06;
const TITLE_SHADOW_BLUR = TITLE_FONT_SIZE * 0.14;

function load(name) {
  const p = join(imagesDir, name);
  if (!existsSync(p)) {
    console.error(`missing: ${p}`);
    process.exit(1);
  }
  return readFileSync(p);
}

/** Photo tiles — resize, cover crop, rotate only */
async function photoTile(buf, rotateDeg, edgePx) {
  const img = sharp(buf)
    .resize(edgePx, edgePx, { fit: "cover", position: "center" })
    .rotate(rotateDeg, { background: { r: 0, g: 0, b: 0, alpha: 0 } });

  const meta = await img.metadata();
  const w = meta.width ?? edgePx;
  const h = meta.height ?? edgePx;
  return { buf: await img.png().toBuffer(), w, h };
}

function titlePng() {
  if (!existsSync(fontPath)) {
    console.error(`missing font (add from Google Fonts OFL): ${fontPath}`);
    process.exit(1);
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="220">
  <defs>
    <linearGradient id="titleGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${GRAD_TOP}"/>
      <stop offset="100%" stop-color="${GRAD_BOTTOM}"/>
    </linearGradient>
    <filter id="titleShadow" x="-35%" y="-35%" width="170%" height="170%">
      <feDropShadow
        dx="0"
        dy="${TITLE_SHADOW_DY}"
        stdDeviation="${TITLE_SHADOW_BLUR}"
        flood-color="#000000"
        flood-opacity="0.28"
      />
    </filter>
  </defs>
  <text
    x="${W / 2}"
    y="150"
    font-family="Dancing Script"
    font-size="${TITLE_FONT_SIZE}"
    font-weight="700"
    fill="url(#titleGrad)"
    text-anchor="middle"
    filter="url(#titleShadow)"
  >Countries of Earth</text>
</svg>`;

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: W },
    background: "rgba(0,0,0,0)",
    font: {
      fontFiles: [fontPath],
      loadSystemFonts: false,
      defaultFontFamily: "Dancing Script",
    },
  });

  return resvg.render().asPng();
}

async function main() {
  const bgBuf = await sharp(load("background-travel.jpg"))
    .resize(W, H, { fit: "cover", position: "attention" })
    .modulate({ brightness: 0.72, saturation: 1.05 })
    .jpeg({ quality: 88 })
    .toBuffer();

  const p1 = await photoTile(load("welcome-polaroid-1.jpg"), -5, 260);
  const p2 = await photoTile(load("welcome-polaroid-2.jpg"), 4, 260);
  const p3 = await photoTile(load("welcome-polaroid-3.jpg"), 3, 240);
  const p4 = await photoTile(load("welcome-polaroid-4.jpg"), -4, 240);

  const gradient = Buffer.from(
    `<svg width="${W}" height="${H}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0a1628" stop-opacity="0.1"/>
      <stop offset="55%" stop-color="#0a1628" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#0a1628" stop-opacity="0.72"/>
    </linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`,
  );

  const titleBuf = titlePng();

  const composites = [
    { input: gradient, left: 0, top: 0 },
    { input: p1.buf, left: 48, top: 56 },
    { input: p2.buf, left: 320, top: 200 },
    { input: p3.buf, left: W - 300 - 52, top: 72 },
    { input: p4.buf, left: W - 260 - 64, top: 260 },
    { input: titleBuf, left: 0, top: H - 200 },
  ];

  await sharp(bgBuf)
    .composite(composites)
    .jpeg({ quality: 86, mozjpeg: true })
    .toFile(outPath);

  const st = await sharp(outPath).metadata();
  const bytes = statSync(outPath).size;
  console.log(`Wrote ${outPath} (${st.width}×${st.height}, ${bytes} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
