import { expect, test } from "@playwright/test";

test("Friday POS simulator buttons trigger events and show their outcomes", async ({ page }) => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "The standalone local POS simulator is not part of the Cloudflare Pages deployment.");

  await page.goto("http://127.0.0.1:3002");

  await page.getByRole("button", { name: "Trigger rush" }).click();
  await expect(page.getByText("Rush triggered.", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Trigger slowdown" }).click();
  await expect(page.getByText("Slowdown triggered.", { exact: true })).toBeVisible();

  const availableProduct = page.locator("#products tbody tr").filter({ has: page.getByRole("button", { name: "Sell out" }) }).first();
  const productName = await availableProduct.locator("td").first().innerText();
  await availableProduct.getByRole("button", { name: "Sell out" }).click();
  const soldOutProduct = page.locator("#products tbody tr").filter({ hasText: productName });
  await expect(page.getByText("Product marked sold out.", { exact: true })).toBeVisible();
  await expect(soldOutProduct.getByText("Sold out", { exact: true })).toBeVisible();
  await expect(soldOutProduct.getByRole("button", { name: "Sell out" })).toHaveCount(0);
});
