/**
 * Downloads thumbnail flag images (JPEG) from flagcdn.com for all sovereign
 * countries listed in country-codes.json. Writes files to assets/images/<code>.jpg.
 * Run from frontend dir: node scripts/download-flag-assets.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = resolve(__dirname, "..");
const CODES_PATH = join(__dirname, "country-codes.json");
const IMAGES_DIR = join(FRONTEND_ROOT, "assets", "images");
const BASE_URL = "https://flagcdn.com/w40";
const CONCURRENCY = 5;
const RETRIES = 2;
const RETRY_DELAY_MS = 500;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(url) {
  let lastErr;
  for (let i = 0; i <= RETRIES; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      lastErr = err;
      if (i < RETRIES) await sleep(RETRY_DELAY_MS);
    }
  }
  throw lastErr;
}

async function downloadOne(code) {
  const url = `${BASE_URL}/${code}.jpg`;
  const buf = await fetchWithRetry(url);
  const outPath = join(IMAGES_DIR, `${code}.jpg`);
  writeFileSync(outPath, buf);
}

async function run() {
  const codes = JSON.parse(readFileSync(CODES_PATH, "utf8"));
  if (!Array.isArray(codes) || codes.some((c) => typeof c !== "string" || c.length !== 2)) {
    throw new Error("country-codes.json must be an array of 2-letter strings");
  }

  if (!existsSync(IMAGES_DIR)) {
    mkdirSync(IMAGES_DIR, { recursive: true });
  }

  let done = 0;
  const total = codes.length;
  for (let i = 0; i < codes.length; i += CONCURRENCY) {
    const batch = codes.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (code) => {
        try {
          await downloadOne(code);
          done++;
          if (done % 20 === 0 || done === total) {
            console.log(`Downloaded ${done}/${total} (${code}.jpg)`);
          }
        } catch (err) {
          console.error(`Failed ${code}: ${err.message}`);
        }
      })
    );
    if (i + CONCURRENCY < codes.length) await sleep(80);
  }
  console.log(`Done. ${done} flag images in ${IMAGES_DIR}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
