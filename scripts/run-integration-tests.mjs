#!/usr/bin/env node
/**
 * Menjalankan test integrasi Prisma terhadap PostgreSQL yang TERPISAH.
 *
 * Dua mode:
 *   npm run test:integration:docker  -> lifecycle db-test dikelola runner
 *   npm run test:integration         -> TEST_DATABASE_URL wajib disediakan
 *
 * Pengaman di bawah sengaja fail-closed. Runner tidak pernah fallback ke
 * DATABASE_URL, menolak host non-loopback, menolak nama DB tanpa akhiran
 * `_test`, dan menolak URL yang sama dengan database runtime/development.
 */

import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const OUT = join(ROOT, "tmp", "integration-test-out");
const INTEGRATION_TSCONFIG = join(ROOT, "tmp", "integration-test.tsconfig.json");
const COMPILED_TEST = join(
  OUT,
  "tests",
  "integration",
  "material-view-service.integration.test.js"
);
const DOCKER_TEST_DATABASE_URL =
  "postgresql://postgres:password@127.0.0.1:55432/studioflow_test?schema=public";
const dockerMode = process.argv.includes("--docker");

function comparableUrl(raw) {
  const url = new URL(raw);
  url.search = "";
  url.hash = "";
  return url.toString();
}

function assertTestDatabaseUrl(raw) {
  if (!raw) {
    throw new Error(
      "TEST_DATABASE_URL is required. Use `npm run test:integration:docker` " +
        "for the disposable database."
    );
  }

  const url = new URL(raw);
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error("TEST_DATABASE_URL must use PostgreSQL.");
  }

  const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
  if (!loopbackHosts.has(url.hostname)) {
    throw new Error("TEST_DATABASE_URL must target a loopback host.");
  }

  const databaseName = decodeURIComponent(url.pathname.slice(1));
  if (!databaseName.endsWith("_test")) {
    throw new Error("The integration-test database name must end with `_test`.");
  }

  for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
    const inherited = process.env[key];
    if (inherited && comparableUrl(inherited) === comparableUrl(raw)) {
      throw new Error(
        `TEST_DATABASE_URL must not equal inherited ${key}; keep the test DB isolated.`
      );
    }
  }

  return { raw, databaseName, host: url.hostname, port: url.port || "5432" };
}

function executable(name) {
  return process.platform === "win32" && (name === "npm" || name === "npx")
    ? `${name}.cmd`
    : name;
}

function run(name, args, options = {}) {
  const executableName = executable(name);
  const isWindowsShim =
    process.platform === "win32" && executableName.endsWith(".cmd");
  const command = isWindowsShim
    ? process.env.ComSpec ?? "cmd.exe"
    : executableName;
  const commandArgs = isWindowsShim
    ? ["/d", "/s", "/c", executableName, ...args]
    : args;
  const result = spawnSync(command, commandArgs, {
    cwd: ROOT,
    stdio: options.capture ? "pipe" : "inherit",
    encoding: options.capture ? "utf8" : undefined,
    env: options.env ?? process.env,
  });

  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    if (options.capture) {
      if (result.stdout) process.stdout.write(result.stdout);
      if (result.stderr) process.stderr.write(result.stderr);
    }
    throw new Error(`${name} ${args.join(" ")} failed with exit code ${result.status}.`);
  }
  return result;
}

function walk(dir, predicate = () => true) {
  if (!existsSync(dir)) return [];
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...walk(full, predicate));
    else if (predicate(full)) found.push(full);
  }
  return found;
}

function resetOutputDirectory() {
  const safeRoot = join(ROOT, "tmp") + sep;
  if (!OUT.startsWith(safeRoot)) {
    throw new Error(`Refusing to clear integration output outside ${safeRoot}.`);
  }
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, "package.json"), '{"type":"module"}\n');
}

function patchCompiledImports() {
  const resolveEmittedTarget = (base) => {
    if (existsSync(`${base}.js`)) return `${base}.js`;
    if (existsSync(base) && statSync(base).isDirectory()) {
      const index = join(base, "index.js");
      if (existsSync(index)) return index;
    }
    return `${base}.js`;
  };

  for (const file of walk(OUT, (candidate) => candidate.endsWith(".js"))) {
    const patched = readFileSync(file, "utf8")
      // `server-only` is a Next bundler marker, not a package at repository
      // root. Test ini sendiri berjalan server-side, jadi marker emitted aman
      // dibuang dari artefak sementara—source production tidak disentuh.
      .replace(/^import\s+["']server-only["'];?\s*$/gm, "")
      .replace(
        /(\bfrom\s+)(["'])([^"']+)\2/g,
        (match, from, quote, specifier) => {
          if (specifier.startsWith("node:") || specifier.endsWith(".js")) {
            return match;
          }
          if (specifier.startsWith("@/")) {
            const target = resolveEmittedTarget(
              join(OUT, "src", specifier.slice(2))
            );
            let next = relative(dirname(file), target).replace(/\\/g, "/");
            if (!next.startsWith(".")) next = `./${next}`;
            return `${from}${quote}${next}${quote}`;
          }
          if (specifier.startsWith(".")) {
            const target = resolveEmittedTarget(resolve(dirname(file), specifier));
            let next = relative(dirname(file), target).replace(/\\/g, "/");
            if (!next.startsWith(".")) next = `./${next}`;
            return `${from}${quote}${next}${quote}`;
          }
          return match;
        }
      );
    writeFileSync(file, patched);
  }
}

function compileIntegrationTest() {
  resetOutputDirectory();
  // Passing source files directly to `tsc` makes TypeScript ignore tsconfig,
  // including the `@/*` path map. A tiny generated project keeps production
  // compiler options while emitting only the integration test dependency tree.
  const integrationTests = walk(join(ROOT, "tests", "integration"), (f) =>
    f.endsWith(".integration.test.ts")
  );
  if (integrationTests.length === 0) {
    throw new Error("No *.integration.test.ts found under tests/integration.");
  }
  writeFileSync(
    INTEGRATION_TSCONFIG,
    `${JSON.stringify(
      {
        extends: "../tsconfig.json",
        compilerOptions: {
          noEmit: false,
          incremental: false,
          outDir: "./integration-test-out",
          rootDir: "..",
          module: "esnext",
          target: "es2022",
          moduleResolution: "bundler",
          skipLibCheck: true,
        },
        files: [
          "../src/types/next-auth.d.ts",
          ...integrationTests.map((f) => relative(join(ROOT, "tmp"), f)),
        ],
        include: [],
      },
      null,
      2
    )}\n`
  );
  const compile = run(
    "npx",
    [
      "tsc",
      "--project",
      relative(ROOT, INTEGRATION_TSCONFIG),
    ],
    { capture: true, allowFailure: true }
  );

  const diagnostics = `${compile.stdout ?? ""}\n${compile.stderr ?? ""}`
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((line) => !/Cannot find module ['"]server-only['"]/.test(line));

  if (compile.status !== 0) {
    const detail = diagnostics.length > 0
      ? diagnostics.join("\n")
      : `tsc exited with code ${compile.status}`;
    throw new Error(`Integration test compilation failed:\n${detail}`);
  }
  if (!existsSync(COMPILED_TEST)) {
    throw new Error("TypeScript did not emit the compiled integration test.");
  }  // Prisma Client v7 is generated as JavaScript + declarations, so tsc uses
  // its types but does not copy its runtime. Mirror that generated package into
  // the disposable output before resolving aliases.
  cpSync(
    join(ROOT, "src", "generated", "prisma"),
    join(OUT, "src", "generated", "prisma"),
    { recursive: true }
  );
  patchCompiledImports();
}

function compose(args, options) {
  return run("docker", ["compose", ...args], options);
}

const configuredUrl = dockerMode
  ? DOCKER_TEST_DATABASE_URL
  : process.env.TEST_DATABASE_URL;
const target = assertTestDatabaseUrl(configuredUrl);
const testEnv = {
  ...process.env,
  NODE_ENV: "test",
  TEST_DATABASE_URL: target.raw,
  DATABASE_URL: target.raw,
  DIRECT_URL: target.raw,
  SKIP_DB_PREFLIGHT: "true",
};

let dockerStarted = false;
try {
  console.log(
    `Integration DB: postgresql://${target.host}:${target.port}/${target.databaseName}`
  );

  if (dockerMode) {
    // Hanya service test yang disentuh. Service `db` dan volume
    // `postgres_data` development tidak pernah masuk command ini.
    compose(["rm", "--stop", "--force", "--volumes", "db-test"], {
      allowFailure: true,
    });
    // Mark ownership before `up`: if health-check/startup itself fails, finally
    // must still attempt to remove the partially-created test container.
    dockerStarted = true;
    compose(["up", "--detach", "--wait", "db-test"]);
  }

  run("npx", ["prisma", "migrate", "deploy"], { env: testEnv });
  compileIntegrationTest();
  const compiledIntegrationTests = walk(join(OUT, "tests", "integration"), (f) =>
    f.endsWith(".integration.test.js")
  );
  run("node", ["--test", ...compiledIntegrationTests.map((f) => relative(ROOT, f))], {
    env: testEnv,
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  if (dockerMode && dockerStarted) {
    compose(["rm", "--stop", "--force", "--volumes", "db-test"], {
      allowFailure: true,
    });
  }
}
