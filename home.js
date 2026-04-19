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

let currentBoardView = 0;

function buildBoard(viewIdx) {
  if (viewIdx !== undefined) currentBoardView = viewIdx;
  const view = BOARD_VIEWS[currentBoardView];
  const inner = document.getElementById('boardInner');
  if (!inner) return;

  const labelEl = document.getElementById('boardViewLabel');
  if (labelEl) labelEl.textContent = view.label;

  inner.style.transition = 'opacity 0.35s';
  inner.style.opacity = '0';

  setTimeout(() => {
    inner.innerHTML = '';
    const drinks = D.filter(d => view.ids.includes(d.id));
    const cats = [...new Set(drinks.map(d => d.cat))];

    cats.forEach(cat => {
      const items = drinks.filter(d => d.cat === cat);
      if (!items.length) return;

      const sec = document.createElement('div');
      sec.className = 'cat-section';

      const gainers = items.filter(d => d.p > d.b).length;
      const catChg = (items.reduce((s, d) => s + ((d.p - d.b) / d.b * 100), 0) / items.length).toFixed(1);
      const hdr = document.createElement('div');
      hdr.className = 'cat-header';
      hdr.innerHTML = `<span class="cat-name ${cat}">◆ ${cat.replace('-', ' ')}</span><span class="cat-meta">${catChg > 0 ? '+' : ''}${catChg}%</span>`;
      sec.appendChild(hdr);

      items.forEach(d => {
        const row = document.createElement('div');
        row.className = `drow ${d.o > 0 ? 'fresh' : 'decaying'}`;
        row.id = `r${d.id}`;
        const pct = ((d.p - d.b) / d.b * 100).toFixed(1);
        const up = d.p >= d.b;
        row.innerHTML = `
          <div><div class="dname">${d.n}</div><div class="dcat-sub">${d.cat.replace('-',' ')}</div></div>
          <div class="dprice ${up?'up':'dn'}" id="p${d.id}">£${d.p.toFixed(2)}</div>
          <div class="spark-cell" id="sp${d.id}">${svgSpark(d.h,up,104,24)}</div>
          <div class="dpct ${up?'up':'dn'}" id="pct${d.id}">${up?'+':''}${pct}%</div>
          <div class="decay-wrap"><div class="decay-bar"><div class="decay-fill" style="width:${Math.min(100, d.o * 8.33)}%"></div></div><div class="darr ${up?'up':'dn'}" id="arr${d.id}">${up?'▲':'▼'}</div></div>
        `;
        sec.appendChild(row);
      });
      inner.appendChild(sec);
    });

    inner.style.opacity = '1';
  }, 350);
}

function rotateBoardView() {
  buildBoard((currentBoardView + 1) % BOARD_VIEWS.length);
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

function updateMiniSpotlight() {
  const nameEl = document.getElementById('mini-sp-name');
  if (!nameEl) return;

  const active = [...D].sort((a, b) => b.o - a.o);
  const drink = active[0].o > 0 ? active[0] : D[Math.floor(Math.random() * D.length)];
  const chg = ((drink.p - drink.b) / drink.b * 100);
  const isUp = chg >= 0;

  nameEl.textContent = drink.n;
  document.getElementById('mini-sp-sub').textContent = drink.cat.replace('-', ' ');

  const priceEl = document.getElementById('mini-sp-price');
  priceEl.textContent = '£' + drink.p.toFixed(2);
  priceEl.className = 'mini-sp-price ' + (isUp ? 'up' : 'dn');

  const chgEl = document.getElementById('mini-sp-chg');
  chgEl.textContent = (chg >= 0 ? '+' : '') + chg.toFixed(1) + '%';
  chgEl.className = 'mini-sp-chg ' + (isUp ? 'up' : 'dn');

  const chartEl = document.getElementById('mini-sp-chart');
  if (chartEl) chartEl.innerHTML = svgSpark(drink.h, isUp, 220, 50);

  document.getElementById('mini-sp-blurb').textContent = CULTURAL_BLURBS[drink.id] || '';
  document.getElementById('mini-sp-orders').textContent = drink.o || '—';
  document.getElementById('mini-sp-base').textContent = '£' + drink.b.toFixed(2);
  document.getElementById('mini-sp-cat-lbl').textContent = drink.cat.replace('-', ' ');
}
