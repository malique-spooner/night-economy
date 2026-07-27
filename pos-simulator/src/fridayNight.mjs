const SERVICE_MINUTES = 6 * 60;
const FRIDAY_EVENING_REVENUE_TARGET_MINOR = 1_000_000;

import { tljCatalogue } from "./tljCatalogue.mjs";

const defaultProducts = tljCatalogue;

const demandCurve = [[0, 0.3], [60, 0.55], [120, 0.9], [180, 1.35], [240, 1.8], [300, 2.05], [360, 1.55], [420, 0.7], [480, 0.2]];
const categoryMix = { Beer: 0.45, Wine: 0.18, Cocktails: 0.16, Spirits: 0.13, "Other Drinks": 0.08 };
const revenuePlan = buildRevenuePlan();

export function createFridayNightSimulation({ seed = 20260717 } = {}) {
  let random = createRandom(seed);
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
  let plannedRevenueMinor = 0;
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
    random = createRandom(seed);
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
    plannedRevenueMinor = 0;
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
    plannedRevenueMinor = Math.min(targetRevenueMinor, plannedRevenueMinor + revenuePlan[serviceMinute] * (targetRevenueMinor / FRIDAY_EVENING_REVENUE_TARGET_MINOR) * eventMultiplier);
    let actualRevenueMinor = sales.reduce((total, sale) => total + sale.quantity * sale.unitPriceMinor, 0);

    // A real Friday is calibrated by takings first. Products are then chosen from
    // a pub-oriented category mix and a modest within-category popularity weight.
    while (actualRevenueMinor < plannedRevenueMinor) {
      const product = chooseProduct(products, random);
      if (!product) return;
      const quantity = random() < 0.18 && actualRevenueMinor + product.currentPriceMinor * 2 <= plannedRevenueMinor ? 2 : 1;
      sales.push({
        id: `sale_${String(serviceMinute).padStart(3, "0")}_${String(sales.length + 1).padStart(4, "0")}`,
        occurredAt: serviceTime(serviceMinute),
        productId: product.id,
        quantity,
        unitPriceMinor: product.currentPriceMinor,
        currency: "GBP",
      });
      actualRevenueMinor += quantity * product.currentPriceMinor;
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

function serviceDemand(minute) {
  for (let index = 1; index < demandCurve.length; index += 1) {
    const [endMinute, endValue] = demandCurve[index];
    const [startMinute, startValue] = demandCurve[index - 1];
    if (minute > endMinute) continue;
    const progress = (minute - startMinute) / (endMinute - startMinute);
    return startValue + (endValue - startValue) * progress;
  }

  return demandCurve.at(-1)[1];
}

function buildRevenuePlan() {
  const weights = Array.from({ length: SERVICE_MINUTES }, (_, minute) => serviceDemand(minute));
  const total = weights.reduce((sum, value) => sum + value, 0);
  return weights.map(weight => FRIDAY_EVENING_REVENUE_TARGET_MINOR * weight / total);
}

function chooseProduct(products, random) {
  const availableByCategory = new Map();
  for (const product of products) {
    if (!product.isAvailable) continue;
    availableByCategory.set(product.category, [...(availableByCategory.get(product.category) ?? []), product]);
  }
  const categories = [...availableByCategory.keys()];
  const category = weightedChoice(categories, item => categoryMix[item] ?? 0.01, random);
  if (!category) return null;
  return weightedChoice(availableByCategory.get(category), product => {
    const priceRatio = product.currentPriceMinor / product.basePriceMinor;
    const priceMultiplier = Math.max(0.35, 1 - Math.max(0, priceRatio - 1) * 0.65);
    return product.demandWeight * priceMultiplier;
  }, random);
}

function weightedChoice(items, weightOf, random) {
  const total = items.reduce((sum, item) => sum + Math.max(0, weightOf(item)), 0);
  if (!total) return items[0] ?? null;
  let point = random() * total;
  for (const item of items) {
    point -= Math.max(0, weightOf(item));
    if (point <= 0) return item;
  }
  return items.at(-1) ?? null;
}

function serviceTime(minute) {
  // 17:00 UTC is 18:00 in London during British Summer Time.
  return new Date(Date.UTC(2026, 6, 17, 17, 0) + minute * 60_000).toISOString();
}

function createRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4_294_967_296;
  };
}
