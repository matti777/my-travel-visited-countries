import { cpSync, mkdirSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, "..", "dist");
const backendStatic = join(__dirname, "..", "..", "backend", "static");

if (!existsSync(distDir)) {
  console.error("dist/ not found. Run vite build first.");
  process.exit(1);
}
mkdirSync(backendStatic, { recursive: true });
cpSync(distDir, backendStatic, { recursive: true });
console.log("Copied dist/ to backend/static/");
