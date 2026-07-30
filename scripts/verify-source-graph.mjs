import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";

const sourceRoot = resolve("src");
const entryFiles = [
  resolve("src/main.tsx"),
  // Canonical deterministic engine used directly by tests and mirrored by the Edge Function.
  resolve("src/engine/pricing.ts"),
];
const sourceExtensions = [".ts", ".tsx", ".js", ".jsx", ".mjs"];
const sourceFiles = walk(sourceRoot).filter(file => sourceExtensions.includes(extname(file)) && !file.endsWith(".d.ts"));
const reachable = new Set();

entryFiles.forEach(visit);

const unreachable = sourceFiles.filter(file => !reachable.has(file));
if (unreachable.length) {
  console.error("Unreachable source files found:\n" + unreachable.map(file => `- ${relative(process.cwd(), file)}`).join("\n"));
  process.exit(1);
}

console.log(`Source graph verified: ${reachable.size} files are reachable from ${entryFiles.length} declared entry points.`);

function visit(file) {
  if (reachable.has(file)) return;
  reachable.add(file);

  const source = readFileSync(file, "utf8");
  const imports = source.matchAll(/(?:from\s+|import\s*\()\s*["']([^"']+)["']/g);
  for (const match of imports) {
    if (!match[1].startsWith(".")) continue;
    const dependency = resolveImport(file, match[1]);
    if (dependency?.startsWith(sourceRoot)) visit(dependency);
  }
}

function resolveImport(importer, specifier) {
  const target = resolve(dirname(importer), specifier);
  const candidates = [
    target,
    ...sourceExtensions.map(extension => target + extension),
    ...sourceExtensions.map(extension => join(target, `index${extension}`)),
  ];
  return candidates.find(candidate => existsSync(candidate) && statSync(candidate).isFile());
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}
