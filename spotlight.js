/* ════════════════════════════════════════════════════════════════════
   SPOTLIGHT VIEW — drink spotlight panel functions
   ════════════════════════════════════════════════════════════════════ */

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


  // Render candlestick chart
  const chartEl = document.getElementById('sp-chart');
  if (chartEl) {
    chartEl.innerHTML = renderCandlestickChart(drink, 560, 280);
  }

  // Render peer sparklines
  renderPeerSparklines(drink);

  // Render news article feed
  renderNewsArticles(drink);

  // Render live tape
  updateTapeFeed(drink);

  // Update clock
  const n = new Date();
  document.getElementById('sp-clock').textContent = `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}:${String(n.getSeconds()).padStart(2,'0')}`;

  // Dramatic reveal
  revealSpotlightDrink();
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

function generateArticles(drink) {
  const chg = ((drink.p - drink.b) / drink.b * 100);
  const isUp = chg >= 0;
  const cat = drink.cat.replace('-', ' ');
  const catItems = D.filter(d => d.cat === drink.cat);
  const catGainers = catItems.filter(d => d.p > d.b).length;
  const catSentiment = catGainers > catItems.length * 0.6 ? 'surging' : catGainers < catItems.length * 0.4 ? 'retreating' : 'mixed';
  const articles = [];

  articles.push({
    tag: 'Price Action',
    hl: isUp
      ? `${drink.n} climbs ${chg.toFixed(1)}% as buyers take control of the floor`
      : `${drink.n} retreats ${Math.abs(chg).toFixed(1)}% amid growing selling pressure`,
    body: isUp
      ? `Demand accelerating as late-night orders push the price above its opening level. ${cat} category seeing broad interest tonight.`
      : `Rotation underway as guests move toward better-value options. ${cat} facing headwinds across the board.`,
    time: 'Just now'
  });

  articles.push({
    tag: cat,
    hl: `${cat} category ${catSentiment} — ${catGainers} of ${catItems.length} drinks trading above base`,
    time: '1m ago'
  });

  if (drink.timeline && drink.timeline.length >= 3) {
    const recent = drink.timeline.slice(-4);
    const buys = recent.filter(t => t.type === 'buy').length;
    articles.push({
      tag: 'Order Flow',
      hl: buys >= 3
        ? `Strong buy-side momentum on ${drink.n} — ${buys} of last 4 orders were buys`
        : buys <= 1
          ? `Sellers in control on ${drink.n} — distribution phase may be underway`
          : `Mixed tape on ${drink.n} — ${buys} buys vs ${4 - buys} sells in recent activity`,
      time: '2m ago'
    });
  }

  const blurb = CULTURAL_BLURBS[drink.id];
  if (blurb) {
    articles.push({
      tag: 'On the Menu',
      hl: blurb,
      time: 'Tonight'
    });
  }

  return articles;
}

function renderNewsArticles(drink) {
  const feedEl = document.getElementById('sp-story-content');
  if (!feedEl) return;

  const articles = generateArticles(drink);
  feedEl.innerHTML = articles.map((a, i) => `
    <div class="sp-article${i === 0 ? ' sp-article-lead' : ''}">
      <div class="sp-article-top">
        <span class="sp-article-tag">${a.tag}</span>
        <span class="sp-article-time">${a.time}</span>
      </div>
      <div class="sp-article-hl">${a.hl}</div>
      ${i === 0 && a.body ? `<div class="sp-article-body">${a.body}</div>` : ''}
    </div>
  `).join('');
}

/* ════════════════════════════════════════════════════════════════════
   SPOTLIGHT DRAMATIC REVEAL
   ════════════════════════════════════════════════════════════════════ */

function addSpotlightScanline() {
  const hero = document.querySelector('.sp-hero');
  if (!hero) return;
  const scan = document.createElement('div');
  scan.className = 'sp-scanline';
  hero.appendChild(scan);
  setTimeout(() => scan.remove(), 1100);
}

function revealSpotlightDrink() {
  // Gold wash flash
  const wash = document.getElementById('wash');
  if (wash) {
    wash.style.transition = 'none';
    wash.style.background = 'rgba(201,170,82,0.13)';
    wash.style.opacity = '0.7';
    void wash.offsetWidth;
    setTimeout(() => {
      wash.style.transition = 'opacity 1s ease';
      wash.style.opacity = '0';
    }, 120);
  }

  // Animate hero text elements
  const reveals = [
    { id: 'sp-name',   cls: 'sp-reveal-name' },
    { id: 'sp-price',  cls: 'sp-reveal-price' },
    { id: 'sp-banner', cls: 'sp-reveal-banner' },
  ];
  reveals.forEach(({ id, cls }) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  });

  // Price glow pulse
  const priceEl = document.getElementById('sp-price');
  if (priceEl) {
    priceEl.classList.remove('sp-price-flash');
    void priceEl.offsetWidth;
    priceEl.classList.add('sp-price-flash');
  }

  addSpotlightScanline();
}
