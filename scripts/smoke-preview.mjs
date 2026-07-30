import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

const host = "127.0.0.1";
const port = Number(process.env.SMOKE_PREVIEW_PORT ?? 4173);
const baseUrl = `http://${host}:${port}`;
const directRoutes = [
  "/",
  "/?view=site",
  "/?view=tv",
  "/?view=mobile",
  "/?view=portal",
  "/tv/demo-venue",
  "/menu/demo-venue",
  "/app/demo-venue",
  "/simulator/demo-venue",
  "/venue/demo-venue",
];

await run("npm", ["run", "build"]);
const cloudflareRoutes = await assertCloudflareRedirects();

const server = spawn(
  "npm",
  ["run", "preview", "--", "--host", host, "--port", String(port), "--strictPort"],
  { stdio: "inherit" },
);
let previewReady = false;
const earlyExit = new Promise((_, reject) => {
  server.once("exit", (code, signal) => {
    if (!previewReady) {
      reject(new Error(`Preview server exited early with ${signal ?? code}`));
    }
  });
});

try {
  await Promise.race([waitForServer(`${baseUrl}/`), earlyExit]);
  previewReady = true;

  for (const route of directRoutes) {
    const response = await fetch(`${baseUrl}${route}`);
    if (!response.ok) {
      throw new Error(`${route} returned ${response.status}`);
    }
    console.log(`ok ${route}`);
  }

  for (const [route, target] of Object.entries(cloudflareRoutes)) {
    const response = await fetch(`${baseUrl}${target}`);
    if (!response.ok) {
      throw new Error(`${route} resolved to ${target}, but ${target} returned ${response.status}`);
    }
    console.log(`ok ${route} -> ${target}`);
  }

  console.log("Preview smoke test passed.");
} finally {
  server.kill("SIGTERM");
  await waitForExit(server);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
      }
    });
  });
}

async function waitForServer(url) {
  const deadline = Date.now() + 15000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      await sleep(250);
    }
  }

  throw new Error(`Preview server did not start at ${url}`);
}

function waitForExit(child) {
  return new Promise(resolve => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve();
      return;
    }

    child.on("exit", resolve);
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function assertCloudflareRedirects() {
  const redirects = await readFile("dist/_redirects", "utf8");
  const rules = parseRedirectRules(redirects);
  const expectedRules = [
    { source: "/*", target: "/index.html", status: "200" },
  ];

  if (JSON.stringify(rules) !== JSON.stringify(expectedRules)) {
    throw new Error("Cloudflare Pages redirects must send all app routes to the React entrypoint.");
  }

  const expectedRouteTargets = {
    "/tv/demo-venue": "/index.html",
    "/menu/demo-venue": "/index.html",
    "/app/demo-venue": "/index.html",
    "/simulator/demo-venue": "/index.html",
    "/venue/demo-venue": "/index.html",
    "/not-a-real-route": "/index.html",
  };

  for (const [route, target] of Object.entries(expectedRouteTargets)) {
    const actualTarget = resolveRedirectTarget(route, rules);
    if (actualTarget !== target) {
      throw new Error(`Cloudflare route ${route} resolved to ${actualTarget}, expected ${target}.`);
    }
  }

  return expectedRouteTargets;
}

function parseRedirectRules(source) {
  return source
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith("#"))
    .map(line => {
      const [ruleSource, target, status] = line.split(/\s+/);
      return { source: ruleSource, target, status };
    });
}

function resolveRedirectTarget(route, rules) {
  return rules.find(rule => matchesRedirectSource(route, rule.source))?.target;
}

function matchesRedirectSource(route, source) {
  if (source.endsWith("/*")) {
    return route === source.slice(0, -2) || route.startsWith(source.slice(0, -1));
  }

  return route === source;
}
