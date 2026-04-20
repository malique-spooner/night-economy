/* ════════════════════════════════════════════════════════════════════
   APP PAGES — mobile menu, manager dashboard, employee controls
   ════════════════════════════════════════════════════════════════════ */

const APP_VIEW_NAMES = {
  tv: 'TV View',
  mobile: 'Mobile Menu',
  manager: 'Manager View',
  employee: 'Employee View',
};

function getAppView() {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('view');
  return APP_VIEW_NAMES[requested] ? requested : 'tv';
}

function formatMoney(value) {
  return `£${Number(value || 0).toFixed(2)}`;
}

function groupBy(items, keyFn) {
  return items.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

function injectPageShell() {
  if (document.getElementById('pageShell')) return;

  const shell = document.createElement('div');
  shell.id = 'pageShell';
  shell.className = 'page-shell';
  shell.innerHTML = `
    <nav class="page-switcher" aria-label="Page switcher">
      <a class="page-chip" href="?view=tv" data-view="tv">TV</a>
      <a class="page-chip" href="?view=mobile" data-view="mobile">Mobile</a>
      <a class="page-chip" href="?view=manager" data-view="manager">Manager</a>
      <a class="page-chip" href="?view=employee" data-view="employee">Employee</a>
    </nav>

    <section id="mobileView" class="alt-view mobile-view">
      <div class="alt-hero">
        <div>
          <div class="alt-kicker">Night Economy</div>
          <h1 class="alt-title">Mobile Menu</h1>
          <p class="alt-sub">A compact ordering screen for guests and front-of-house tablets.</p>
        </div>
        <div class="alt-stats" id="mobileSummary"></div>
      </div>
      <div class="mobile-filters" id="mobileFilters"></div>
      <div class="menu-grid" id="mobileCatalog"></div>
    </section>

    <section id="managerView" class="alt-view manager-view">
      <div class="alt-hero">
        <div>
          <div class="alt-kicker">Night Economy</div>
          <h1 class="alt-title">Manager Dashboard</h1>
          <p class="alt-sub">Sales, performance, and live trade history in one operational view.</p>
        </div>
        <div class="alt-stats" id="managerSummary"></div>
      </div>
      <div class="dash-grid">
        <div class="dash-card dash-card-wide">
          <div class="card-hdr">Sales Records</div>
          <div class="record-list" id="managerSales"></div>
        </div>
        <div class="dash-card">
          <div class="card-hdr">Category Performance</div>
          <div class="metric-list" id="managerCategories"></div>
        </div>
        <div class="dash-card">
          <div class="card-hdr">Top Movers</div>
          <div class="metric-list" id="managerMovers"></div>
        </div>
      </div>
    </section>

    <section id="employeeView" class="alt-view employee-view">
      <div class="alt-hero">
        <div>
          <div class="alt-kicker">Night Economy</div>
          <h1 class="alt-title">Employee Launch Board</h1>
          <p class="alt-sub">Set floors and ceilings, rename drinks, move categories, or mark items sold out.</p>
        </div>
        <div class="alt-stats" id="employeeSummary"></div>
      </div>
      <div class="employee-panel">
        <div class="card-hdr">Drink Controls</div>
        <div class="employee-list" id="employeeControls"></div>
      </div>
    </section>
  `;

  document.body.appendChild(shell);
}

function setActiveAppView(view) {
  document.body.dataset.appView = view;
  document.querySelectorAll('.page-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.view === view);
  });

  const tvRoot = document.querySelector('.root');
  if (tvRoot) tvRoot.style.display = view === 'tv' ? '' : 'none';

  document.querySelectorAll('.alt-view').forEach(panel => {
    panel.classList.toggle('active', panel.id === `${view}View`);
  });

  document.title = `Night Economy — ${APP_VIEW_NAMES[view] || 'TV View'}`;
}

function renderStatPill(container, label, value, tone = '') {
  const pill = document.createElement('div');
  pill.className = `stat-pill ${tone}`.trim();
  pill.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
  container.appendChild(pill);
}

function renderMobileView() {
  const summary = document.getElementById('mobileSummary');
  const filters = document.getElementById('mobileFilters');
  const catalog = document.getElementById('mobileCatalog');
  if (!summary || !filters || !catalog) return;

  const activeDrinks = D.filter(d => !d.soldOut);
  const soldOutCount = D.length - activeDrinks.length;
  const topDrink = [...D].sort((a, b) => b.o - a.o)[0];
  summary.innerHTML = '';
  renderStatPill(summary, 'Live items', activeDrinks.length);
  renderStatPill(summary, 'Sold out', soldOutCount);
  renderStatPill(summary, 'Most ordered', topDrink ? topDrink.n : '—');

  const cats = [...new Set(D.map(d => d.cat))];
  filters.innerHTML = cats.map(cat => `<button class="chip" data-filter="${cat}">${cat.replace('-', ' ')}</button>`).join('');
  const filterButtons = filters.querySelectorAll('.chip');

  const renderCards = (filter = 'all') => {
    filterButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.filter === filter));
    const grouped = groupBy(D.filter(d => filter === 'all' || d.cat === filter), d => d.cat);
    catalog.innerHTML = Object.values(grouped).map(items => {
      const cat = items[0].cat;
      return `
        <div class="menu-section">
          <div class="menu-section-hdr">
            <span>${cat.replace('-', ' ')}</span>
            <span>${items.length} drinks</span>
          </div>
          <div class="menu-cards">
            ${items.map(d => {
              const change = ((d.p - d.b) / d.b * 100);
              const soldClass = d.soldOut ? 'sold-out' : '';
              return `
                <article class="menu-card ${soldClass}">
                  <div class="menu-card-top">
                    <div>
                      <h3>${d.n}</h3>
                      <p>${d.cat.replace('-', ' ')}</p>
                    </div>
                    <div class="menu-price">${formatMoney(d.p)}</div>
                  </div>
                  <div class="menu-meta">
                    <span>Floor ${formatMoney(d.floor)}</span>
                    <span>Ceiling ${formatMoney(d.ceiling)}</span>
                  </div>
                  <div class="menu-body">
                    <span class="change ${change >= 0 ? 'up' : 'dn'}">${change >= 0 ? '+' : ''}${change.toFixed(1)}%</span>
                    <span class="status ${d.soldOut ? 'off' : 'on'}">${d.soldOut ? 'Sold out' : 'Available'}</span>
                  </div>
                  <button class="menu-action" data-order="${d.id}" ${d.soldOut ? 'disabled' : ''}>${d.soldOut ? 'Unavailable' : 'Order now'}</button>
                </article>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }).join('');

    catalog.querySelectorAll('[data-order]').forEach(btn => {
      btn.addEventListener('click', () => fireOrder(btn.dataset.order));
    });
  };

  filters.querySelectorAll('.chip').forEach(btn => {
    btn.addEventListener('click', () => renderCards(btn.dataset.filter));
  });
  renderCards('all');
}

function renderManagerView() {
  const summary = document.getElementById('managerSummary');
  const sales = document.getElementById('managerSales');
  const categories = document.getElementById('managerCategories');
  const movers = document.getElementById('managerMovers');
  if (!summary || !sales || !categories || !movers) return;

  const totalOrders = SALES_LOG.length;
  const revenue = SALES_LOG.reduce((sum, row) => sum + row.price, 0);
  const soldOut = D.filter(d => d.soldOut).length;
  const avgPrice = totalOrders ? revenue / totalOrders : 0;
  summary.innerHTML = '';
  renderStatPill(summary, 'Orders', totalOrders);
  renderStatPill(summary, 'Revenue', formatMoney(revenue));
  renderStatPill(summary, 'Average', formatMoney(avgPrice));
  renderStatPill(summary, 'Sold out', soldOut);

  const groupedSales = groupBy(SALES_LOG.slice().reverse().slice(0, 40), row => row.cat);
  sales.innerHTML = SALES_LOG.length ? SALES_LOG.slice().reverse().slice(0, 24).map(row => `
    <div class="record-row">
      <span>${new Date(row.t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
      <strong>${row.n}</strong>
      <span class="tone ${row.type === 'buy' ? 'up' : 'dn'}">${row.type.toUpperCase()}</span>
      <span>${formatMoney(row.price)}</span>
    </div>
  `).join('') : '<div class="empty-state">No sales logged yet.</div>';

  const catRows = Object.entries(groupBy(D, d => d.cat)).map(([cat, items]) => {
    const orders = items.reduce((sum, item) => sum + item.o, 0);
    const average = items.reduce((sum, item) => sum + item.p, 0) / items.length;
    return { cat, items, orders, average };
  }).sort((a, b) => b.orders - a.orders);

  categories.innerHTML = catRows.map(row => `
    <div class="metric-row">
      <div>
        <strong>${row.cat.replace('-', ' ')}</strong>
        <span>${row.items.length} drinks</span>
      </div>
      <div>
        <strong>${row.orders}</strong>
        <span>${formatMoney(row.average)}</span>
      </div>
    </div>
  `).join('');

  const moversList = [...D].sort((a, b) => ((b.p - b.b) / b.b) - ((a.p - a.b) / a.b)).slice(0, 6);
  movers.innerHTML = moversList.map(d => {
    const change = ((d.p - d.b) / d.b * 100);
    return `
      <div class="metric-row">
        <div>
          <strong>${d.n}</strong>
          <span>${d.cat.replace('-', ' ')}</span>
        </div>
        <div>
          <strong class="${change >= 0 ? 'up' : 'dn'}">${change >= 0 ? '+' : ''}${change.toFixed(1)}%</strong>
          <span>${formatMoney(d.p)}</span>
        </div>
      </div>
    `;
  }).join('');
}

function renderEmployeeView() {
  const summary = document.getElementById('employeeSummary');
  const controls = document.getElementById('employeeControls');
  if (!summary || !controls) return;

  const active = D.filter(d => !d.soldOut).length;
  const soldOut = D.filter(d => d.soldOut).length;
  const catCount = Object.keys(groupBy(D, d => d.cat)).length;
  summary.innerHTML = '';
  renderStatPill(summary, 'Active', active);
  renderStatPill(summary, 'Sold out', soldOut);
  renderStatPill(summary, 'Categories', catCount);

  controls.innerHTML = D.map(d => `
    <div class="employee-row ${d.soldOut ? 'sold-out' : ''}" data-drink="${d.id}">
      <div class="employee-main">
        <input class="employee-name" data-field="name" data-id="${d.id}" value="${d.n}">
        <select class="employee-cat" data-field="cat" data-id="${d.id}">
          ${[...new Set(DRINKS.map(item => item.cat))].map(cat => `<option value="${cat}" ${cat === d.cat ? 'selected' : ''}>${cat.replace('-', ' ')}</option>`).join('')}
        </select>
      </div>
      <div class="employee-grid">
        <label>Floor <input type="number" step="0.01" data-field="floor" data-id="${d.id}" value="${Number(d.floor).toFixed(2)}"></label>
        <label>Ceiling <input type="number" step="0.01" data-field="ceiling" data-id="${d.id}" value="${Number(d.ceiling).toFixed(2)}"></label>
      </div>
      <div class="employee-actions">
        <label class="toggle">
          <input type="checkbox" data-field="soldOut" data-id="${d.id}" ${d.soldOut ? 'checked' : ''}>
          <span>${d.soldOut ? 'Sold out' : 'Live'}</span>
        </label>
        <button data-reset="${d.id}">Reset</button>
      </div>
    </div>
  `).join('');

  controls.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('change', () => {
      const id = el.dataset.id;
      const field = el.dataset.field;
      const patch = {};
      if (field === 'floor' || field === 'ceiling') {
        patch[field] = Number(el.value);
      } else if (field === 'soldOut') {
        patch.soldOut = el.checked;
      } else {
        patch[field] = el.value;
      }
      setDrinkMarketConfig(id, patch);
      refreshAuxViews();
    });
  });

  controls.querySelectorAll('[data-reset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.reset;
      const drink = DRINKS.find(item => item.id === id);
      if (!drink) return;
      setDrinkMarketConfig(id, {
        name: drink.n,
        cat: drink.cat,
        floor: +(drink.b * 0.65).toFixed(2),
        ceiling: +(drink.b * 1.65).toFixed(2),
        soldOut: false,
      });
      refreshAuxViews();
    });
  });
}

function refreshAuxViews() {
  const view = getAppView();
  if (view === 'mobile') renderMobileView();
  if (view === 'manager') renderManagerView();
  if (view === 'employee') renderEmployeeView();
}

function initAppPages() {
  injectPageShell();
  const view = getAppView();
  setActiveAppView(view);
  refreshAuxViews();

  document.querySelectorAll('.page-chip').forEach(chip => {
    chip.addEventListener('click', (event) => {
      event.preventDefault();
      const nextView = chip.dataset.view;
      const url = new URL(window.location.href);
      url.searchParams.set('view', nextView);
      window.history.pushState({}, '', url);
      setActiveAppView(nextView);
      refreshAuxViews();
    });
  });

  window.addEventListener('popstate', () => {
    const next = getAppView();
    setActiveAppView(next);
    refreshAuxViews();
  });

  window.refreshAuxViews = refreshAuxViews;

  setInterval(() => {
    const view = getAppView();
    if (view === 'mobile' || view === 'manager') refreshAuxViews();
  }, 1500);
}

document.addEventListener('DOMContentLoaded', initAppPages);
