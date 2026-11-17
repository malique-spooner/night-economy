import { readFileSync } from "node:fs";

const configPath = "wrangler.domain-proxy.jsonc";
const config = JSON.parse(readFileSync(configPath, "utf8"));
const errors = [];

if (config.name !== "night-economy-domain-proxy") {
  errors.push(`${configPath}: name must be night-economy-domain-proxy.`);
}

if (config.assets?.directory !== "./dist") {
  errors.push(`${configPath}: assets.directory must be ./dist.`);
}

if (config.assets?.binding !== "ASSETS") {
  errors.push(`${configPath}: assets.binding must be ASSETS.`);
}

if (config.assets?.not_found_handling !== "single-page-application") {
  errors.push(`${configPath}: assets.not_found_handling must be single-page-application.`);
}

if (config.assets?.run_worker_first !== true) {
  errors.push(`${configPath}: assets.run_worker_first must be true for prefix routing.`);
}

for (const route of ["maliquespooner.com/Night-Economy", "maliquespooner.com/Night-Economy/*", "maliquespooner.com/night-economy/*", "maliquespooner.com/night/*"]) {
  if (!config.routes?.some(candidate => candidate.pattern === route)) {
    errors.push(`${configPath}: missing route ${route}.`);
  }
}

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
if (packageJson.engines?.node !== ">=22") {
  errors.push("package.json: engines.node must be >=22.");
}

if (!packageJson.scripts?.["build:production"]?.includes("VITE_APP_BASE_PATH=/Night-Economy/")) {
  errors.push("package.json: build:production must set the /Night-Economy/ asset base path.");
}

if (errors.length) {
  console.error("Cloudflare Worker configuration verification failed:");
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log("Cloudflare Worker configuration verification passed.");
