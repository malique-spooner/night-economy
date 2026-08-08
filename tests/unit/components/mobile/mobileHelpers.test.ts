import { describe, expect, it } from "vitest";
import { mobileCategorySectionId } from "../../../../src/components/mobile/mobileHelpers";

describe("mobileCategorySectionId", () => {
  it("creates stable category section ids", () => {
    expect(mobileCategorySectionId("classic-cocktails")).toBe("mobile-category-classic-cocktails");
    expect(mobileCategorySectionId("Bloody Mary")).toBe("mobile-category-bloody-mary");
  });

  it("falls back for empty category values", () => {
    expect(mobileCategorySectionId(" ")).toBe("mobile-category-menu");
  });
});
