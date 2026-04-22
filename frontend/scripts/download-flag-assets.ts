/**
 * Downloads thumbnail flag images (JPEG) from flagcdn.com for codes in
 * country-codes.json plus standalone map-only codes from src/map-regions.ts.
 * Run from frontend: npx tsx scripts/download-flag-assets.ts
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { MAP_ONLY_FLAG_ASSET_CODES_LOWER } from "../src/map-regions";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = resolve(__dirname, "..");
const CODES_PATH = join(__dirname, "country-codes.json");
const IMAGES_DIR = join(FRONTEND_ROOT, "assets", "images");
const BASE_URL = "https://flagcdn.com/w40";
const CONCURRENCY = 5;
const RETRIES = 2;
const RETRY_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(url: string): Promise<Buffer> {
  let lastErr: unknown;
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

async function downloadOne(code: string): Promise<void> {
  const url = `${BASE_URL}/${code}.jpg`;
  const buf = await fetchWithRetry(url);
  const outPath = join(IMAGES_DIR, `${code}.jpg`);
  writeFileSync(outPath, buf);
}

function readCodesArray(path: string, label: string): string[] {
  const codes = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (!Array.isArray(codes) || codes.some((c) => typeof c !== "string" || c.length !== 2)) {
    throw new Error(`${label} must be an array of 2-letter strings`);
  }
  return codes as string[];
}

async function run(): Promise<void> {
  const sovereign = readCodesArray(CODES_PATH, "country-codes.json");
  const seen = new Set<string>();
  const codes: string[] = [];
  for (const c of [...sovereign, ...MAP_ONLY_FLAG_ASSET_CODES_LOWER]) {
    const lower = c.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      codes.push(lower);
    }
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
          console.error(`Failed ${code}: ${(err as Error).message}`);
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
