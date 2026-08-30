import { describe, expect, it } from "vitest";
import { resolveAppRoute } from "../../src/routes";

describe("resolveAppRoute", () => {
  it("keeps local view query params working on the React entrypoint", () => {
    expect(resolveAppRoute("/", "?view=site")).toEqual({ surface: "site" });
    expect(resolveAppRoute("/", "?view=tv")).toEqual({ surface: "tv", slug: "demo-venue" });
    expect(resolveAppRoute("/", "?view=mobile")).toEqual({ surface: "menu", slug: "demo-venue" });
    expect(resolveAppRoute("/", "?view=portal")).toEqual({ surface: "app", slug: "demo-venue" });
  });

  it("supports production venue routes", () => {
    expect(resolveAppRoute("/tv/soho-house")).toEqual({ surface: "tv", slug: "soho-house" });
    expect(resolveAppRoute("/menu/soho-house")).toEqual({ surface: "menu", slug: "soho-house" });
    expect(resolveAppRoute("/app/soho-house")).toEqual({ surface: "app", slug: "soho-house" });
    expect(resolveAppRoute("/simulator/soho-house")).toEqual({ surface: "simulator", slug: "soho-house" });
    expect(resolveAppRoute("/sign-in/soho-house")).toEqual({ surface: "sign-in", slug: "soho-house" });
    expect(resolveAppRoute("/venue/soho-house")).toEqual({ surface: "venue", slug: "soho-house" });
    expect(resolveAppRoute("/public-demo")).toEqual({ surface: "public-demo" });
  });

  it("falls back to the public site", () => {
    expect(resolveAppRoute("/")).toEqual({ surface: "site" });
    expect(resolveAppRoute("/not-a-real-route")).toEqual({ surface: "site" });
    expect(resolveAppRoute("/", "?view=unknown")).toEqual({ surface: "site" });
  });
});
