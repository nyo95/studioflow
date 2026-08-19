#!/usr/bin/env node
/**
 * Runs the `*.test.ts` files under `src/` with Node's built-in test runner.
 *
 * The project has no test framework and this deliberately does not add one.
 * What it does is close the two gaps that stop `node --test` from reading the
 * repo's TypeScript directly:
 *
 *   1. TypeScript is transpiled to `tmp/test-out` (types only, no type checking
 *      — `npx tsc --noEmit` already covers that and covers all of `src/`).
 *   2. Emitted imports are rewritten so Node can resolve them: relative imports
 *      get their `.js` extension back, and `@/…` aliases become relative paths.
 *
 * Only files reachable from a test are compiled, so a test may not import
 * anything that reaches Prisma or `server-only` at runtime. Type-only imports
 * are fine — they disappear. That constraint is the point: it keeps the tested
 * code free of I/O.
 *
 * Usage: node scripts/run-tests.mjs [pattern]
 */

import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, dirname, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SRC = join(ROOT, "src");
const OUT = join(ROOT, "tmp", "test-out");
const pattern = process.argv[2] ?? "";

function walk(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "generated" || entry === "node_modules") continue;
      found.push(...walk(full));
    } else if (/\.test\.tsx?$/.test(entry)) {
      found.push(full);
    }
  }
  return found;
}

const testFiles = walk(SRC).filter((f) => f.includes(pattern));

if (testFiles.length === 0) {
  console.error(pattern ? `No test files matching "${pattern}".` : "No test files found.");
  process.exit(1);
}

console.log(`Compiling ${testFiles.length} test file(s)…`);

// tsc reports the `@/…` imports it cannot resolve and still emits correct JS,
// because every one of them in tested code is type-only. Those specific errors
// are filtered out; anything else is surfaced.
const tsc = spawnSync(
  "npx",
  [
    "tsc",
    ...testFiles.map((f) => relative(ROOT, f)),
    "--outDir", relative(ROOT, OUT),
    "--module", "esnext",
    "--target", "es2022",
    "--moduleResolution", "bundler",
    "--skipLibCheck",
    "--rootDir", "src",
  ],
  { cwd: ROOT, encoding: "utf8", shell: true }
);

const realErrors = (tsc.stdout ?? "")
  .split("\n")
  .filter((line) => line.trim() && !/Cannot find module '@\//.test(line));

if (realErrors.length > 0) {
  console.error(realErrors.join("\n"));
  process.exit(1);
}

/** Rewrites emitted imports so Node can resolve them from disk. */
function patchImports(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      patchImports(full);
      continue;
    }
    if (!entry.endsWith(".js")) continue;

    // Both quote styles: the repo's existing test file uses single quotes and
    // tsc preserves whichever the source used.
    const patched = readFileSync(full, "utf8").replace(
      /(\bfrom\s+)(['"])([^'"]+)\2/g,
      (match, from, quote, spec) => {
        if (spec.startsWith("node:") || spec.endsWith(".js")) return match;

        // "@/lib/x" → a path relative to this emitted file
        if (spec.startsWith("@/")) {
          const target = join(OUT, spec.slice(2));
          let rel = relative(dirname(full), target).replace(/\\/g, "/");
          if (!rel.startsWith(".")) rel = `./${rel}`;
          return `${from}${quote}${rel}.js${quote}`;
        }

        if (spec.startsWith(".")) return `${from}${quote}${spec}.js${quote}`;
        return match;
      }
    );

    writeFileSync(full, patched);
  }
}

patchImports(OUT);

const compiled = walk(OUT.replace(/\\/g, "/")).length;
void compiled;

function collectCompiledTests(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...collectCompiledTests(full));
    else if (entry.endsWith(".test.js")) found.push(full);
  }
  return found;
}

const result = spawnSync("node", ["--test", ...collectCompiledTests(OUT)], {
  cwd: ROOT,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
