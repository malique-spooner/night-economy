import { createReadStream, existsSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { startMarketRunner } from "./market-runner.mjs";
import { createFridayNightSimulation } from "./src/fridayNight.mjs";

const port = Number(process.env.POS_SIMULATOR_PORT ?? 3002);
const root = fileURLToPath(new URL(".", import.meta.url));
const publicRoot = join(root, "public");
let simulator = createFridayNightSimulation();
let previousTick = Date.now();
let marketRunnerTimer;

setInterval(() => {
  const now = Date.now();
  simulator.tick(now - previousTick);
  previousTick = now;
}, 250).unref();

createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
    if (request.method === "OPTIONS") return sendJson(response, 204, {});

    if (url.pathname === "/v1/products" && request.method === "GET") {
      return sendJson(response, 200, { products: simulator.getProducts() });
    }
    if (url.pathname === "/v1/sales" && request.method === "GET") {
      return sendJson(response, 200, { sales: simulator.getSales(url.searchParams.get("since")) });
    }
    if (url.pathname === "/v1/price-publications" && request.method === "POST") {
      return sendJson(response, 200, simulator.publishPrices(await readJson(request)));
    }
    if (url.pathname === "/v1/simulation/state" && request.method === "GET") {
      return sendJson(response, 200, simulator.getState());
    }
    if (url.pathname === "/v1/simulation/control" && request.method === "POST") {
      const body = await readJson(request);
      if (body.action === "reset") simulator = createFridayNightSimulation();
      return sendJson(response, 200, simulator.control(body));
    }
    if (url.pathname === "/v1/simulation/events" && request.method === "POST") {
      return sendJson(response, 200, simulator.injectEvent(await readJson(request)));
    }

    return serveStatic(url.pathname, response);
  } catch (error) {
    return sendJson(response, 400, { error: error instanceof Error ? error.message : "Simulator request failed" });
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`POS Simulator running at http://127.0.0.1:${port}`);
  if (process.env.POS_SIMULATOR_DISABLE_MARKET_RUNNER === "1") return;
  void startMarketRunner()
    .then(timer => { marketRunnerTimer = timer; })
    .catch(error => console.error(`Local price updates are unavailable: ${error instanceof Error ? error.message : "Unknown error"}`));
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    if (marketRunnerTimer) clearInterval(marketRunnerTimer);
    process.exit(0);
  });
}

function serveStatic(pathname, response) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = normalize(join(publicRoot, requestedPath));
  if (!filePath.startsWith(publicRoot) || !existsSync(filePath)) return sendJson(response, 404, { error: "Not found" });

  const contentType = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
  }[extname(filePath)] ?? "application/octet-stream";
  response.writeHead(200, { "content-type": contentType });
  createReadStream(filePath).pipe(response);
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const source = Buffer.concat(chunks).toString("utf8");
  return source ? JSON.parse(source) : {};
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-origin": "*",
    "content-type": "application/json; charset=utf-8",
  });
  response.end(status === 204 ? "" : JSON.stringify(body));
}
