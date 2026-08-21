import { buildLondonFridayRevenuePlan, simulateDemandMinute } from "../../supabase/functions/_shared/instantSimulation.ts";

const SERVICE_MINUTES = 6 * 60;
const FRIDAY_EVENING_REVENUE_TARGET_MINOR = 1_000_000;

import { tljCatalogue } from "./tljCatalogue.mjs";

const defaultProducts = tljCatalogue;

export function createFridayNightSimulation({ seed = 20260717 } = {}) {
  let products = cloneProducts();
  let sales = [];
  let publications = [];
  let minute = 0;
  let running = false;
  let hasStarted = false;
  let paused = false;
  let ended = false;
  let speed = 32;
  let targetRevenueMinor = FRIDAY_EVENING_REVENUE_TARGET_MINOR;
  let carryMinutes = 0;
  let rushUntilMinute = 0;
  let slowdownUntilMinute = 0;
  let resetId = 0;

  function getState() {
    return {
      service: {
        targetRevenueMinor,
        ended,
        hasStarted,
        isComplete: minute >= SERVICE_MINUTES,
        isOpen: hasStarted && !ended && minute < SERVICE_MINUTES,
        minute,
        paused,
        running,
        resetId,
        serviceEnd: serviceTime(SERVICE_MINUTES),
        serviceStart: serviceTime(0),
        simulatedTime: serviceTime(minute),
        speed,
      },
      products: products.map(toPublicProduct),
      recentSales: sales.slice(-30).reverse(),
      recentPublications: publications.slice(-10).reverse(),
      totals: {
        salesCount: sales.length,
        unitsSold: sales.reduce((total, sale) => total + sale.quantity, 0),
        revenueMinor: sales.reduce((total, sale) => total + sale.quantity * sale.unitPriceMinor, 0),
      },
    };
  }

  function getProducts() {
    return products.map(toPublicProduct);
  }

  function getSales(since) {
    const sinceTime = since ? Date.parse(since) : Number.NEGATIVE_INFINITY;
    return sales.filter(sale => Date.parse(sale.occurredAt) > sinceTime);
  }

  function tick(realElapsedMs) {
    if (!hasStarted || ended || minute >= SERVICE_MINUTES) return 0;
    carryMinutes += (realElapsedMs / 60_000) * speed;
    const wholeMinutes = Math.floor(carryMinutes);
    carryMinutes -= wholeMinutes;
    return advanceMinutes(wholeMinutes, running);
  }

  function advance(requestedMinutes) {
    return advanceMinutes(requestedMinutes, true);
  }

  function advanceMinutes(requestedMinutes, generateSales) {
    const count = Math.max(0, Math.min(requestedMinutes, SERVICE_MINUTES - minute));
    for (let index = 0; index < count; index += 1) {
      if (generateSales) generateSalesForMinute(minute);
      minute += 1;
    }
    if (minute >= SERVICE_MINUTES) {
      running = false;
      paused = false;
      ended = true;
    }
    return count;
  }

  function control({ action, speed: nextSpeed, targetRevenueMinor: nextTargetRevenueMinor } = {}) {
    if (action === "start") {
      hasStarted = minute < SERVICE_MINUTES;
      running = hasStarted;
      paused = false;
      ended = false;
    }
    if (action === "reset") reset();
    if (action === "quick_start") {
      const currentSpeed = speed;
      const currentTargetRevenueMinor = targetRevenueMinor;
      reset();
      speed = currentSpeed;
      targetRevenueMinor = currentTargetRevenueMinor;
      hasStarted = true;
      running = true;
    }
    if (action === "pause" && hasStarted && !ended) {
      running = false;
      paused = true;
      resetPrices();
    }
    if (action === "resume" && hasStarted && !ended) {
      running = true;
      paused = false;
    }
    if (action === "end" && hasStarted && !ended) {
      running = false;
      paused = false;
      ended = true;
      resetPrices();
    }
    if (action === "reset_prices") {
      resetPrices();
    }
    if (Number.isFinite(nextSpeed) && nextSpeed > 0 && nextSpeed <= 240) speed = nextSpeed;
    if (Number.isFinite(nextTargetRevenueMinor) && nextTargetRevenueMinor >= 0) targetRevenueMinor = Math.round(nextTargetRevenueMinor);
    return getState();
  }

  function injectEvent({ type, productId } = {}) {
    if (type === "rush") rushUntilMinute = Math.max(rushUntilMinute, minute + 30);
    if (type === "slowdown") slowdownUntilMinute = Math.max(slowdownUntilMinute, minute + 30);
    if (type === "sold_out") {
      const product = products.find(item => item.id === productId) ?? products.find(item => item.isAvailable);
      if (!product) throw new Error("No available product to mark sold out");
      product.isAvailable = false;
      product.updatedAt = serviceTime(minute);
    }
    if (!["rush", "slowdown", "sold_out"].includes(type)) throw new Error("Unknown simulator event");
    return getState();
  }

  function publishPrices({ publicationId, lines } = {}) {
    if (!publicationId || !Array.isArray(lines) || !lines.length) throw new Error("publicationId and at least one price line are required");
    const publishedAt = serviceTime(minute);
    const resultLines = lines.map(line => {
      const product = products.find(item => item.id === line.productId);
      if (!product || !Number.isInteger(line.newPriceMinor) || line.newPriceMinor < 0) {
        return { productId: line.productId, status: "failed", message: "Unknown product or invalid price" };
      }

      const oldPriceMinor = product.currentPriceMinor;
      product.currentPriceMinor = line.newPriceMinor;
      product.updatedAt = publishedAt;
      return { productId: product.id, status: "published", oldPriceMinor, newPriceMinor: product.currentPriceMinor };
    });
    const status = resultLines.every(line => line.status === "published")
      ? "published"
      : resultLines.some(line => line.status === "published")
        ? "partial_failure"
        : "failed";
    const publication = { publicationId, status, publishedAt, lines: resultLines };
    publications.push(publication);
    return publication;
  }

  function reset() {
    products = cloneProducts();
    sales = [];
    publications = [];
    minute = 0;
    running = false;
    hasStarted = false;
    paused = false;
    ended = false;
    targetRevenueMinor = FRIDAY_EVENING_REVENUE_TARGET_MINOR;
    speed = 32;
    carryMinutes = 0;
    rushUntilMinute = 0;
    slowdownUntilMinute = 0;
    resetId += 1;
  }

  function resetPrices() {
    products.forEach(product => {
      product.currentPriceMinor = product.basePriceMinor;
      product.updatedAt = serviceTime(minute);
    });
  }

  function generateSalesForMinute(serviceMinute) {
    const eventMultiplier = serviceMinute < rushUntilMinute ? 2.1 : serviceMinute < slowdownUntilMinute ? 0.38 : 1;
    const demandProducts = products.map(product => ({
      id: product.id,
      pos_product_id: product.id,
      category: product.category,
      base_price_minor: product.basePriceMinor,
      current_price_minor: product.currentPriceMinor,
      is_live: product.isAvailable,
      is_sold_out: !product.isAvailable,
      demand_weight: product.demandWeight,
    }));
    const history = sales.map(sale => ({
      minute: Math.max(0, Math.floor((Date.parse(sale.occurredAt) - Date.parse(serviceTime(0))) / 60_000)),
      posProductId: sale.productId,
      quantity: sale.quantity,
    }));
    const revenuePlan = buildLondonFridayRevenuePlan(targetRevenueMinor, SERVICE_MINUTES);
    const minuteSales = simulateDemandMinute(demandProducts, revenuePlan[serviceMinute], serviceMinute, history, {
      seed,
      serviceMinutes: SERVICE_MINUTES,
      eventMultiplier,
    });
    for (const line of minuteSales) {
      sales.push({
        id: `sale_${String(serviceMinute).padStart(3, "0")}_${String(sales.length + 1).padStart(4, "0")}`,
        occurredAt: serviceTime(serviceMinute),
        productId: line.posProductId,
        quantity: line.quantity,
        unitPriceMinor: line.unitPriceMinor,
        currency: "GBP",
      });
    }
  }

  return { advance, control, getProducts, getSales, getState, injectEvent, publishPrices, tick };
}

function cloneProducts() {
  return defaultProducts.map(product => ({
    ...product,
    currentPriceMinor: product.basePriceMinor,
    currency: "GBP",
    isAvailable: true,
    updatedAt: serviceTime(0),
  }));
}

function toPublicProduct(product) {
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    basePriceMinor: product.basePriceMinor,
    currentPriceMinor: product.currentPriceMinor,
    currency: product.currency,
    category: product.category,
    subcategory: product.subcategory,
    productGroup: product.productGroup,
    serveSize: product.serveSize,
    isAvailable: product.isAvailable,
    updatedAt: product.updatedAt,
  };
}

function serviceTime(minute) {
  // 17:00 UTC is 18:00 in London during British Summer Time.
  return new Date(Date.UTC(2026, 6, 17, 17, 0) + minute * 60_000).toISOString();
}
