import { describe, expect, it, vi } from "vitest";
import worker from "../../domain-proxy.js";

describe("domain path migrations", () => {
  it("serves the landing page from the canonical Night Economy root", async () => {
    const fetch = vi.fn(async (request: Request) => new Response(new URL(request.url).pathname));
    const response = await worker.fetch(new Request("https://maliquespooner.com/Night-Economy/"), { ASSETS: { fetch } } as never);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("/");
  });

  it.each(["/night", "/night/", "/night-economy", "/night-economy/trailer"])("redirects legacy route %s to the landing page", async (path) => {
    const response = await worker.fetch(new Request(`https://maliquespooner.com${path}?campaign=old-link`), { ASSETS: { fetch: vi.fn() } } as never);

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("https://maliquespooner.com/Night-Economy/?campaign=old-link");
  });

  it("keeps old app deep links on their matching new routes", async () => {
    const response = await worker.fetch(new Request("https://maliquespooner.com/night-economy/tv-view?venue=demo"), { ASSETS: { fetch: vi.fn() } } as never);

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("https://maliquespooner.com/Night-Economy/tv-view?venue=demo");
  });
});
