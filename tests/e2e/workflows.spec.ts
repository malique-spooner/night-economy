import { expect, test, type Page, type Route } from "@playwright/test";

const user = {
  id: "user_e2e_owner",
  aud: "authenticated",
  role: "authenticated",
  email: "owner@example.com",
  email_confirmed_at: "2026-07-29T00:00:00.000Z",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: "2026-07-29T00:00:00.000Z",
};

const venue = {
  id: "ven_demo",
  slug: "demo-venue",
  name: "The Last Judgment",
  currency: "GBP",
  timezone: "Europe/London",
  market_live: true,
  market_schedule: [
    { day: "Friday", start: "18:00", end: "00:00", enabled: true, targetRevenueMinor: 1_000_000 },
  ],
  crash_interval_minutes: 30,
  launch_date: null,
  launch_start_time: "18:00",
  launch_end_time: "00:00",
};

const products = [
  { id: "mp_espresso", pos_product_id: "pos_espresso", market_symbol: "ESP", display_name: "Espresso Martini", category: "Cocktails", base_price_minor: 1200, current_price_minor: 1260, floor_price_minor: 960, ceiling_price_minor: 1440, sales_velocity: 8, is_live: true, is_sold_out: false, priority: true },
  { id: "mp_margarita", pos_product_id: "pos_margarita", market_symbol: "MARG", display_name: "Margarita", category: "Cocktails", base_price_minor: 1100, current_price_minor: 1050, floor_price_minor: 880, ceiling_price_minor: 1320, sales_velocity: 6, is_live: true, is_sold_out: false, priority: false },
  { id: "mp_riesling", pos_product_id: "pos_riesling", market_symbol: "RSL", display_name: "House Riesling", category: "Wine", base_price_minor: 900, current_price_minor: 850, floor_price_minor: 700, ceiling_price_minor: 1100, sales_velocity: 4, is_live: true, is_sold_out: false, priority: false },
];

test("site carousel and discovery-call buttons produce their intended outcomes", async ({ page }) => {
  const writes: Array<{ path: string; body: unknown }> = [];
  await mockSupabase(page, writes);
  await page.goto("/venue/demo-venue");

  for (const label of ["Room display", "Guest menu", "Operator controls", "Market moment"]) {
    const button = page.getByRole("button", { name: `Show ${label}` });
    await button.click();
    await expect(button).toHaveAttribute("aria-current", "true");
  }
  await page.getByRole("button", { name: "Show Room display" }).click();
  await page.getByRole("button", { name: "Next product view" }).click();
  await expect(page.getByRole("button", { name: "Show Guest menu" })).toHaveAttribute("aria-current", "true");
  await page.getByRole("button", { name: "Previous product view" }).click();
  await expect(page.getByRole("button", { name: "Show Room display" })).toHaveAttribute("aria-current", "true");

  await page.getByLabel("Venue name").fill("E2E Venue");
  await page.getByLabel("Your name").fill("Alex Owner");
  await page.getByLabel("Email").fill("alex@example.com");
  await page.getByRole("button", { name: "Book the discovery call" }).click();
  await expect(page.getByText("Request received. We will help you set up the venue.")).toBeVisible();
  expect(writes.some(write => write.path === "/rest/v1/site_leads" && JSON.stringify(write.body).includes("alex@example.com"))).toBe(true);
});

test("a guest can move through the venue, TV, and mobile market surfaces", async ({ page }) => {
  await mockSupabase(page);

  await page.goto("/venue/demo-venue");
  await expect(page.locator("body")).toHaveAttribute("data-app-view", "site");
  await expect(page.getByRole("link", { name: "Market", exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Market", exact: true }).click();
  await expect(page).toHaveURL(/\/tv\/demo-venue$/);
  await expect(page.getByText("Live data", { exact: true })).toBeVisible();
  await expect(page.getByText("The Last Judgment", { exact: true }).first()).toBeVisible();

  await page.goto("/menu/demo-venue");
  await expect(page.locator("body")).toHaveAttribute("data-app-view", "mobile");
  await expect(page.getByText("Espresso Martini", { exact: true })).toBeVisible();
  await expect(page.getByText("Margarita", { exact: true })).toBeVisible();
  for (const button of await page.getByRole("navigation", { name: "Menu categories" }).getByRole("button").all()) {
    const targetId = await button.getAttribute("aria-controls");
    await button.click();
    await expect(page.locator(`#${targetId}`)).toBeInViewport();
  }
});

test("sign-in help buttons reveal passwords and request recovery with visible feedback", async ({ page }) => {
  const cloud = await mockSupabase(page);
  await page.goto("/sign-in/demo-venue");
  const password = page.getByLabel("Password", { exact: true });
  await expect(password).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Hide password" }).click();
  await expect(password).toHaveAttribute("type", "password");

  await page.getByRole("button", { name: "Forgot password?" }).click();
  await expect(page.getByText("Enter your work email first, then request a reset link.")).toBeVisible();
  await page.getByLabel("Email").fill("owner@example.com");
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await expect(page.getByText("Password reset link sent. Check your inbox.")).toBeVisible();
  expect(cloud.authRequests).toContain("recover");
});

test("password update and portal sign-out buttons complete their secure workflows", async ({ page }) => {
  const cloud = await mockSupabase(page);
  await signIn(page);
  await page.goto("/sign-in/demo-venue#type=recovery");
  await page.getByLabel("New password", { exact: true }).fill("a new secure password");
  await page.getByLabel("Confirm password", { exact: true }).fill("a new secure password");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page).toHaveURL(/\/app\/demo-venue$/);
  expect(cloud.authRequests).toContain("update-user");

  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(cloud.authRequests).toContain("logout");
});

test("an account without venue membership can use the access-denied sign-out button", async ({ page }) => {
  const cloud = await mockSupabase(page, [], { memberRole: null });
  await page.goto("/sign-in/demo-venue");
  await page.getByLabel("Email").fill("owner@example.com");
  await page.getByLabel("Password", { exact: true }).fill("correct horse battery staple");
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await expect(page.getByRole("heading", { name: "This account cannot access this venue." })).toBeVisible();
  await page.getByRole("button", { name: "Sign out and use another venue account" }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(cloud.authRequests).toContain("logout");
});

test("an owner signs in and clicks through scheduling, service controls, history, account, and simulator", async ({ page }) => {
  const writes: Array<{ path: string; body: unknown }> = [];
  const cloud = await mockSupabase(page, writes);

  await page.goto("/sign-in/demo-venue");
  await page.getByLabel("Email").fill("owner@example.com");
  await page.getByLabel("Password", { exact: true }).fill("correct horse battery staple");
  await page.getByRole("button", { name: "Sign in securely" }).click();

  await expect(page).toHaveURL(/\/app\/demo-venue$/);
  await expect(page.getByRole("heading", { name: "Portal" })).toBeVisible();

  await page.getByRole("button", { name: "Keep navigation open" }).click();
  await expect(page.getByRole("button", { name: "Collapse navigation" })).toBeVisible();
  await page.getByRole("button", { name: "Collapse navigation" }).click();

  for (const category of ["Cocktails", "Wine", "All drinks"]) {
    await page.getByRole("button", { name: category, exact: true }).click();
    await expect(page.getByRole("button", { name: category, exact: true })).toHaveAttribute("aria-pressed", "true");
  }

  for (const day of ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]) {
    const button = page.getByRole("button", { name: new RegExp(`^${day} `) });
    const wasPressed = await button.getAttribute("aria-pressed");
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", wasPressed === "true" ? "false" : "true");
  }
  await expect.poll(() => writes.some(write => write.path === "/rest/v1/venues" && JSON.stringify(write.body).includes("market_schedule"))).toBe(true);
  await page.waitForTimeout(250);
  for (const day of ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]) {
    const expected = day === "Friday" ? "false" : "true";
    await expect(page.getByRole("button", { name: new RegExp(`^${day} `) })).toHaveAttribute("aria-pressed", expected);
  }

  const espresso = page.locator(".portal-drink-row").filter({ has: page.locator('input[value="Espresso Martini"]') });
  const floor = espresso.locator('input[type="number"]').nth(0);
  const ceiling = espresso.locator('input[type="number"]').nth(1);
  await espresso.getByRole("button", { name: "Decrease Floor" }).click();
  await expect(floor).toHaveValue("9.10");
  await espresso.getByRole("button", { name: "Increase Floor" }).click();
  await expect(floor).toHaveValue("9.60");
  await expect.poll(() => writes.some(write => write.path === "/rest/v1/market_products" && (write.body as { floor_price_minor?: number })?.floor_price_minor === 960)).toBe(true);
  await espresso.getByRole("button", { name: "Decrease Ceiling" }).click();
  await expect(ceiling).toHaveValue("13.90");
  await espresso.getByRole("button", { name: "Increase Ceiling" }).click();
  await expect(ceiling).toHaveValue("14.40");
  await expect.poll(() => writes.some(write => write.path === "/rest/v1/market_products" && (write.body as { ceiling_price_minor?: number })?.ceiling_price_minor === 1440)).toBe(true);
  await espresso.getByRole("button", { name: "Show market and POS details for Espresso Martini" }).click();
  await expect(espresso.getByRole("button", { name: "Hide market and POS details for Espresso Martini" })).toBeVisible();
  await espresso.getByRole("button", { name: "Hide market and POS details for Espresso Martini" }).click();
  await espresso.getByRole("button", { name: "Take Espresso Martini live" }).click();
  await expect(espresso.getByRole("button", { name: "Make Espresso Martini live" })).toBeVisible();
  await expect.poll(() => writes.some(write => write.path === "/rest/v1/market_products" && (write.body as { is_live?: boolean })?.is_live === false)).toBe(true);
  await espresso.getByRole("button", { name: "Make Espresso Martini live" }).click();
  await expect.poll(() => writes.some(write => write.path === "/rest/v1/market_products" && (write.body as { is_live?: boolean })?.is_live === true)).toBe(true);

  await espresso.getByRole("combobox").selectOption("Wine");
  await expect.poll(() => writes.some(write => write.path === "/rest/v1/market_products" && (write.body as { category?: string })?.category === "Wine")).toBe(true);
  await espresso.getByRole("combobox").selectOption("Cocktails");
  const margarita = page.locator(".portal-drink-row").filter({ has: page.locator('input[value="Margarita"]') });
  await margarita.getByRole("checkbox").check();
  await expect.poll(() => writes.some(write => write.path === "/rest/v1/market_products" && (write.body as { priority?: boolean })?.priority === true)).toBe(true);

  const chooserPromise = page.waitForEvent("filechooser");
  const addLogo = espresso.getByRole("button", { name: "Add drink image for Espresso Martini" });
  await expect(addLogo).toHaveText("+");
  await addLogo.click();
  const chooser = await chooserPromise;
  await chooser.setFiles({ name: "espresso.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64") });
  await expect(espresso.getByAltText("Espresso Martini drink")).toHaveAttribute("src", /storage\/v1\/object\/public\/market-logos/);
  await expect(espresso.getByRole("button", { name: "Preview drink image for Espresso Martini" })).toBeVisible();
  await expect(espresso).not.toContainText("Replace");
  await expect.poll(() => writes.some(write => write.path === "/rest/v1/market_products" && typeof (write.body as { logo_url?: string })?.logo_url === "string")).toBe(true);

  await page.getByText("POS drinks", { exact: true }).click();
  await page.getByRole("button", { name: "Set up" }).click();
  await expect.poll(() => writes.some(write => write.path === "/rest/v1/market_products" && write.body !== null)).toBe(true);
  await expect(page.getByText("New POS Drink", { exact: true })).not.toBeVisible();

  await page.getByRole("button", { name: "Quick start · instant" }).click();
  await expect(page.getByRole("heading", { name: "Previous runs" })).toBeVisible();
  await expect(page.getByText("Instant simulation", { exact: true })).toBeVisible();
  expect(cloud.actions).toContain("instant_run");

  await page.getByRole("button", { name: /Start/ }).click();
  await expect(page.getByRole("button", { name: "Quick start · instant" })).toBeVisible();
  await page.getByRole("button", { name: "Quick start · 10 min live" }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  await expect(page.getByText(/Market open · 18:00/)).toBeVisible();
  await expect(page.getByText(/Market open · 00:00/)).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Quick start · 10 min live" })).not.toBeVisible();
  expect(cloud.actions).toContain("quick_start");

  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();
  expect(cloud.actions).toContain("pause");

  await page.getByRole("button", { name: "Resume" }).click();
  await expect(page.getByRole("button", { name: "End" })).toBeVisible();
  expect(cloud.actions).toContain("resume");

  await page.getByRole("button", { name: "End", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "End this service early?" })).toBeVisible();
  await page.getByRole("button", { name: "Keep service running" }).click();
  await expect(page.getByRole("dialog", { name: "End this service early?" })).not.toBeVisible();
  await page.getByRole("button", { name: "End", exact: true }).click();
  await page.getByRole("button", { name: "End service" }).click();
  await expect(page.getByRole("button", { name: "Quick start · 10 min live" })).toBeVisible();
  expect(cloud.actions).toContain("end");

  await page.getByRole("button", { name: /Run history/ }).click();
  await expect(page.getByRole("heading", { name: "Previous runs" })).toBeVisible();
  await expect(page.getByText("10-minute live rehearsal", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Open dashboard for 10-minute live rehearsal" }).click();
  await expect(page.getByRole("heading", { name: "10-minute live rehearsal dashboard" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sales through the night" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Top drinks" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Every price and percentage change" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Every single order" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Five-minute price history" }).getByText("+5.00%")).toBeVisible();
  const espressoDrilldown = page.getByRole("button", { name: /Espresso Martini 3 sold/ });
  await espressoDrilldown.click();
  await expect(page.getByRole("heading", { name: "Espresso Martini: every five-minute price" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Five-minute price history for Espresso Martini" }).getByRole("row")).toHaveCount(2);
  await expect(page.getByRole("table", { name: "Five-minute price history for Espresso Martini" })).not.toContainText("Margarita");
  await espressoDrilldown.click();
  await expect(page.getByRole("heading", { name: "Every price and percentage change" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Every order" }).getByRole("row")).toHaveCount(4);
  await expect(page.getByText("Espresso Martini", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("3 sold · Cocktails", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back to run history" }).click();
  await expect(page.getByRole("heading", { name: "Previous runs" })).toBeVisible();

  await page.getByRole("button", { name: /Settings/ }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByText("Owner access", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /Start/ }).click();
  await expect(page.getByRole("heading", { name: "Portal" })).toBeVisible();

  await page.getByRole("link", { name: /Simulator/ }).click();
  await expect(page).toHaveURL(/\/simulator\/demo-venue$/);
  await expect(page.getByRole("heading", { name: "Simulator" })).toBeVisible();
  await expect(page.getByText("Espresso Martini", { exact: true })).toBeVisible();
  const mondayTarget = page.getByLabel("Monday target takings");
  await expect(mondayTarget).toBeEnabled();
  await mondayTarget.fill("12345");
  await mondayTarget.blur();
  await expect.poll(() => writes.some(write => write.path === "/rest/v1/venues" && JSON.stringify(write.body).includes('"day":"Monday"') && JSON.stringify(write.body).includes('"targetRevenueMinor":1234500'))).toBe(true);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(cloud.authRequests).toContain("logout");
});

test("conditional portal warning buttons cancel or confirm the guarded action", async ({ page }) => {
  const crowded = Array.from({ length: 14 }, (_, index) => ({
    id: `mp_crowded_${index}`,
    pos_product_id: `pos_crowded_${index}`,
    market_symbol: `C${index}`,
    display_name: `Crowded Drink ${index + 1}`,
    category: "Cocktails",
    base_price_minor: 1000,
    current_price_minor: 1000,
    floor_price_minor: 800,
    ceiling_price_minor: 1200,
    sales_velocity: 4,
    is_live: index < 13,
    is_sold_out: false,
    priority: index < 3,
  }));
  await mockSupabase(page, [], { products: crowded });
  await signIn(page);

  const inactive = page.locator(".portal-drink-row").filter({ has: page.locator('input[value="Crowded Drink 14"]') });
  await inactive.getByRole("button", { name: "Off", exact: true }).click();
  await expect(page.getByRole("dialog", { name: /Add another Cocktails TV page/ })).toBeVisible();
  await page.getByRole("button", { name: "Keep one page" }).click();
  await expect(inactive.getByRole("button", { name: "Off", exact: true })).toBeVisible();
  await inactive.getByRole("button", { name: "Off", exact: true }).click();
  await page.getByRole("button", { name: "Add drink" }).click();
  await expect(inactive.getByRole("button", { name: "Live", exact: true })).toBeVisible();

  const fourth = page.locator(".portal-drink-row").filter({ has: page.locator('input[value="Crowded Drink 4"]') });
  await fourth.getByRole("checkbox").click();
  await expect(page.getByRole("dialog", { name: "Three priority drinks per category" })).toBeVisible();
  await page.getByRole("button", { name: "Okay" }).click();
  await expect(page.getByRole("dialog", { name: "Three priority drinks per category" })).not.toBeVisible();
});

test("previous runs stay visible during a slow background refresh", async ({ page }) => {
  const cloud = await mockSupabase(page, [], { marketRunsRefreshDelayMs: 1_500 });
  await signIn(page);

  await page.getByRole("button", { name: /Run history/ }).click();
  await expect(page.getByRole("heading", { name: "Previous runs" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open dashboard for 10-minute live rehearsal" })).toBeVisible();

  await expect.poll(cloud.marketRunsRequestCount, { timeout: 7_000 }).toBeGreaterThan(1);
  await page.waitForTimeout(100);
  await expect(page.getByText("Loading run history…")).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Open dashboard for 10-minute live rehearsal" })).toBeVisible();
});

async function mockSupabase(
  page: Page,
  writes: Array<{ path: string; body: unknown }> = [],
  options: { products?: typeof products; memberRole?: "owner" | null; marketRunsRefreshDelayMs?: number } = {},
) {
  const actions: string[] = [];
  const authRequests: string[] = [];
  const mockProducts = options.products ?? products;
  const memberRole: "owner" | null = options.memberRole === null ? null : "owner";
  let service = serviceState("idle", 0);
  let latestRunKind: "quick" | "instant" = "quick";
  let marketRunsRequestCount = 0;

  await page.route(/https:\/\/[^/]+\.supabase\.co\/.*/, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const body = request.headers()["content-type"]?.includes("application/json") ? request.postDataJSON() : null;

    if (url.pathname === "/auth/v1/token") {
      const expiresAt = Math.floor(Date.now() / 1000) + 3600;
      return json(route, { access_token: jwt(expiresAt), token_type: "bearer", expires_in: 3600, expires_at: expiresAt, refresh_token: "e2e-refresh-token", user });
    }
    if (url.pathname === "/auth/v1/user") {
      if (request.method() === "PUT") authRequests.push("update-user");
      return json(route, user);
    }
    if (url.pathname === "/auth/v1/logout") {
      authRequests.push("logout");
      return json(route, {});
    }
    if (url.pathname === "/auth/v1/recover") {
      authRequests.push("recover");
      return json(route, {});
    }

    if (url.pathname === "/functions/v1/venue-simulator") {
      const action = String(body?.action ?? "state");
      actions.push(action);
      if (action === "quick_start") {
        latestRunKind = "quick";
        service = serviceState("running", 0);
      }
      if (action === "instant_run") {
        latestRunKind = "instant";
        service = serviceState("ended", 360);
      }
      if (action === "pause") service = serviceState("paused", service.minute);
      if (action === "resume") service = serviceState("running", service.minute);
      if (action === "end") service = serviceState("ended", service.minute);
      return json(route, action === "summary" ? simulatorSummary(service, mockProducts) : { service });
    }

    if (url.pathname.startsWith("/storage/v1/object/market-logos/") && request.method() === "POST") {
      writes.push({ path: "/storage/v1/object/market-logos", body: { uploaded: true } });
      return json(route, { Key: url.pathname.replace("/storage/v1/object/", "") });
    }

    if (url.pathname.startsWith("/storage/v1/object/public/market-logos/") && request.method() === "GET") {
      return route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64") });
    }

    if (url.pathname.startsWith("/rest/v1/")) {
      if (!["GET", "HEAD"].includes(request.method())) writes.push({ path: url.pathname, body });
      if (url.pathname.endsWith("/market_runs") && request.method() === "GET") {
        marketRunsRequestCount += 1;
        if (marketRunsRequestCount > 1 && options.marketRunsRefreshDelayMs) {
          await new Promise(resolve => setTimeout(resolve, options.marketRunsRefreshDelayMs));
        }
      }
      return handleRest(route, url, request.method(), mockProducts, body, memberRole, latestRunKind);
    }

    return json(route, {});
  });

  return { actions, authRequests, marketRunsRequestCount: () => marketRunsRequestCount };
}

async function handleRest(route: Route, url: URL, method: string, mockProducts: typeof products, requestBody: unknown, memberRole: "owner" | null, latestRunKind: "quick" | "instant") {
  const table = url.pathname.split("/").pop();
  if (method === "POST" && table === "market_products") return postgrest(route, requestBody);
  if (method === "PATCH" && table === "market_products") return postgrest(route, { id: "mp_updated" });
  if (method === "PATCH" && table === "venues") return postgrest(route, { id: venue.id });
  if (!["GET", "HEAD"].includes(method)) return route.fulfill({ status: 204, body: "" });
  if (table === "venues") {
    const embeddedVenue = url.searchParams.get("select")?.includes("market_products") ? { ...venue, market_products: mockProducts } : venue;
    return postgrest(route, url.searchParams.has("slug") ? embeddedVenue : [embeddedVenue]);
  }
  if (table === "market_products") return postgrest(route, mockProducts);
  if (table === "venue_members") return postgrest(route, url.searchParams.has("venue_id") ? (memberRole ? { role: memberRole } : null) : (memberRole ? [{ venue_id: venue.id, role: memberRole }] : []));
  if (table === "platform_admins") return postgrest(route, { user_id: user.id });
  if (table === "pos_products") return postgrest(route, [
    ...mockProducts.map(product => ({ id: product.pos_product_id, external_id: product.pos_product_id, sku: product.market_symbol, source_name: product.display_name, base_price_minor: product.base_price_minor, current_price_minor: product.current_price_minor, currency: "GBP", is_available: true, category: product.category, subcategory: "" })),
    { id: "pos_unmatched", external_id: "unmatched", sku: "NEW", source_name: "New POS Drink", base_price_minor: 1000, current_price_minor: 1000, currency: "GBP", is_available: true, category: "Cocktails", subcategory: "" },
  ]);
  if (table === "market_price_snapshots") return postgrest(route, [{
    created_at: "2026-07-25T18:05:00.000Z",
    snapshot: {
      roundEnd: "2026-07-25T18:05:00.000Z",
      decisions: [
        { productId: "mp_espresso", oldPriceMinor: 1200, newPriceMinor: 1260, movement: "up", reason: "Demand rose against category peers." },
        { productId: "mp_margarita", oldPriceMinor: 1100, newPriceMinor: 1078, movement: "down", reason: "Demand softened against category peers." },
      ],
    },
  }]);
  if (table === "market_runs") return postgrest(route, [{ id: "run_e2e", kind: latestRunKind, status: "completed", started_at: "2026-07-25T18:00:00.000Z", ended_at: "2026-07-25T18:10:00.000Z", simulated_minutes: 360, sales_count: 124, revenue_minor: 148800 }]);
  if (table === "pos_sales_events") return postgrest(route, [
    { id: "sale_1", pos_product_id: "pos_espresso", quantity: 2, unit_price_minor: 1260, currency: "GBP", occurred_at: "2026-07-25T18:00:00.000Z" },
    { id: "sale_2", pos_product_id: "pos_margarita", quantity: 1, unit_price_minor: 1050, currency: "GBP", occurred_at: "2026-07-25T18:31:00.000Z" },
    { id: "sale_3", pos_product_id: "pos_espresso", quantity: 1, unit_price_minor: 1320, currency: "GBP", occurred_at: "2026-07-25T20:02:00.000Z" },
  ]);
  return postgrest(route, []);
}

function simulatorSummary(service: ReturnType<typeof serviceState>, mockProducts: typeof products) {
  return {
    service,
    salesGraph: [{ minute: 0, salesCount: 3, revenueMinor: 3600 }],
    products: mockProducts.map(product => ({ id: product.id, posProductId: product.pos_product_id, name: product.display_name, category: product.category, isLive: product.is_live, currentPriceMinor: product.current_price_minor, basePriceMinor: product.base_price_minor, salesCount: 3, revenueMinor: product.current_price_minor * 3 })),
    recentSales: [{ pos_product_id: "pos_espresso", quantity: 1, unit_price_minor: 1260, occurred_at: "2026-07-29T18:05:00.000Z" }],
  };
}

function serviceState(status: "idle" | "running" | "paused" | "ended", minute: number) {
  return { running: status === "running", paused: status === "paused", ended: status === "ended", minute, speed: 36, targetRevenueMinor: 1_000_000, simulatedTime: new Date(Date.UTC(2026, 6, 29, 17, minute)).toISOString(), isOpen: status === "running" || status === "paused" };
}

function postgrest(route: Route, body: unknown) {
  return route.fulfill({ status: 200, contentType: "application/json", headers: { "content-range": "0-0/*" }, body: JSON.stringify(body) });
}

function json(route: Route, body: unknown) {
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
}

function jwt(expiresAt: number) {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, aud: "authenticated", role: "authenticated", email: user.email, exp: expiresAt })}.e2e-signature`;
}

async function signIn(page: Page) {
  await page.goto("/sign-in/demo-venue");
  await page.getByLabel("Email").fill("owner@example.com");
  await page.getByLabel("Password", { exact: true }).fill("correct horse battery staple");
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await expect(page).toHaveURL(/\/app\/demo-venue$/);
}
