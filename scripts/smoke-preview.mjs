import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

const host = "127.0.0.1";
const port = Number(process.env.SMOKE_PREVIEW_PORT ?? 4173);
const baseUrl = `http://${host}:${port}`;
const directRoutes = [
  "/Night-Economy/",
  "/",
  "/?view=site",
  "/?view=tv",
  "/?view=mobile",
  "/?view=portal",
  "/portal",
  "/tv-view",
  "/mobile-view",
  "/tv/demo-venue",
  "/menu/demo-venue",
  "/app/demo-venue",
  "/simulator/demo-venue",
  "/venue/demo-venue",
];

await run("npm", ["run", "build"]);
await assertCloudflareWorkerAssets();

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

async function assertCloudflareWorkerAssets() {
  const config = JSON.parse(await readFile("wrangler.domain-proxy.jsonc", "utf8"));
  if (config.assets?.directory !== "./dist" || config.assets?.not_found_handling !== "single-page-application") {
    throw new Error("Cloudflare Worker must serve the built app from dist with SPA routing enabled.");
  }
}
