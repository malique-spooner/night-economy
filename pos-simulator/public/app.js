const money = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
const stateUrl = "/v1/simulation/state";

document.querySelectorAll("[data-event]").forEach(button => {
  button.addEventListener("click", async () => {
    await post("/v1/simulation/events", { type: button.dataset.event });
    document.querySelector("#event-status").textContent = button.dataset.event === "rush" ? "Rush triggered." : "Slowdown triggered.";
    await refresh();
  });
});

document.querySelector("#speed").addEventListener("change", async event => {
  await post("/v1/simulation/control", { speed: Number(event.target.value) });
  await refresh();
});

document.querySelector("#target-takings").addEventListener("change", async event => {
  await post("/v1/simulation/control", { targetRevenueMinor: Math.round(Number(event.target.value || 0) * 100) });
  await refresh();
});

async function refresh() {
  const response = await fetch(stateUrl);
  const state = await response.json();
  render(state);
}

function render(state) {
  const { service, products, recentSales, recentPublications, totals } = state;
  document.querySelector("#speed").value = String(service.speed);
  document.querySelector("#target-takings").value = String((service.targetRevenueMinor / 100).toFixed(0));
  document.querySelector("#sim-clock").textContent = formatTime(service.simulatedTime);
  document.querySelector("#status").innerHTML = [
    ["Simulated time", formatTime(service.simulatedTime)],
    ["Speed", `${service.speed}×`],
    ["Target takings", price(service.targetRevenueMinor)],
    ["Status", service.isComplete ? "Complete" : service.ended ? "Ended" : service.running ? "Running" : service.paused ? "Paused" : "Not started"],
    ["Sale lines", String(totals.salesCount)],
    ["Units sold", String(totals.unitsSold)],
  ].map(([label, value]) => `<article class="metric"><span>${label}</span><strong>${value}</strong></article>`).join("");

  document.querySelector("#products").innerHTML = `<table><thead><tr><th>Product</th><th>SKU</th><th>Base</th><th>Current</th><th>Availability</th><th></th></tr></thead><tbody>${products.map(product => `<tr><td>${product.name}</td><td>${product.sku}</td><td>${price(product.basePriceMinor)}</td><td>${price(product.currentPriceMinor)}</td><td><span class="pill ${product.isAvailable ? "available" : "sold-out"}">${product.isAvailable ? "Available" : "Sold out"}</span></td><td>${product.isAvailable ? `<button class="sold-out-button" data-sold-out="${product.id}">Sell out</button>` : ""}</td></tr>`).join("")}</tbody></table>`;
  document.querySelectorAll("[data-sold-out]").forEach(button => button.addEventListener("click", async () => {
    await post("/v1/simulation/events", { type: "sold_out", productId: button.dataset.soldOut });
    document.querySelector("#event-status").textContent = "Product marked sold out.";
    await refresh();
  }));

  document.querySelector("#sales").innerHTML = recentSales.length ? `<ol class="feed">${recentSales.map(sale => `<li><time>${formatTime(sale.occurredAt)}</time><span>${sale.quantity} × ${productName(products, sale.productId)}</span><strong>${price(sale.unitPriceMinor)}</strong></li>`).join("")}</ol>` : empty("Start the service to generate sales.");
  document.querySelector("#publications").innerHTML = recentPublications.length ? `<ol class="feed">${recentPublications.map(publication => `<li><time>${formatTime(publication.publishedAt)}</time><span>${publication.lines.length} price update${publication.lines.length === 1 ? "" : "s"}</span><strong>${publication.status}</strong></li>`).join("")}</ol>` : empty("No price publications received yet.");
}

function productName(products, id) { return products.find(product => product.id === id)?.name ?? id; }
function price(minor) { return money.format(minor / 100); }
function formatTime(value) { return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/London" }).format(new Date(value)); }
function empty(message) { return `<p class="empty">${message}</p>`; }
async function post(url, body) { const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); if (!response.ok) throw new Error((await response.json()).error); return response.json(); }

await refresh();
setInterval(() => { void refresh(); }, 1000);
