import { cpSync, mkdirSync, existsSync, rmSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, "..", "dist");
const backendStatic = join(__dirname, "..", "..", "backend", "static");
const indexHtmlDist = join(distDir, "index.html");

if (!existsSync(distDir)) {
  console.error("dist/ not found. Run vite build first.");
  process.exit(1);
}

const rawBase = process.env.APP_PUBLIC_URL ?? "https://countriesof.earth";
const appPublicUrl = rawBase.replace(/\/$/, "");
if (!/^https?:\/\//i.test(appPublicUrl)) {
  console.error("APP_PUBLIC_URL must be an absolute http(s) URL, got:", rawBase);
  process.exit(1);
}

let indexHtml = readFileSync(indexHtmlDist, "utf8");
if (!indexHtml.includes("__APP_PUBLIC_URL__")) {
  console.error("dist/index.html missing __APP_PUBLIC_URL__ placeholder");
  process.exit(1);
}
indexHtml = indexHtml.split("__APP_PUBLIC_URL__").join(appPublicUrl);
writeFileSync(indexHtmlDist, indexHtml, "utf8");
console.log(`Injected APP_PUBLIC_URL=${appPublicUrl} into dist/index.html`);

for (const name of ["robots.txt", "sitemap.xml"]) {
  const p = join(distDir, name);
  if (!existsSync(p)) {
    console.warn(`dist/${name} not found, skip URL inject`);
    continue;
  }
  let text = readFileSync(p, "utf8");
  if (!text.includes("__APP_PUBLIC_URL__")) {
    console.warn(`dist/${name} missing __APP_PUBLIC_URL__, skip inject`);
    continue;
  }
  text = text.split("__APP_PUBLIC_URL__").join(appPublicUrl);
  writeFileSync(p, text, "utf8");
  console.log(`Injected APP_PUBLIC_URL into dist/${name}`);
}

if (existsSync(backendStatic)) {
  rmSync(backendStatic, { recursive: true });
}
mkdirSync(backendStatic, { recursive: true });
cpSync(distDir, backendStatic, { recursive: true });
console.log("Copied dist/ to backend/static/");
