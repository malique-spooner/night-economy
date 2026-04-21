/* ════════════════════════════════════════════════════════════════════
   SHARED STATE
   ════════════════════════════════════════════════════════════════════ */

// Market data - imported from data.js
const DEFAULT_CATEGORIES = [...new Set(DRINKS.map(d => d.cat))];
const MARKET_SETTINGS_KEY = 'night-economy-market-settings';
const SALES_LOG_KEY = 'night-economy-sales-log';
const MARKET_HISTORY_KEY = 'night-economy-market-history';

function buildDefaultMarketSettings() {
  const drinks = {};
  DRINKS.forEach(d => {
    drinks[d.id] = {
      name: d.n,
      cat: d.cat,
      salePrice: d.b,
      floor: +(d.b * 0.65).toFixed(2),
      ceiling: +(d.b * 1.65).toFixed(2),
      soldOut: false,
    };
  });

  const categories = {};
  DEFAULT_CATEGORIES.forEach(cat => {
    categories[cat] = {
      label: cat.replace('-', ' '),
      soldOut: false,
    };
  });

  return { drinks, categories };
}

function loadMarketSettings() {
  try {
    const raw = localStorage.getItem(MARKET_SETTINGS_KEY);
    if (!raw) return buildDefaultMarketSettings();
    const parsed = JSON.parse(raw);
    const defaults = buildDefaultMarketSettings();
    return {
      drinks: { ...defaults.drinks, ...(parsed.drinks || {}) },
      categories: { ...defaults.categories, ...(parsed.categories || {}) },
    };
  } catch (err) {
    return buildDefaultMarketSettings();
  }
}

let MARKET_SETTINGS = loadMarketSettings();
let SALES_LOG = loadSalesLog();
let MARKET_HISTORY = loadMarketHistory();
let SESSION_STARTED_AT = Date.now();

function cloneMarketSettings(settings = MARKET_SETTINGS) {
  return {
    drinks: JSON.parse(JSON.stringify(settings.drinks || {})),
    categories: JSON.parse(JSON.stringify(settings.categories || {})),
  };
}

function loadSalesLog() {
  try {
    const raw = localStorage.getItem(SALES_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
}

function loadMarketHistory() {
  try {
    const raw = localStorage.getItem(MARKET_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
}

function saveMarketSettings() {
  try {
    localStorage.setItem(MARKET_SETTINGS_KEY, JSON.stringify(MARKET_SETTINGS));
  } catch (err) {
    // Ignore storage failures in private browsing or locked-down contexts.
  }
}

function saveSalesLog() {
  try {
    localStorage.setItem(SALES_LOG_KEY, JSON.stringify(SALES_LOG));
  } catch (err) {
    // Ignore storage failures in private browsing or locked-down contexts.
  }
}

function saveMarketHistory() {
  try {
    localStorage.setItem(MARKET_HISTORY_KEY, JSON.stringify(MARKET_HISTORY.slice(-40)));
  } catch (err) {
    // Ignore storage failures in private browsing or locked-down contexts.
  }
}

function rebuildMarketState() {
  D = DRINKS.map(d => {
    const s = MARKET_SETTINGS.drinks[d.id] || {};
    const catS = MARKET_SETTINGS.categories[d.cat] || {};
    const salePrice = typeof s.salePrice === 'number' ? s.salePrice : d.b;
    return {
      ...d,
      n: s.name || d.n,
      cat: s.cat || d.cat,
      basePrice: d.b,
      b: salePrice,
      p: salePrice,
      h: Array.from({ length: d.h.length }, () => salePrice),
      o: 0,
      floor: typeof s.floor === 'number' ? s.floor : +(salePrice * 0.65).toFixed(2),
      ceiling: typeof s.ceiling === 'number' ? s.ceiling : +(salePrice * 1.65).toFixed(2),
      soldOut: !!s.soldOut || !!catS.soldOut,
    };
  });
  return D;
}

rebuildMarketState();

function syncDrinkFromSettings(drinkId) {
  const drink = D.find(d => d.id === drinkId);
  if (!drink) return;
  const s = MARKET_SETTINGS.drinks[drinkId] || {};
  const nextCat = s.cat || drink.cat;
  const catS = MARKET_SETTINGS.categories[nextCat] || {};
  if (s.name) drink.n = s.name;
  drink.cat = nextCat;
  if (typeof s.salePrice === 'number') {
    drink.b = s.salePrice;
    drink.p = clampPrice(drink, s.salePrice);
    drink.h = Array.from({ length: Math.max(drink.h.length, 7) }, () => drink.p);
  }
  if (typeof s.floor === 'number') drink.floor = s.floor;
  if (typeof s.ceiling === 'number') drink.ceiling = s.ceiling;
  drink.soldOut = !!s.soldOut || !!catS.soldOut;
}

function clampPrice(drink, value) {
  const floor = typeof drink.floor === 'number' ? drink.floor : drink.b * 0.65;
  const ceiling = typeof drink.ceiling === 'number' ? drink.ceiling : drink.b * 1.65;
  return Math.max(floor, Math.min(ceiling, value));
}

// State tracking
let crashActive = false;
let currentPanel = 0;
let cdInt = null;
let crawlTo = null;
let threeMode = 'normal';
let renderer, camera, scene;

/* ════════════════════════════════════════════════════════════════════
   DOM UTILITIES
   ════════════════════════════════════════════════════════════════════ */

function go(el, props, dur=600, delay=0) {
  if (!el) return;
  if (delay) {
    setTimeout(() => go(el, props, dur, 0), delay);
    return;
  }
  el.style.transition = `all ${dur}ms cubic-bezier(0.16,1,0.3,1)`;
  Object.assign(el.style, props);
}

function fmt(s) {
  return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
}

/* ════════════════════════════════════════════════════════════════════
   MARKET LOGIC
   ════════════════════════════════════════════════════════════════════ */

function fireOrder(dId) {
  const drink = D.find(d => d.id === dId);
  if (!drink || drink.soldOut) return;
  const catSetting = MARKET_SETTINGS.categories[drink.cat];
  if (catSetting && catSetting.soldOut) return;

  drink.o++;
  const trend = Math.random() > 0.4 ? 'up' : 'dn';
  const mult = trend === 'up' ? 1.08 : 0.96;
  const prev = drink.p;
  drink.p = clampPrice(drink, drink.p * mult);
  drink.h.push(drink.p);
  if (drink.h.length > 12) drink.h.shift();

  // Track order in a short per-drink timeline for the live panels
  if (!drink.timeline) drink.timeline = [];
  drink.timeline.push({
    t: Date.now(),
    o: drink.o,
    p: drink.p,
    type: trend === 'up' ? 'buy' : 'sell'
  });
  if (drink.timeline.length > 50) drink.timeline.shift();

  SALES_LOG.push({
    t: Date.now(),
    id: drink.id,
    n: drink.n,
    cat: drink.cat,
    type: trend === 'up' ? 'buy' : 'sell',
    prev,
    price: drink.p,
  });
  if (SALES_LOG.length > 500) SALES_LOG.shift();
  saveSalesLog();

  insertTradeRow(dId, trend === 'up', prev, trend === 'up' ? 'BUY' : 'SELL');

  const pEl = document.getElementById(`p${dId}`);
  if (pEl) {
    pEl.textContent = '£' + drink.p.toFixed(2);
    pEl.className = `dprice ${trend}`;
    pEl.classList.remove('rising', 'falling');
    void pEl.offsetWidth;
    pEl.classList.add(trend === 'up' ? 'rising' : 'falling');
  }

  const row = document.getElementById(`r${dId}`);
  if (row) {
    row.classList.add(trend === 'up' ? 'glow-up' : 'glow-dn');
    row.classList.add('pulse');
    setTimeout(() => {
      row.classList.remove('glow-up', 'glow-dn', 'pulse');
      row.classList.add('settle');
      setTimeout(() => row.classList.remove('settle'), 600);
    }, 1200);
  }

  // Update row display (sparkline, pct, arrow) directly
  updateRowDisplay(drink);

  updateNewsBar(drink);

  // Refresh the live side panels after an order changes market state
  if (typeof refreshAuxViews === 'function') refreshAuxViews();
}

function updateRowDisplay(d) {
  const chg = ((d.p - d.b) / d.b * 100);
  const up = chg >= 0;

  const pEl = document.getElementById(`p${d.id}`);
  if (pEl) { pEl.textContent = '£' + d.p.toFixed(2); pEl.className = `dprice ${up?'up':'dn'}`; }

  const pctEl = document.getElementById(`pct${d.id}`);
  if (pctEl) { pctEl.textContent = (up?'+':'') + chg.toFixed(1) + '%'; pctEl.className = `dpct ${up?'up':'dn'}`; }

  const arrEl = document.getElementById(`arr${d.id}`);
  if (arrEl) { arrEl.textContent = up ? '▲' : '▼'; arrEl.className = `darr ${up?'up':'dn'}`; }

  const spEl = document.getElementById(`sp${d.id}`);
  if (spEl) { spEl.innerHTML = svgSpark(d.h, up, 104, 24); }

  const rowEl = document.getElementById(`r${d.id}`);
  if (rowEl) {
    rowEl.classList.toggle('sold-out', !!d.soldOut);
  }
}

function svgSpark(h, up, W, H) {
  const mn = Math.min(...h);
  const mx = Math.max(...h);
  const rng = mx - mn || 0.01;
  const pts = h.map((v, i) => `${(i / (h.length - 1)) * (W - 2) + 1},${H - 1 - ((v - mn) / rng) * (H - 4)}`).join(' ');
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;overflow:visible"><polyline points="${pts}" fill="none" stroke="${up ? '#ff5252' : '#3dd68c'}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function renderTicker() {
  const inner = document.getElementById('tinner');
  if (!inner) return;

  inner.innerHTML = D.map(d => {
    const trend = d.p > d.b ? 'u' : 'd';
    return `<div class="ti"><span class="tn">${d.n}</span> <span class="tv">£${d.p.toFixed(2)}</span> <span class="t${trend}">${trend === 'u' ? '▲' : '▼'}</span></div>`;
  }).join('') + D.map(d => {
    const trend = d.p > d.b ? 'u' : 'd';
    return `<div class="ti"><span class="tn">${d.n}</span> <span class="tv">£${d.p.toFixed(2)}</span> <span class="t${trend}">${trend === 'u' ? '▲' : '▼'}</span></div>`;
  }).join('');
}

function startCrawl(text, color) {
  const el = document.getElementById('nbtxt');
  if (!el) return;

  if (color) el.style.color = color;
  else el.style.color = 'rgba(232,228,210,0.6)';

  const trackW = el.parentElement.offsetWidth;
  el.style.transition = 'none';
  el.style.left = trackW + 'px';
  el.textContent = text;
  void el.offsetWidth;

  const dur = (trackW + el.scrollWidth) / 55;
  el.style.transition = `left ${dur}s linear`;
  el.style.left = (-el.scrollWidth) + 'px';

  if (crawlTo) clearTimeout(crawlTo);
  if (!crashActive) crawlTo = setTimeout(() => startCrawl(text), dur * 1000);
}

let lastCrawlReset = 0;
function updateNewsBar(d) {
  const now = Date.now();
  if (now - lastCrawlReset < 10000) return;
  lastCrawlReset = now;
  startCrawl(`Purchase · ${d.n} — £${d.p.toFixed(2)}`);

  const n = new Date();
  const nbsrc = document.getElementById('nbsrc');
  if (nbsrc) nbsrc.textContent = `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')} · Market Desk`;
}

function getAvailableDrinks() {
  return D.filter(d => !d.soldOut && !(MARKET_SETTINGS.categories[d.cat] && MARKET_SETTINGS.categories[d.cat].soldOut));
}

function pushMarketHistory(entry) {
  MARKET_HISTORY.push(entry);
  MARKET_HISTORY = MARKET_HISTORY.slice(-40);
  saveMarketHistory();
}

function applyMarketTransaction(label, mutator) {
  const previous = cloneMarketSettings();
  mutator();
  saveMarketSettings();
  D.forEach(d => syncDrinkFromSettings(d.id));
  pushMarketHistory({
    t: Date.now(),
    kind: 'transaction',
    label,
    prev: previous,
  });
  if (typeof refreshAuxViews === 'function') refreshAuxViews();
}

function setDrinkMarketConfig(drinkId, patch, options = {}) {
  if (!MARKET_SETTINGS.drinks[drinkId]) return;
  const previous = options.recordHistory ? cloneMarketSettings() : null;
  MARKET_SETTINGS.drinks[drinkId] = { ...MARKET_SETTINGS.drinks[drinkId], ...patch };
  saveMarketSettings();
  syncDrinkFromSettings(drinkId);
  if (Object.prototype.hasOwnProperty.call(patch, 'salePrice')) {
    const drink = D.find(d => d.id === drinkId);
    if (drink) {
      const nextPrice = clampPrice(drink, patch.salePrice);
      drink.b = nextPrice;
      drink.p = nextPrice;
      drink.h = Array.from({ length: Math.max(drink.h.length, 7) }, () => nextPrice);
    }
  }
  if (options.recordHistory && previous) {
    pushMarketHistory({
      t: Date.now(),
      kind: 'drink',
      id: drinkId,
      prev: previous,
      label: patch.name || patch.salePrice || patch.floor || patch.ceiling ? 'Updated drink settings' : 'Updated drink',
    });
  }
  if (typeof refreshAuxViews === 'function') refreshAuxViews();
}

function setCategoryMarketConfig(cat, patch, options = {}) {
  if (!MARKET_SETTINGS.categories[cat]) {
    MARKET_SETTINGS.categories[cat] = { label: cat.replace('-', ' '), soldOut: false };
  }
  const previous = options.recordHistory ? cloneMarketSettings() : null;
  MARKET_SETTINGS.categories[cat] = { ...MARKET_SETTINGS.categories[cat], ...patch };
  saveMarketSettings();
  D.forEach(d => syncDrinkFromSettings(d.id));
  if (options.recordHistory && previous) {
    pushMarketHistory({
      t: Date.now(),
      kind: 'category',
      id: cat,
      prev: previous,
      label: patch.soldOut ? 'Category sold-out state changed' : 'Updated category',
    });
  }
  if (typeof refreshAuxViews === 'function') refreshAuxViews();
}

function undoLastMarketChange() {
  const entry = MARKET_HISTORY.pop();
  if (!entry) return false;
  MARKET_SETTINGS = entry.prev;
  saveMarketSettings();
  D.forEach(d => syncDrinkFromSettings(d.id));
  saveMarketHistory();
  if (typeof refreshAuxViews === 'function') refreshAuxViews();
  return true;
}

function updateClock() {
  const n = new Date();
  const clk = document.getElementById('clk');
  const lupdt = document.getElementById('lupdt');
  if (clk) clk.textContent = `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}:${String(n.getSeconds()).padStart(2,'0')}`;
  if (lupdt) lupdt.textContent = `Updated ${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}:${String(n.getSeconds()).padStart(2,'0')}`;
}

function switchPanel(idx) {
  if (crashActive) return;

  document.getElementById(`pv${currentPanel}`).classList.remove('active');
  document.getElementById(`dot${currentPanel}`).classList.remove('active');

  currentPanel = idx % 2;
  const updaters = [updateMarketPanel, updateMiniSpotlight];
  updaters[currentPanel]();

  document.getElementById(`pv${currentPanel}`).classList.add('active');
  document.getElementById(`dot${currentPanel}`).classList.add('active');
}

/* ════════════════════════════════════════════════════════════════════
   THREE.JS SETUP
   ════════════════════════════════════════════════════════════════════ */

function setupThree() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('threeCanvas'), alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);
  camera.position.z = 6.5;

  // Create floating particles network
  const particleCount = 220;
  const particles = [];
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 22;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 22;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 22;
    particles.push({
      x: positions[i * 3],
      y: positions[i * 3 + 1],
      z: positions[i * 3 + 2],
      vx: (Math.random() - 0.5) * 0.02,
      vy: (Math.random() - 0.5) * 0.02,
      vz: (Math.random() - 0.5) * 0.02
    });
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color: 0x3dd68c,
    size: 0.18,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const points = new THREE.Points(geometry, mat);
  points.renderOrder = 2;
  scene.add(points);

  const glowMat = new THREE.PointsMaterial({
    color: 0x9df5c7,
    size: 0.42,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const glowPoints = new THREE.Points(geometry, glowMat);
  glowPoints.renderOrder = 1;
  scene.add(glowPoints);

  // Store for animation
  scene.userData.particles = particles;
  scene.userData.geometry = geometry;
  scene.userData.mats = [mat, glowMat];

  // Soft lighting
  const ambientLight = new THREE.AmbientLight(0x3dd68c, 0.45);
  scene.add(ambientLight);

  const accentLight = new THREE.PointLight(0x3dd68c, 1.2, 60);
  accentLight.position.set(0, 0, 10);
  scene.add(accentLight);
}

function threeUpdate() {
  if (!scene || !renderer) return;

  const particles = scene.userData.particles;
  const geometry = scene.userData.geometry;

  if (particles && geometry) {
    const positions = geometry.attributes.position.array;

    particles.forEach((p, i) => {
      p.x += p.vx;
      p.y += p.vy;
      p.z += p.vz;

      // Wrap around
      if (p.x > 12.5) p.x = -12.5;
      if (p.x < -12.5) p.x = 12.5;
      if (p.y > 12.5) p.y = -12.5;
      if (p.y < -12.5) p.y = 12.5;
      if (p.z > 12.5) p.z = -12.5;
      if (p.z < -12.5) p.z = 12.5;

      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
    });

    geometry.attributes.position.needsUpdate = true;
  }

  // Lerp particle color toward target based on mode
  const mats = scene.userData.mats || [];
  if (mats.length) {
    const target = threeMode === 'crash' || threeMode === 'crash-peak'
      ? new THREE.Color(0xff5252)
      : new THREE.Color(0x3dd68c);
    mats.forEach(mat => mat.color.lerp(target, 0.05));
  }

  renderer.render(scene, camera);
}

function resetThree() {
  if (scene && scene.children[0]) {
    const mesh = scene.children.find(c => c.geometry instanceof THREE.IcosahedronGeometry);
    if (mesh) mesh.rotation.set(0, 0, 0);
  }
}
