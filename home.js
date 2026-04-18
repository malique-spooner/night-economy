/* ════════════════════════════════════════════════════════════════════
   HOME VIEW — base home panel functions
   ════════════════════════════════════════════════════════════════════ */

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
  const cats = ['bloody-mary', 'margarita', 'spritz', 'negroni', 'old-fashioned', 'espresso', 'signature', 'mocktail'];
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
  const gossips = GOSSIP_ITEMS.sort(() => Math.random() - 0.5).slice(0, 5);

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

/* ════════════════════════════════════════════════════════════════════
   CATEGORY ANALYTICS HELPERS (used by spotlight too)
   ════════════════════════════════════════════════════════════════════ */

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
