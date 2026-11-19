// @ts-check
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const distDir = resolve(__dirname, "../dist");
const errors = [];
const warnings = [];

// 1. Check dist/index.html exists
const indexPath = resolve(distDir, "index.html");
if (!existsSync(indexPath)) {
  errors.push("MISSING: dist/index.html");
} else {
  const html = readFileSync(indexPath, "utf8");

  // 2. Check no .tsx references remain
  if (html.includes(".tsx")) {
    errors.push("CRITICAL: dist/index.html references a .tsx file. Entrypoint was not compiled.");
  }

  // 3. Extract script src references
  const scriptMatches = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)];
  for (const match of scriptMatches) {
    const src = match[1];
    if (src.startsWith("http") || src.startsWith("//")) continue;
    const cleanSrc = src.replace(/^\.\//, "").replace(/^\//, "");
    const refPath = resolve(distDir, cleanSrc);
    if (!existsSync(refPath)) {
      errors.push(`MISSING SCRIPT: referenced in index.html but not found: ${src} -> ${refPath}`);
    }
  }

  // 4. Extract link href references
  const linkMatches = [...html.matchAll(/<link[^>]+href=["']([^"']+)["']/g)];
  for (const match of linkMatches) {
    const href = match[1];
    if (href.startsWith("http") || href.startsWith("//") || href.startsWith("data:")) continue;
    const cleanHref = href.replace(/^\.\//, "").replace(/^\//, "");
    const refPath = resolve(distDir, cleanHref);
    if (!existsSync(refPath)) {
      warnings.push(`MISSING ASSET: link referenced in index.html not found: ${href}`);
    }
  }
}

// 5. Check manifest.json
const manifestPath = resolve(distDir, "manifest.json");
if (!existsSync(manifestPath)) {
  errors.push("MISSING: dist/manifest.json");
} else {
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const main = manifest.main;
    if (!main) {
      errors.push("manifest.json missing 'main' field");
    } else {
      const mainPath = resolve(distDir, main);
      if (!existsSync(mainPath)) {
        errors.push(`manifest.main points to missing file: ${main}`);
      }
    }
  } catch (e) {
    errors.push(`manifest.json is invalid JSON: ${e instanceof Error ? e.message : e}`);
  }
}

if (warnings.length > 0) {
  console.warn("Validation Warnings:");
  warnings.forEach((w) => console.warn("  ⚠", w));
}

if (errors.length > 0) {
  console.error("Build validation FAILED:");
  errors.forEach((e) => console.error("  ✗", e));
  process.exit(1);
} else {
  console.log("✓ Build validation passed. dist/ is UXP-ready and contains all referenced assets.");
}
