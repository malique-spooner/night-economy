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
  const chg = drink.p - drink.b;
  const ohlc = getOHLC(drink);

  document.getElementById('sp-name').textContent = drink.n;
  document.getElementById('sp-cat').textContent = drink.cat;
  document.getElementById('sp-banner').textContent = drink.cat.toUpperCase();

  const priceEl = document.getElementById('sp-price');
  priceEl.textContent = `£${drink.p.toFixed(2)}`;
  priceEl.className = `sp-price ${drink.p > drink.b ? 'up' : 'dn'}`;

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
    const isBullish = drink.p > drink.b;
    const sentiment = isBullish ? 'BULLISH' : 'BEARISH';
    sentBadge.textContent = sentiment;
    sentBadge.className = `sp-sentiment-badge ${isBullish ? 'bullish' : 'bearish'}`;
  }

  // Render candlestick chart
  const chartEl = document.getElementById('sp-chart');
  if (chartEl) {
    chartEl.innerHTML = renderCandlestickChart(drink, 560, 280);
  }

  // Render peer sparklines
  renderPeerSparklines(drink);

  // Render category heat bar
  renderCategoryHeat(drink);

  // Render story strip with rotating headlines
  updateStoryRotation(drink);

  // Render live tape
  updateTapeFeed(drink);

  // Update clock
  const n = new Date();
  document.getElementById('sp-clock').textContent = `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}:${String(n.getSeconds()).padStart(2,'0')}`;
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

function updateCategoryRank(drink) {
  const rankEl = document.getElementById('sp-category-rank');
  if (!rankEl) return;

  const rankData = getCategoryRank(drink);
  const topPeers = rankData.peers.slice(0, 4); // Show top 4

  rankEl.innerHTML = topPeers.map((peer, idx) => {
    const change = peer.change;
    const pctWidth = Math.min(100, Math.max(0, ((change + 50) / 100) * 100)); // Normalize to 0-100%
    const isUp = change >= 0;
    const className = `category-rank-item ${peer.isCurrentDrink ? 'current' : ''} ${isUp ? 'up' : 'dn'}`;

    return `<div class="${className}">
      <div class="category-rank-name">${peer.name}</div>
      <div class="category-rank-bar">
        <div class="category-rank-fill" style="width:${pctWidth}%"></div>
      </div>
      <div class="category-rank-pct">${change >= 0 ? '+' : ''}${change.toFixed(1)}%</div>
    </div>`;
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

function getCategoryRank(drink) {
  const cat = drink.cat;
  const items = D.filter(d => d.cat === cat).sort((a, b) => {
    const aChange = ((a.p - a.b) / a.b * 100);
    const bChange = ((b.p - b.b) / b.b * 100);
    return bChange - aChange; // Descending order (best performers first)
  });

  const currentDrink = items.find(d => d.id === drink.id);
  const rank = items.indexOf(currentDrink) + 1;

  return {
    rank: rank,
    total: items.length,
    peers: items.map((d, idx) => ({
      name: d.n,
      change: ((d.p - d.b) / d.b * 100),
      isCurrentDrink: d.id === drink.id,
      isBetterThanCurrent: idx < items.indexOf(currentDrink),
      isWorseThanCurrent: idx > items.indexOf(currentDrink)
    }))
  };
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

/* ════════════════════════════════════════════════════════════════════
   CANDLESTICK & PEER RENDERING
   ════════════════════════════════════════════════════════════════════ */

function renderCandlestickChart(drink, W, H) {
  if (!drink.timeline || drink.timeline.length < 2) {
    return svgSpark(drink.h, drink.p > drink.b, W, H);
  }

  const prices = drink.timeline.map(t => t.p);
  const mn = Math.min(...prices);
  const mx = Math.max(...prices);
  const rng = mx - mn || 0.01;

  const up = drink.p > drink.b;
  const lineColor = up ? '#ff5252' : '#3dd68c';
  const gridColor = 'rgba(255,255,255,0.08)';
  const areaColor = up ? 'rgba(255,82,82,0.1)' : 'rgba(61,214,140,0.1)';

  const pricePct = 0.7;
  const padding = 35;
  const chartW = W - (padding * 2);
  const priceH = Math.floor(H * pricePct);
  const volumeH = H - priceH;
  const priceChartH = priceH - (padding * 2);
  const volumeChartH = volumeH - (padding * 0.5);

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

  // Generate volume bars
  const volumeBars = drink.timeline.map((t, i) => {
    const x = (i / (drink.timeline.length - 1)) * chartW + padding;
    const barW = Math.max(2, chartW / drink.timeline.length * 0.6);
    const barH = volumeChartH * 0.6;
    const y = priceH + padding * 0.5 + (volumeChartH - barH);
    const barColor = t.type === 'buy' ? '#ff5252' : '#3dd68c';

    return `<rect x="${(x - barW/2).toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${barH.toFixed(1)}" fill="${barColor}" opacity="0.5" rx="1"/>`;
  }).join('');

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block">
    <!-- Defs for gradient -->
    <defs>
      <linearGradient id="priceGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" style="stop-color:${lineColor};stop-opacity:0.2" />
        <stop offset="100%" style="stop-color:${lineColor};stop-opacity:0" />
      </linearGradient>
    </defs>

    <!-- Price axes -->
    <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${priceH}" stroke="${gridColor}" stroke-width="0.5"/>
    <line x1="${padding}" y1="${priceH}" x2="${W - padding}" y2="${priceH}" stroke="${gridColor}" stroke-width="0.5"/>

    <!-- Grid lines -->
    <line x1="${padding}" y1="${padding + (priceChartH / 2)}" x2="${W - padding}" y2="${padding + (priceChartH / 2)}" stroke="${gridColor}" stroke-width="0.3" opacity="0.15"/>

    <!-- Filled area -->
    <polygon points="${areaPoly}" fill="url(#priceGrad)" />

    <!-- Price line -->
    <polyline points="${pricePts}" fill="none" stroke="${lineColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>

    <!-- Volume section divider -->
    <line x1="${padding}" y1="${priceH}" x2="${W - padding}" y2="${priceH}" stroke="${gridColor}" stroke-width="0.3" opacity="0.2"/>

    <!-- Volume axes -->
    <line x1="${padding}" y1="${priceH}" x2="${padding}" y2="${H - padding * 0.5}" stroke="${gridColor}" stroke-width="0.5"/>
    <line x1="${padding}" y1="${H - padding * 0.5}" x2="${W - padding}" y2="${H - padding * 0.5}" stroke="${gridColor}" stroke-width="0.5"/>

    <!-- Volume bars -->
    ${volumeBars}

    <!-- Price labels -->
    <text x="${W - 4}" y="${padding + 4}" font-size="9" fill="rgba(255,255,255,0.3)" text-anchor="end" font-family="'DM Mono'">£${mx.toFixed(2)}</text>
    <text x="${W - 4}" y="${priceH - 2}" font-size="9" fill="rgba(255,255,255,0.3)" text-anchor="end" font-family="'DM Mono'">£${mn.toFixed(2)}</text>
  </svg>`;
}

function renderPeerSparklines(drink) {
  const peersEl = document.getElementById('sp-peers');
  if (!peersEl) return;

  const cat = drink.cat;
  const peers = D.filter(d => d.cat === cat)
    .sort((a, b) => ((b.p - b.b) / b.b) - ((a.p - a.b) / a.b))
    .slice(0, 4);

  peersEl.innerHTML = peers.map(peer => {
    const chg = ((peer.p - peer.b) / peer.b * 100);
    const upTrend = chg >= 0;
    const sparkSvg = svgSpark(peer.h, upTrend, 60, 20);

    return `<div class="sp-peer-item">
      <div class="sp-peer-name">${peer.n}</div>
      <div class="sp-peer-spark">${sparkSvg}</div>
      <div class="sp-peer-val ${upTrend ? 'up' : 'dn'}">${chg > 0 ? '+' : ''}${chg.toFixed(1)}%</div>
    </div>`;
  }).join('');
}

function renderCategoryHeat(drink) {
  const heatEl = document.getElementById('sp-heat');
  if (!heatEl) return;

  const cat = drink.cat;
  const catDrinks = D.filter(d => d.cat === cat)
    .sort((a, b) => ((Math.abs(b.p - b.b) / b.b)) - ((Math.abs(a.p - a.b) / a.b)));

  const maxChg = Math.max(...catDrinks.map(d => Math.abs((d.p - d.b) / d.b * 100))) || 1;

  const heatGrid = catDrinks.map(d => {
    const chg = ((d.p - d.b) / d.b * 100);
    const isCurrent = d.id === drink.id;
    const isUp = chg > 0;
    const size = Math.max(1.2, (Math.abs(chg) / maxChg) * 3.5);

    const color = isUp
      ? `rgba(255,82,82,${0.3 + (Math.abs(chg) / 20) * 0.7})`
      : `rgba(61,214,140,${0.3 + (Math.abs(chg) / 20) * 0.7})`;

    const border = isCurrent ? '2px solid rgba(201,170,82,0.8)' : '1px solid rgba(255,255,255,0.08)';

    return `<div class="sp-heat-tile" style="
      flex:${size};
      background:${color};
      border:${border};
      display:flex;align-items:center;justify-content:center;
      border-radius:4px;
      min-width:20px;min-height:20px;
      font-size:${size > 2 ? '9px' : '7px'};
      color:rgba(255,255,255,0.6);
      font-weight:600;
      text-align:center;
      padding:4px;
      ${isCurrent ? 'box-shadow:0 0 8px rgba(201,170,82,0.5);' : ''}
    ">
      <span>${d.n.split(' ')[0]}</span>
    </div>`;
  }).join('');

  heatEl.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:6px;width:100%">${heatGrid}</div>`;
}

function updateTapeFeed(drink) {
  const tapeEl = document.getElementById('sp-tape');
  if (!tapeEl) return;

  // Get recent orders and duplicate for animation
  const recent = drink.timeline ? drink.timeline.slice(-12).reverse() : [];
  const tapeitems = recent.map(evt => {
    const chg = ((evt.p - drink.b) / drink.b * 100).toFixed(1);
    const typeClass = evt.type === 'buy' ? 'buy' : 'sell';
    return `<div class="sp-tape-item">
      <span class="sp-tape-type ${typeClass}">${evt.type.toUpperCase()}</span>
      <span class="sp-tape-name">${drink.n}</span>
      <span class="sp-tape-price">£${evt.p.toFixed(2)}</span>
      <span class="sp-tape-price ${chg >= 0 ? 'up' : 'dn'}">${chg > 0 ? '+' : ''}${chg}%</span>
    </div>`;
  }).join('');

  // Duplicate for seamless loop
  tapeEl.innerHTML = tapeitems + tapeitems + tapeitems;
}

/* ════════════════════════════════════════════════════════════════════
   STORY GENERATION & ROTATION
   ════════════════════════════════════════════════════════════════════ */

function generateMarketStories(drink) {
  const stories = [];
  const cat = drink.cat;
  const catItems = D.filter(d => d.cat === cat);
  const chg = ((drink.p - drink.b) / drink.b * 100);
  const leadingDrink = catItems.reduce((a, b) => ((b.p - b.b) / b.b) > ((a.p - a.b) / a.b) ? b : a);

  // Story 1: Category context
  if (leadingDrink.id === drink.id) {
    const peerCount = catItems.filter(d => d.p > d.b).length;
    stories.push(`${drink.n} leads ${cat} · ${peerCount}/${catItems.length} category gainers`);
  } else {
    const gainers = catItems.filter(d => d.p > d.b).length;
    const sentiment = gainers > catItems.length * 0.5 ? 'strong' : 'weak';
    stories.push(`${cat} shows ${sentiment} demand · ${drink.n} trading amid peers`);
  }

  // Story 2: Momentum and order flow
  if (drink.timeline && drink.timeline.length >= 4) {
    const recent = drink.timeline.slice(-4);
    const buys = recent.filter(t => t.type === 'buy').length;
    const sells = recent.filter(t => t.type === 'sell').length;

    if (buys === 4) {
      stories.push(`All buys · ${drink.n} momentum unbroken · buyers stacking`);
    } else if (sells >= 3) {
      stories.push(`Sellers in control · ${drink.n} under pressure · distribution ongoing`);
    } else if (buys > sells) {
      stories.push(`Bid-heavy · ${drink.n} attracting fresh buyers · momentum intact`);
    }
  }

  // Story 3: Price action and volatility
  if (chg > 20) {
    stories.push(`${drink.n} spiking · +${chg.toFixed(0)}% · late night surge · fomo buying`);
  } else if (chg > 10) {
    stories.push(`${drink.n} up ${chg.toFixed(1)}% · steady climb · crowd following`);
  } else if (chg < -15) {
    stories.push(`${drink.n} crash · down ${Math.abs(chg).toFixed(0)}% · rotation happening`);
  } else if (chg < -5) {
    stories.push(`${drink.n} selling · down ${Math.abs(chg).toFixed(1)}% · consolidation phase`);
  } else {
    stories.push(`${drink.n} range · ±${Math.abs(chg).toFixed(1)}% · balanced interest`);
  }

  return stories;
}

function getSpotlightStory(drink) {
  // Generate 2-3 market stories + 1 cultural story
  const marketStories = generateMarketStories(drink);
  const culturalStory = CULTURAL_BLURBS[drink.id] || 'Classic drink · timeless appeal';

  // Combine: take up to 2 market stories + 1 cultural
  const stories = [
    ...marketStories.slice(0, 2),
    culturalStory
  ];

  return stories;
}

let storyRotationIndex = 0;
let storyRotationInterval = null;

function updateStoryRotation(drink) {
  const storyEl = document.getElementById('sp-story-content');
  if (!storyEl) return;

  const stories = getSpotlightStory(drink);

  // Clear existing rotation
  if (storyRotationInterval) clearInterval(storyRotationInterval);
  storyRotationIndex = 0;

  function showStory(idx) {
    const story = stories[idx % stories.length];
    storyEl.textContent = story;
    storyEl.style.opacity = '0';
    void storyEl.offsetWidth; // Force reflow
    storyEl.style.opacity = '1';
  }

  showStory(0);

  // Rotate every 4 seconds
  storyRotationInterval = setInterval(() => {
    storyRotationIndex++;
    showStory(storyRotationIndex);
  }, 4000);
}
