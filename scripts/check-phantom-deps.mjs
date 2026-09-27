#!/usr/bin/env node
/**
 * Detects phantom dependencies.
 *
 * A phantom dependency is a package that your source imports but does not
 * declare in package.json. It resolves fine on a developer machine (where
 * node_modules is often hoisted, or where the package happens to be present as
 * a transitive dependency) and then fails on any strict, isolated install:
 *
 *   - Vercel / any Docker build
 *   - `pnpm install --frozen-lockfile` in CI
 *   - pnpm's default symlinked node_modules layout
 *
 * The failure surfaces as a confusing "Cannot find module 'x' or its
 * corresponding type declarations" from TypeScript, in a file that looks
 * perfectly correct.
 *
 * Fix: declare the package in package.json. Do NOT rely on hoisting.
 *
 * Usage:  node scripts/check-phantom-deps.mjs
 * Exit:   0 = clean, 1 = phantom dependencies found
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, extname, relative, sep } from "node:path";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));

const declared = new Set([
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.devDependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
  ...Object.keys(pkg.optionalDependencies || {}),
]);

/** TypeScript resolves `foo` to `@types/foo`, so treat that as declared too. */
function isDeclared(name) {
  return declared.has(name) || declared.has(`@types/${name}`);
}

const ROOTS = [
  "app",
  "components",
  "lib",
  "server",
  "worker",
  "hooks",
  "tests",
  "types",
  "scripts",
  "ml_service",
];

const EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts"]);
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", ".vercel", ".opencode"]);

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (EXTENSIONS.has(extname(entry.name))) yield full;
  }
}

/**
 * Extract module specifiers from a single line of source.
 *
 * Done line-by-line with a simple scan rather than one large regex: a greedy
 * "import ... from" regex backtracks catastrophically on long lines and turns
 * this check into a multi-minute hang.
 */
function specifiersInLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return [];

  // require("x")  /  import("x")  /  await import("x")
  const call = /\b(?:require|import)\(\s*["']([^"']+)["']\s*\)/.exec(line);
  if (call) return [call[1]];

  // import "x"  (side-effect only, no clause)
  const bare = /^import\s+["']([^"']+)["']/.exec(trimmed);
  if (bare) return [bare[1]];

  // import ... from "x"  /  import type ... from "x"
  // The specifier is the final quoted string on the line.
  if (/^import\b/.test(trimmed) || /^export\b.*\bfrom\b/.test(trimmed)) {
    const quoted = line.match(/["']([^"'\n]+)["']/g);
    if (quoted && quoted.length > 0) {
      const last = quoted[quoted.length - 1];
      return [last.slice(1, -1)];
    }
  }

  return [];
}

const NODE_BUILTINS = new Set([
  "assert", "async_hooks", "buffer", "child_process", "cluster", "console", "crypto",
  "dgram", "diagnostics_channel", "dns", "domain", "events", "fs", "http", "http2",
  "https", "inspector", "module", "net", "os", "path", "perf_hooks", "process",
  "punycode", "querystring", "readline", "repl", "stream", "string_decoder", "sys",
  "timers", "tls", "trace_events", "tty", "url", "util", "v8", "vm", "wasi",
  "worker_threads", "zlib",
]);

/** Reduce "@scope/name/sub/path" -> "@scope/name", "name/sub" -> "name". */
function toPackageName(specifier) {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

const found = new Map(); // package name -> Set of relative file paths

for (const root of ROOTS) {
  if (!existsSync(root)) continue;
  for (const file of walk(root)) {
    const source = readFileSync(file, "utf8");
    for (const line of source.split("\n")) {
      for (const specifier of specifiersInLine(line)) {
        // Local paths, path aliases, and node: builtins are not packages.
        if (specifier.startsWith(".") || specifier.startsWith("/") || specifier.startsWith("@/")) continue;
        if (specifier.startsWith("node:")) continue;

        const name = toPackageName(specifier);
        if (NODE_BUILTINS.has(name)) continue;
        if (isDeclared(name)) continue;

        if (!found.has(name)) found.set(name, new Set());
        found.get(name).add(relative(process.cwd(), file).split(sep).join("/"));
      }
    }
  }
}

if (found.size === 0) {
  console.log("OK: no phantom dependencies found.");
  process.exit(0);
}

console.error(`\nPhantom dependencies found: ${found.size}\n`);
console.error("These are imported in source but missing from package.json.");
console.error("They resolve on a hoisted local node_modules but fail on Vercel,");
console.error("Docker, and CI (`pnpm install --frozen-lockfile`).\n");

const MAX_LISTED = 5;
for (const [name, files] of [...found.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  const sorted = [...files].sort();
  console.error(`  ${name}  (${sorted.length} file${sorted.length === 1 ? "" : "s"})`);
  for (const file of sorted.slice(0, MAX_LISTED)) console.error(`      ${file}`);
  if (sorted.length > MAX_LISTED) {
    console.error(`      ... and ${sorted.length - MAX_LISTED} more`);
  }
}

console.error("\nFix: add each package to dependencies (or devDependencies if it is");
console.error("build/test-only), then commit the updated lockfile.\n");
process.exit(1);
