import { readFileSync } from "node:fs";

const configPath = "wrangler.jsonc";
const config = JSON.parse(readFileSync(configPath, "utf8"));
const errors = [];

if (config.name !== "night-economy") {
  errors.push(`${configPath}: name must be night-economy.`);
}

if (config.pages_build_output_dir !== "./dist") {
  errors.push(`${configPath}: pages_build_output_dir must be ./dist.`);
}

if (!/^\d{4}-\d{2}-\d{2}$/.test(config.compatibility_date ?? "")) {
  errors.push(`${configPath}: compatibility_date must use YYYY-MM-DD.`);
}

for (const key of Object.keys(config.vars ?? {})) {
  if (/SUPABASE_SERVICE_ROLE|SCHEDULER_SECRET/i.test(key)) {
    errors.push(`${configPath}: ${key} must not be configured as a Cloudflare Pages frontend variable.`);
  }
}

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
if (packageJson.engines?.node !== ">=22") {
  errors.push("package.json: engines.node must be >=22.");
}

if (packageJson.scripts?.["build:production"] !== "npm run runtime:verify && npm run check:env && npm run build") {
  errors.push("package.json: build:production must validate runtime and env before building.");
}

if (errors.length) {
  console.error("Cloudflare Pages verification failed:");
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log("Cloudflare Pages verification passed.");
