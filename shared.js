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
  const defaultIds = new Set(DRINKS.map(d => d.id));
  const defaultDrinks = DRINKS
    .filter(d => !(MARKET_SETTINGS.drinks[d.id] && MARKET_SETTINGS.drinks[d.id].hidden))
    .map(d => {
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
        timeline: [],
      };
    });
  const customDrinks = Object.entries(MARKET_SETTINGS.drinks || {})
    .filter(([id, s]) => !defaultIds.has(id) && !s.hidden)
    .map(([id, s]) => {
      const salePrice = typeof s.salePrice === 'number' ? s.salePrice : 10;
      const cat = s.cat || 'signature';
      const catS = MARKET_SETTINGS.categories[cat] || {};
      return {
        id,
        n: s.name || 'New drink',
        cat,
        b: salePrice,
        p: salePrice,
        h: h(salePrice),
        o: 0,
        basePrice: salePrice,
        floor: typeof s.floor === 'number' ? s.floor : +(salePrice * 0.65).toFixed(2),
        ceiling: typeof s.ceiling === 'number' ? s.ceiling : +(salePrice * 1.65).toFixed(2),
        soldOut: !!s.soldOut || !!catS.soldOut,
        timeline: [],
        custom: true,
      };
    });
  D = [...defaultDrinks, ...customDrinks];
  D.forEach(drink => {
    drink.timeline = buildSyntheticTimeline(drink);
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
    drink.timeline = buildSyntheticTimeline(drink);
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

function getEveningSessionBounds(referenceTs = Date.now()) {
  const reference = new Date(referenceTs);
  const start = new Date(reference);
  start.setHours(18, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  end.setHours(1, 0, 0, 0);
  if (reference.getHours() < 1) {
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() - 1);
  }
  return { start, end };
}

function buildSyntheticTimeline(drink, points = 43) {
  const anchor = Array.isArray(drink.h) && drink.h.length ? drink.h : [drink.p || drink.b || 0];
  const { start, end } = getEveningSessionBounds();
  const spanMs = end.getTime() - start.getTime();
  const timeline = [];
  for (let index = 0; index < points; index += 1) {
    const source = anchor[Math.min(anchor.length - 1, Math.floor((index / Math.max(1, points - 1)) * (anchor.length - 1)))];
    const progress = index / Math.max(1, points - 1);
    const eveningRush = Math.sin(progress * Math.PI) * 0.16 * (drink.b || 1);
    const latePeak = Math.exp(-Math.pow((progress - 0.72) / 0.18, 2)) * 0.22 * (drink.b || 1);
    const drift = (progress - 0.35) * 0.1 * (drink.b || 1);
    const noise = ((Math.sin((index + 1) * 1.73 + drink.id.length) + Math.cos((index + 1) * 0.91)) * 0.014) * (drink.b || 1);
    const price = clampPrice(drink, +(source + eveningRush + latePeak + drift + noise).toFixed(2));
    timeline.push({
      t: start.getTime() + progress * spanMs,
      p: price,
      o: Math.max(0, Math.round((Math.sin(index * 0.55 + drink.id.length) + 1.15) * 3 + progress * 3)),
      type: index === points - 1 ? 'seed' : (price >= (timeline[index - 1]?.p ?? price) ? 'buy' : 'sell'),
    });
  }
  if (timeline.length) timeline[timeline.length - 1].p = drink.p;
  return timeline;
}

function pushDrinkTimelinePoint(drink, type = 'tick') {
  if (!drink) return;
  if (!Array.isArray(drink.timeline) || !drink.timeline.length) {
    drink.timeline = buildSyntheticTimeline(drink);
  }
  const { start, end } = getEveningSessionBounds();
  const lastPoint = drink.timeline[drink.timeline.length - 1];
  const stepMs = Math.max(1, Math.round((end.getTime() - start.getTime()) / Math.max(1, drink.timeline.length - 1)));
  const nextTime = Math.min(end.getTime(), Math.max(start.getTime(), (lastPoint?.t || start.getTime()) + stepMs));
  drink.timeline.push({
    t: nextTime,
    o: drink.o,
    p: +drink.p.toFixed(2),
    type,
  });
  if (drink.timeline.length > 43) drink.timeline.shift();
}

function getDrinkSessionRange(drink) {
  const series = [drink.floor, drink.ceiling, drink.b, drink.p, ...(drink.timeline || []).map(point => point.p)].filter(value => Number.isFinite(value));
  return {
    min: Math.min(...series),
    max: Math.max(...series),
  };
}

function buildPricePositionMarkup(drink) {
  const { min, max } = getDrinkSessionRange(drink);
  const range = Math.max(0.01, max - min);
  const low = Math.max(0, Math.min(100, ((drink.floor - min) / range) * 100));
  const high = Math.max(0, Math.min(100, ((drink.ceiling - min) / range) * 100));
  const base = Math.max(0, Math.min(100, ((drink.b - min) / range) * 100));
  const current = Math.max(0, Math.min(100, ((drink.p - min) / range) * 100));
  const tone = drink.p >= drink.b ? 'up' : 'dn';
  return `
    <div class="pos-cell">
      <div class="pos-track">
        <div class="pos-range"></div>
        <div class="pos-window" style="left:${Math.min(low, high)}%;width:${Math.abs(high - low)}%"></div>
        <div class="pos-base" style="left:${base}%"></div>
        <div class="pos-current ${tone}" style="left:${current}%"></div>
      </div>
      <div class="pos-scale">
        <span>£${drink.floor.toFixed(2)}</span>
        <span>£${drink.ceiling.toFixed(2)}</span>
      </div>
    </div>
  `;
}

const SPOTLIGHT_CHART_CACHE = new WeakMap();

function renderSpotlightTrendChart(el, drink) {
  if (!el || typeof echarts === 'undefined' || !drink) return;
  const timeline = (drink.timeline && drink.timeline.length ? drink.timeline : buildSyntheticTimeline(drink)).slice(-43);
  const priceValues = timeline.map(point => point.p);
  const labels = timeline.map(point => new Date(point.t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
  const isUp = drink.p >= drink.b;
  const color = isUp ? '#ff6b57' : '#3dd68c';
  const buyPoints = [];
  const sellPoints = [];
  timeline.forEach((point, index) => {
    if (point.type === 'buy') buyPoints.push([index, point.p]);
    if (point.type === 'sell') sellPoints.push([index, point.p]);
  });

  let chart = SPOTLIGHT_CHART_CACHE.get(el);
  if (!chart) {
    chart = echarts.init(el, null, { renderer: 'canvas' });
    SPOTLIGHT_CHART_CACHE.set(el, chart);
  }
  chart.resize({
    width: el.clientWidth || 260,
    height: el.clientHeight || 180,
  });

  chart.setOption({
    animationDuration: 800,
    grid: { top: 28, right: 18, bottom: 28, left: 48 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(8,10,18,0.96)',
      borderColor: 'rgba(255,255,255,0.1)',
      textStyle: { color: '#f2ecd7', fontFamily: 'DM Mono' },
      valueFormatter: value => `£${Number(value).toFixed(2)}`,
    },
    xAxis: {
      type: 'category',
      data: labels,
      boundaryGap: false,
      axisLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontFamily: 'DM Mono', interval: 5 },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.12)' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontFamily: 'DM Mono', formatter: value => `£${Number(value).toFixed(2)}` },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        type: 'line',
        data: priceValues,
        smooth: true,
        showSymbol: false,
        lineStyle: { color, width: 3, cap: 'round', join: 'round' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: `${color}55` },
            { offset: 1, color: `${color}08` },
          ]),
        },
        markLine: {
          silent: true,
          symbol: 'none',
          label: { color: 'rgba(255,255,255,0.45)', fontFamily: 'DM Mono', formatter: 'Base £{c}' },
          lineStyle: { color: 'rgba(201,170,82,0.6)', type: 'dashed' },
          data: [{ yAxis: +drink.b.toFixed(2) }],
        },
        endLabel: {
          show: true,
          formatter: params => ` £${Number(params.value).toFixed(2)}`,
          color,
          fontFamily: 'DM Mono',
          fontSize: 11,
        },
      },
      {
        type: 'scatter',
        data: buyPoints,
        symbolSize: 8,
        itemStyle: { color: '#ff6b57' },
      },
      {
        type: 'scatter',
        data: sellPoints,
        symbolSize: 8,
        itemStyle: { color: '#3dd68c' },
      },
    ],
  }, true);
}

// State tracking
let crashActive = false;
let currentPanel = 0;
let cdInt = null;
let crawlTo = null;
let threeMode = 'normal';
let renderer, camera, scene;
let crashCategoryIndex = 0;

function getNextCrashCategory() {
  if (!DEFAULT_CATEGORIES.length) return 'signature';
  const cat = DEFAULT_CATEGORIES[crashCategoryIndex % DEFAULT_CATEGORIES.length];
  crashCategoryIndex = (crashCategoryIndex + 1) % DEFAULT_CATEGORIES.length;
  return cat;
}

function formatMarketCategory(cat) {
  return (MARKET_SETTINGS.categories?.[cat]?.label || cat || '').replace(/-/g, ' ');
}

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

  pushDrinkTimelinePoint(drink, trend === 'up' ? 'buy' : 'sell');

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
  if (spEl) spEl.innerHTML = buildPricePositionMarkup(d);

  const rowEl = document.getElementById(`r${d.id}`);
  if (rowEl) {
    rowEl.classList.toggle('sold-out', !!d.soldOut);
  }
}

const ECHARTS_LINE_CACHE = new WeakMap();

function buildLineChartMarkup(values, options = {}) {
  const safeValues = (values && values.length ? values : [0]).map(value => Number(value) || 0);
  const {
    color = '#3dd68c',
    width = 120,
    height = 34,
    strokeWidth = 2,
    endLabel = false,
    className = '',
  } = options;
  const classes = ['echart-line', className].filter(Boolean).join(' ');
  return `<div class="${classes}" data-line-values="${safeValues.join(',')}" data-line-color="${color}" data-line-width="${width}" data-line-height="${height}" data-line-stroke="${strokeWidth}" data-line-end-label="${endLabel ? '1' : '0'}" style="width:${width}px;height:${height}px"></div>`;
}

function renderEchartsLine(el) {
  if (!el || typeof echarts === 'undefined') return;
  const values = (el.dataset.lineValues || '0').split(',').map(value => Number(value) || 0);
  const color = el.dataset.lineColor || '#3dd68c';
  const width = Number(el.dataset.lineWidth || el.clientWidth || 120);
  const height = Number(el.dataset.lineHeight || el.clientHeight || 34);
  const strokeWidth = Number(el.dataset.lineStroke || 2);
  const endLabel = el.dataset.lineEndLabel === '1';
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;

  let chart = ECHARTS_LINE_CACHE.get(el);
  if (!chart) {
    chart = echarts.init(el, null, { renderer: 'canvas' });
    ECHARTS_LINE_CACHE.set(el, chart);
  } else {
    chart.resize({ width, height });
  }

  const lastIndex = Math.max(0, values.length - 1);
  const lastValue = values[lastIndex] ?? 0;

  chart.setOption({
    animationDuration: 900,
    animationEasing: 'cubicOut',
    grid: { top: 2, right: endLabel ? 64 : 6, bottom: 2, left: 6, containLabel: false },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      show: false,
      data: values.map((_, index) => index),
    },
    yAxis: {
      type: 'value',
      show: false,
      scale: true,
    },
    tooltip: { show: false },
    series: [
      {
        type: 'line',
        data: values,
        smooth: true,
        showSymbol: false,
        symbol: 'none',
        lineStyle: {
          color,
          width: strokeWidth,
          cap: 'round',
          join: 'round',
        },
        areaStyle: height > 40 ? {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: `${color}44` },
            { offset: 1, color: `${color}05` },
          ]),
        } : undefined,
        endLabel: endLabel ? {
          show: true,
          formatter: () => `${lastValue >= 0 ? '+' : ''}${lastValue.toFixed(1)}`,
          color,
          fontFamily: 'DM Mono',
          fontSize: 11,
        } : undefined,
      },
      {
        type: 'effectScatter',
        coordinateSystem: 'cartesian2d',
        data: [[lastIndex, lastValue]],
        symbolSize: height > 40 ? 8 : 5,
        showEffectOn: 'render',
        rippleEffect: {
          scale: height > 40 ? 2.4 : 1.6,
          brushType: 'stroke',
        },
        itemStyle: {
          color,
          shadowBlur: 12,
          shadowColor: color,
        },
        tooltip: { show: false },
        z: 4,
      },
    ],
  }, true);
}

function hydrateLineCharts(root = document) {
  if (typeof echarts === 'undefined' || !root) return;
  ensureLineChartsResizeBinding();
  const nodes = root.matches?.('.echart-line') ? [root] : Array.from(root.querySelectorAll('.echart-line'));
  nodes.forEach(renderEchartsLine);
}

function ensureLineChartsResizeBinding() {
  if (window.__nightEconomyLineChartsResizeBound) return;
  window.__nightEconomyLineChartsResizeBound = true;
  window.addEventListener('resize', () => {
    document.querySelectorAll('.echart-line').forEach(el => {
      const chart = ECHARTS_LINE_CACHE.get(el);
      if (chart) chart.resize();
    });
  });
}

function svgSpark(h, up, W, H) {
  return buildLineChartMarkup(h, {
    color: up ? '#ff5252' : '#3dd68c',
    width: W,
    height: H,
    strokeWidth: H > 40 ? 2.5 : 1.8,
    endLabel: H >= 56,
  });
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
  const prevPanel = document.getElementById(`pv${currentPanel}`);
  const prevDot = document.getElementById(`dot${currentPanel}`);
  if (prevPanel) prevPanel.classList.remove('active');
  if (prevDot) prevDot.classList.remove('active');

  currentPanel = idx % 2;
  const updaters = [updateMarketPanel, updateMiniSpotlight];
  if (typeof updaters[currentPanel] === 'function') updaters[currentPanel]();

  const nextPanel = document.getElementById(`pv${currentPanel}`);
  const nextDot = document.getElementById(`dot${currentPanel}`);
  if (nextPanel) nextPanel.classList.add('active');
  if (nextDot) nextDot.classList.add('active');
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
  camera.position.z = 7.2;

  // Create floating particles network
  const particleCount = 150;
  const particles = [];
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 24;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 24;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 24;
    particles.push({
      x: positions[i * 3],
      y: positions[i * 3 + 1],
      z: positions[i * 3 + 2],
      vx: (Math.random() - 0.5) * 0.016,
      vy: (Math.random() - 0.5) * 0.016,
      vz: (Math.random() - 0.5) * 0.016
    });
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color: 0x3dd68c,
    size: 0.12,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.58,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const points = new THREE.Points(geometry, mat);
  points.renderOrder = 2;
  scene.add(points);

  const glowMat = new THREE.PointsMaterial({
    color: 0x9df5c7,
    size: 0.28,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.08,
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
  const ambientLight = new THREE.AmbientLight(0x3dd68c, 0.22);
  scene.add(ambientLight);

  const accentLight = new THREE.PointLight(0x3dd68c, 0.6, 60);
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
    mats.forEach(mat => mat.color.lerp(target, 0.035));
  }

  renderer.render(scene, camera);
}

function resetThree() {
  if (scene && scene.children[0]) {
    const mesh = scene.children.find(c => c.geometry instanceof THREE.IcosahedronGeometry);
    if (mesh) mesh.rotation.set(0, 0, 0);
  }
}
