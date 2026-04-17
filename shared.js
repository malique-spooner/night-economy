/* ════════════════════════════════════════════════════════════════════
   SHARED STATE
   ════════════════════════════════════════════════════════════════════ */

// Market data - imported from data.js
let D = DRINKS.map(d => ({ ...d, h: [...d.h], o: 0 }));

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
  if (!drink) return;

  drink.o++;
  const trend = Math.random() > 0.4 ? 'up' : 'dn';
  const mult = trend === 'up' ? 1.08 : 0.96;
  const prev = drink.p;
  drink.p = Math.max(drink.b * 0.5, drink.p * mult);
  drink.h.push(drink.p);
  if (drink.h.length > 12) drink.h.shift();

  // Track order in timeline for spotlight chart/activity feed
  if (!drink.timeline) drink.timeline = [];
  drink.timeline.push({
    t: Date.now(),
    o: drink.o,
    p: drink.p,
    type: trend === 'up' ? 'buy' : 'sell'
  });
  if (drink.timeline.length > 50) drink.timeline.shift();

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

  // Update spotlight activity feed and chart if this drink is currently spotlighted
  const spName = document.getElementById('sp-name');
  if (spName && spName.textContent === drink.n && currentMode === 'spotlight') {
    updateActivityFeed(drink);
    const chartEl = document.getElementById('sp-chart');
    if (chartEl) {
      chartEl.innerHTML = chartTimeline(drink, 560, 240);
    }
  }
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
}

function applyDecay() {
  D.forEach(d => {
    d.p = Math.max(d.b * 0.5, d.p * 0.995);
    d.h.push(d.p);
    if (d.h.length > 12) d.h.shift();
    updateRowDisplay(d);
  });
  renderTicker();
}

/* ════════════════════════════════════════════════════════════════════
   BOARD RENDERING
   ════════════════════════════════════════════════════════════════════ */

function buildBoard() {
  const cats = ['cocktails', 'beer', 'spirits', 'zero'];
  const inner = document.getElementById('boardInner');
  if (!inner) return;

  inner.innerHTML = '';
  cats.forEach(cat => {
    const items = D.filter(d => d.cat === cat);
    const avg = items.reduce((s, d) => s + d.p, 0) / items.length;
    const chg = ((avg - items[0].b) / items[0].b * 100).toFixed(1);

    const sec = document.createElement('div');
    sec.className = 'cat-section';

    const hdr = document.createElement('div');
    hdr.className = 'cat-header';
    hdr.innerHTML = `
      <span class="cat-name ${cat}">◆ ${cat}</span>
      <span class="cat-meta">${chg > 0 ? '+' : ''}${chg}%</span>
    `;
    sec.appendChild(hdr);

    items.forEach(d => {
      const row = document.createElement('div');
      row.className = `drow ${d.o > 0 ? 'fresh' : 'decaying'}`;
      row.id = `r${d.id}`;

      const pct = ((d.p - d.b) / d.b * 100).toFixed(1);
      const up = d.p >= d.b;

      row.innerHTML = `
        <div><div class="dname">${d.n}</div><div class="dcat-sub">${d.cat}</div></div>
        <div class="dprice ${up?'up':'dn'}" id="p${d.id}">£${d.p.toFixed(2)}</div>
        <div class="spark-cell" id="sp${d.id}">${svgSpark(d.h,up,104,24)}</div>
        <div class="dpct ${up?'up':'dn'}" id="pct${d.id}">${up?'+':''}${pct}%</div>
        <div class="decay-wrap"><div class="decay-bar"><div class="decay-fill" style="width:${Math.min(100, d.o * 8.33)}%"></div></div><div class="darr ${up?'up':'dn'}" id="arr${d.id}">${up?'▲':'▼'}</div></div>
      `;
      sec.appendChild(row);
    });

    inner.appendChild(sec);
  });
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

function insertTradeRow(dId, isUp, prev, type) {
  const drink = D.find(d => d.id === dId);
  if (!drink) return;

  const parent = document.getElementById(`r${dId}`);
  if (!parent) return;

  const row = document.createElement('div');
  row.className = `trow ${isUp ? 'up' : 'dn'} entering`;

  const chg = drink.p - prev;
  const pct = (chg / prev * 100).toFixed(2);
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  row.innerHTML = `
    <div class="tr-label"><span class="tr-tag ${type.toLowerCase()}">${type}</span><span class="tr-name">${drink.n}</span></div>
    <div class="tr-price ${isUp ? 'up' : 'dn'}">£${drink.p.toFixed(2)}</div>
    <div class="tr-move ${isUp ? 'up' : 'dn'}">+${chg.toFixed(2)}</div>
    <div class="tr-move ${isUp ? 'up' : 'dn'}">${pct > 0 ? '+' : ''}${pct}%</div>
    <div class="tr-time">${time}</div>
  `;

  parent.parentNode.insertBefore(row, parent.nextSibling);

  setTimeout(() => row.classList.add('exiting'), 5000);
  setTimeout(() => row.remove(), 5500);
}

/* ════════════════════════════════════════════════════════════════════
   PANEL UPDATES
   ════════════════════════════════════════════════════════════════════ */

function updateMarketPanel() {
  const sorted = [...D].sort((a, b) => b.p - a.p);
  const best = sorted[sorted.length - 1];
  const riser = [...D].sort((a, b) => (b.p - b.b) - (a.p - a.b))[0];
  const faller = [...D].sort((a, b) => (a.p - a.b) - (b.p - b.b))[0];
  const mood = D.filter(d => d.p > d.b).length > 6 ? 'Bullish' : 'Bearish';

  document.getElementById('mn-hl').textContent = `${riser.n} leading surge`;
  document.getElementById('mn-sub').textContent = `Strong demand across categories. ${riser.n} up ${((riser.p - riser.b) / riser.b * 100).toFixed(1)}%. ${faller.n} down.`;
  document.getElementById('mn-value').textContent = `£${best.p.toFixed(2)}`;
  document.getElementById('mn-riser').textContent = riser.n;
  document.getElementById('mn-faller').textContent = faller.n;
  document.getElementById('mn-mood').textContent = mood;

  const now = new Date();
  document.getElementById('mn-time').textContent = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
}

function updateGossipPanel() {
  const gossips = [
    'Late crowd just arrived — cocktail demand surging',
    'Whisky orders picking up — spirits category heating',
    'Beer sales holding steady — lager popular tonight',
    'Zero sugar options gaining traction — health conscious cohort',
    'Market volatility increasing — unusual trading patterns'
  ];

  const feed = document.getElementById('gossip-feed');
  if (!feed) return;
  feed.innerHTML = gossips.map(g => {
    const hot = Math.random() > 0.6;
    return `
      <div class="g-item">
        <div class="g-handle">◆ Floor desk ${hot ? '<span class="g-hot">hot</span>' : ''}</div>
        <div class="g-text">${g}</div>
        <div class="g-meta">moments ago</div>
      </div>
    `;
  }).join('');
}

function updateSpotlightPanel() {
  const drink = D[Math.floor(Math.random() * D.length)];
  const hi = Math.max(...drink.h);
  const lo = Math.min(...drink.h);
  const trend = drink.p > drink.b ? 'dn' : 'up';
  const chg = drink.p - drink.b;
  const ohlc = getOHLC(drink);

  document.getElementById('sp-name').textContent = drink.n;
  document.getElementById('sp-cat').textContent = drink.cat;

  const priceEl = document.getElementById('sp-price');
  priceEl.textContent = `£${drink.p.toFixed(2)}`;
  priceEl.className = `sp-price ${trend}`;

  const chgEl = document.getElementById('sp-chg');
  chgEl.textContent = `${chg > 0 ? '+' : ''}${(chg / drink.b * 100).toFixed(1)}%`;
  chgEl.className = `sp-chg ${drink.p > drink.b ? 'up' : 'dn'}`;

  // OHLC Stats
  document.getElementById('sp-open').textContent = `£${ohlc.open.toFixed(2)}`;
  document.getElementById('sp-high').textContent = `£${ohlc.high.toFixed(2)}`;
  document.getElementById('sp-low').textContent = `£${ohlc.low.toFixed(2)}`;
  document.getElementById('sp-close').textContent = `£${ohlc.close.toFixed(2)}`;
  document.getElementById('sp-orders').textContent = drink.o;

  // Market Sentiment Badge
  const sentBadge = document.getElementById('sp-sentiment');
  if (sentBadge) {
    const commentary = getPriceCommentary(drink);
    const isBullish = commentary.includes('Strong') || commentary.includes('demand') || commentary.includes('Buyers');
    const sentiment = isBullish ? 'BULLISH' : 'BEARISH';
    sentBadge.textContent = sentiment;
    sentBadge.className = `sp-sentiment-badge ${isBullish ? 'bullish' : 'bearish'}`;
  }

  // Render chart (timeline or fallback sparkline)
  const chartEl = document.getElementById('sp-chart');
  if (chartEl) {
    chartEl.innerHTML = chartTimeline(drink, 560, 240);
  }

  // Render activity feed and market context
  updateActivityFeed(drink);
}

function updateActivityFeed(drink) {
  const feed = document.getElementById('sp-activity');
  if (!feed) return;

  // Get last 5 orders from timeline
  if (!drink.timeline || drink.timeline.length === 0) {
    feed.innerHTML = '<div style="font-size:11px;color:rgba(255,255,255,0.3)">No trading activity yet</div>';
    return;
  }

  const recent = drink.timeline.slice(-5).reverse();

  feed.innerHTML = recent.map((evt) => {
    const time = new Date(evt.t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const change = ((evt.p - drink.b) / drink.b * 100).toFixed(1);
    const arrow = evt.type === 'buy' ? '⬆' : '⬇';
    const typeClass = evt.type === 'buy' ? 'buy' : 'sell';

    return `<div class="activity-item ${typeClass}">
      <span class="act-time">${time}</span>
      <span class="act-type">${evt.type.toUpperCase()}</span>
      <span class="act-price">£${evt.p.toFixed(2)}</span>
      <span class="act-change ${change >= 0 ? 'up' : 'dn'}">${change >= 0 ? '+' : ''}${change}%</span>
      <span class="act-arrow">${arrow}</span>
    </div>`;
  }).join('');

  // Add category insight and price commentary
  const insight = getCategoryInsight(drink.cat);
  const commentary = getPriceCommentary(drink);

  feed.innerHTML += `<div class="activity-insight">
    <div class="insight-category">${insight}</div>
    <div class="insight-commentary">${commentary}</div>
  </div>`;
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

function updateNewsBar(d) {
  const msgs = [
    `${d.n} just ordered — price rising · £${d.p.toFixed(2)} now`,
    `Order activity: ${d.n} catching bids at £${d.p.toFixed(2)}`,
    `Unordered drinks decaying — the longer you wait, the cheaper they get`
  ];
  startCrawl(msgs[Math.floor(Math.random() * msgs.length)]);

  const n = new Date();
  const nbsrc = document.getElementById('nbsrc');
  if (nbsrc) nbsrc.textContent = `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')} · Market Desk`;
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

  currentPanel = idx % 3;
  const updaters = [updateMarketPanel, updateGossipPanel, updateSpotlightPanel];
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
  camera.position.z = 8;

  // Create floating particles network
  const particleCount = 120;
  const particles = [];
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 25;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 25;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 25;
    particles.push({
      x: positions[i * 3],
      y: positions[i * 3 + 1],
      z: positions[i * 3 + 2],
      vx: (Math.random() - 0.5) * 0.015,
      vy: (Math.random() - 0.5) * 0.015,
      vz: (Math.random() - 0.5) * 0.015
    });
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color: 0x3dd68c,
    size: 0.08,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.4
  });

  const points = new THREE.Points(geometry, mat);
  scene.add(points);

  // Store for animation
  scene.userData.particles = particles;
  scene.userData.geometry = geometry;

  // Soft lighting
  const ambientLight = new THREE.AmbientLight(0x3dd68c, 0.2);
  scene.add(ambientLight);
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

  renderer.render(scene, camera);
}

function resetThree() {
  if (scene && scene.children[0]) {
    const mesh = scene.children.find(c => c.geometry instanceof THREE.IcosahedronGeometry);
    if (mesh) mesh.rotation.set(0, 0, 0);
  }
}

/* ════════════════════════════════════════════════════════════════════
   SPOTLIGHT ANALYTICS HELPERS
   ════════════════════════════════════════════════════════════════════ */

function getOHLC(drink) {
  if (!drink.timeline || drink.timeline.length === 0) {
    return { open: drink.p, high: drink.p, low: drink.p, close: drink.p };
  }
  const prices = drink.timeline.map(t => t.p);
  return {
    open: drink.timeline[0].p,
    high: Math.max(...prices),
    low: Math.min(...prices),
    close: drink.p
  };
}

function getCategoryInsight(cat) {
  const items = D.filter(d => d.cat === cat);
  if (items.length === 0) return 'No data';
  const up = items.filter(d => d.p > d.b).length;
  const total = items.length;
  const pct = Math.round((up / total) * 100);

  if (up > total * 0.65) return `${cat} surging · ${pct}% gainers`;
  if (up < total * 0.35) return `${cat} declining · ${pct}% gainers`;
  return `${cat} mixed · ${pct}% gainers`;
}

function getPriceCommentary(drink) {
  if (!drink.timeline || drink.timeline.length < 3) return 'Price discovery phase';

  const recent = drink.timeline.slice(-3);
  const buys = recent.filter(t => t.type === 'buy').length;
  const sells = recent.filter(t => t.type === 'sell').length;

  if (buys >= 2 && buys > sells) return 'Strong demand · Buyers in control';
  if (sells >= 2 && sells > buys) return 'Profit-taking · Selling pressure';
  return 'Balanced · Price consolidating';
}

function chartTimeline(drink, W, H) {
  // Fallback to sparkline if no timeline data
  if (!drink.timeline || drink.timeline.length < 2) {
    return svgSpark(drink.h, drink.p > drink.b, W, H);
  }

  const prices = drink.timeline.map(t => t.p);
  const mn = Math.min(...prices);
  const mx = Math.max(...prices);
  const rng = mx - mn || 0.01;

  // Determine color based on trend (up = red, down = green)
  const up = drink.p > drink.b;
  const lineColor = up ? '#ff5252' : '#3dd68c';
  const gridColor = 'rgba(255,255,255,0.08)';
  const areaColor = up ? 'rgba(255,82,82,0.08)' : 'rgba(61,214,140,0.08)';

  // Split canvas: 70% price chart, 30% volume bars
  const pricePct = 0.72;
  const volumePct = 0.28;

  const padding = 40;
  const chartW = W - (padding * 2);
  const priceH = Math.floor(H * pricePct);
  const volumeH = Math.floor(H * volumePct);

  const priceChartH = priceH - (padding * 2);
  const volumeChartH = volumeH - padding;

  // Generate price line points
  const pricePts = drink.timeline.map((t, i) => {
    const x = (i / (drink.timeline.length - 1)) * chartW + padding;
    const y = padding + (priceH - padding - ((t.p - mn) / rng) * priceChartH);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  // Generate filled area under price line
  const areaPoints = drink.timeline.map((t, i) => {
    const x = (i / (drink.timeline.length - 1)) * chartW + padding;
    const y = padding + (priceH - padding - ((t.p - mn) / rng) * priceChartH);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const areaPoly = [...areaPoints,
    `${(W - padding).toFixed(1)},${(priceH).toFixed(1)}`,
    `${padding.toFixed(1)},${(priceH).toFixed(1)}`
  ].join(' ');

  // Generate volume bars (colored by buy/sell type)
  const volumeBars = drink.timeline.map((t, i) => {
    const x = (i / (drink.timeline.length - 1)) * chartW + padding;
    const barW = Math.max(3, (chartW / drink.timeline.length) * 0.75);
    const barH = Math.max(3, volumeChartH * 0.75); // Taller bars for visibility
    const y = priceH + padding + (volumeChartH - barH);
    const barColor = t.type === 'buy' ? '#ff5252' : '#3dd68c';

    return `<rect x="${(x - barW/2).toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${barH.toFixed(1)}" fill="${barColor}" opacity="0.85" rx="2"/>`;
  }).join('');

  // Price line fill with area
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block">
    <!-- Background section divider -->
    <line x1="${padding}" y1="${priceH}" x2="${W - padding}" y2="${priceH}" stroke="${gridColor}" stroke-width="0.5" opacity="0.3"/>

    <!-- Price chart area -->
    <defs>
      <linearGradient id="priceGradient" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" style="stop-color:${lineColor};stop-opacity:0.15" />
        <stop offset="100%" style="stop-color:${lineColor};stop-opacity:0" />
      </linearGradient>
    </defs>

    <!-- Axes for price chart -->
    <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${priceH}" stroke="${gridColor}" stroke-width="1"/>
    <line x1="${padding}" y1="${priceH}" x2="${W - padding}" y2="${priceH}" stroke="${gridColor}" stroke-width="1"/>

    <!-- Horizontal grid lines for price chart -->
    <line x1="${padding}" y1="${padding + (priceChartH / 2)}" x2="${W - padding}" y2="${padding + (priceChartH / 2)}" stroke="${gridColor}" stroke-width="0.5" opacity="0.3"/>
    <line x1="${padding}" y1="${padding + (priceChartH * 0.25)}" x2="${W - padding}" y2="${padding + (priceChartH * 0.25)}" stroke="${gridColor}" stroke-width="0.5" opacity="0.2"/>
    <line x1="${padding}" y1="${padding + (priceChartH * 0.75)}" x2="${W - padding}" y2="${padding + (priceChartH * 0.75)}" stroke="${gridColor}" stroke-width="0.5" opacity="0.2"/>

    <!-- Filled area under price curve -->
    <polygon points="${areaPoly}" fill="url(#priceGradient)" />

    <!-- Price line -->
    <polyline points="${pricePts}" fill="none" stroke="${lineColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>

    <!-- Volume section -->
    <!-- Volume axes -->
    <line x1="${padding}" y1="${priceH}" x2="${padding}" y2="${H - padding}" stroke="${gridColor}" stroke-width="1"/>
    <line x1="${padding}" y1="${H - padding}" x2="${W - padding}" y2="${H - padding}" stroke="${gridColor}" stroke-width="1"/>

    <!-- Volume bars -->
    ${volumeBars}

    <!-- Price scale labels (right side) -->
    <text x="${W - 8}" y="${padding + 6}" font-size="11" fill="rgba(255,255,255,0.4)" text-anchor="end" font-family="'Inter', monospace">£${mx.toFixed(2)}</text>
    <text x="${W - 8}" y="${priceH - 4}" font-size="11" fill="rgba(255,255,255,0.4)" text-anchor="end" font-family="'Inter', monospace">£${mn.toFixed(2)}</text>

    <!-- Volume label -->
    <text x="${padding + 4}" y="${priceH + 12}" font-size="10" fill="rgba(255,255,255,0.3)" font-family="'Inter', monospace">Volume</text>
  </svg>`;
}
