/* ════════════════════════════════════════════════════════════════════
   CRASH / SURGE EVENT SEQUENCE
   ════════════════════════════════════════════════════════════════════ */

function startCrash() {
  if (crashActive) return;
  crashActive = true;

  /* Stage 1 — Warning (0–8s) */
  threeMode = 'warning';
  document.getElementById('warnBanner').classList.add('show');
  startCrawl('⚠ Unusual market activity detected — monitoring price volatility across all categories', 'rgba(200,160,0,0.85)');
  document.getElementById('nb-tag').style.color = '#c9aa52';

  // Prices start getting jumpy
  let warnJitter = setInterval(() => {
    D.forEach(d => {
      const drift = -(Math.random() * 0.15 + 0.05);
      d.p = Math.max(d.b * 0.5, d.p + drift);
      d.h.push(d.p);
      if (d.h.length > 12) d.h.shift();
      updateRowDisplay(d);
    });
    renderTicker();
  }, 600);

  setTimeout(() => {
    startCrawl('⚠ CRASH IMMINENT — prices entering freefall across multiple categories', 'rgba(255,100,100,0.9)');
    document.getElementById('warnText').textContent = 'Market instability escalating';
    document.getElementById('warnSub').textContent = '· Price correction imminent across all categories';
  }, 5000);

  /* Stage 2 — Shake (8–13s) */
  setTimeout(() => {
    clearInterval(warnJitter);
    const pill = document.getElementById('pill');
    pill.classList.add('crash');
    document.getElementById('stext').textContent = 'Crash event';
    const wash = document.getElementById('wash');
    wash.style.transition = 'none';
    wash.style.opacity = '0';
    wash.style.background = 'rgba(255,60,60,0.15)';
    void wash.offsetWidth;
    go(wash, { opacity: '0.7' }, 1800);

    // Board shakes
    const ui = document.getElementById('ui');
    [0, 700, 1400].forEach(delay => {
      setTimeout(() => {
        ui.style.animation = 'none';
        void ui.offsetWidth;
        ui.style.animation = 'shake 0.45s ease-in-out';
        // Crash all rows
        D.forEach(d => {
          const row = document.getElementById(`r${d.id}`);
          if (row) {
            row.classList.remove('crash-hit');
            void row.offsetWidth;
            row.classList.add('crash-hit');
          }
        });
      }, delay);
    });

    startCrawl('CRASH — prices collapsing across all categories — buy window opening now', 'rgba(255,82,82,0.95)');
  }, 8000);

  /* Stage 3 — Full crash (13s) */
  setTimeout(() => {
    threeMode = 'crash';
    // Collapse all prices
    D.forEach(d => {
      const prev = d.p;
      d.p = d.b * (0.48 + Math.random() * 0.12);
      d.h.push(d.p);
      if (d.h.length > 12) d.h.shift();
      const pEl = document.getElementById(`p${d.id}`);
      if (pEl) {
        pEl.textContent = '£' + d.p.toFixed(2);
        pEl.className = 'dprice dn';
        pEl.classList.remove('crashing');
        void pEl.offsetWidth;
        pEl.classList.add('crashing');
      }
      updateRowDisplay(d);
      insertTradeRow(d.id, false, prev, 'CRASH');
    });
    renderTicker();
    document.getElementById('warnBanner').classList.remove('show');
    go(document.getElementById('wash'), { opacity: '1' }, 600);
    document.getElementById('ui').classList.add('dim');

    // Event layer
    const layer = document.getElementById('evl');
    layer.style.display = '';
    layer.style.opacity = '';
    layer.style.transition = '';
    layer.classList.add('show');
    ['swt', 'swb'].forEach(id => {
      const el = document.getElementById(id);
      el.style.opacity = '0.9';
      el.style.transition = 'none';
      el.style.transform = 'scaleX(0)';
      setTimeout(() => {
        el.style.transition = 'transform 0.6s cubic-bezier(0.16,1,0.3,1)';
        el.style.transform = 'scaleX(1)';
      }, 100);
    });
    ['btl', 'btr', 'bbl', 'bbr'].forEach((id, i) => {
      const el = document.getElementById(id);
      go(el, { opacity: '1' }, 380, 200 + i * 70);
    });

    const evc = document.getElementById('evc');
    evc.classList.add('show');
    go(evc, { opacity: '1', transform: 'translateY(0) scale(1)' }, 620, 300);
    go(document.getElementById('epre'), { opacity: '1', transform: 'translateY(0)' }, 480, 460);

    setTimeout(() => {
      document.getElementById('ehl').style.transition = 'all 760ms cubic-bezier(0.16,1,0.3,1)';
      document.getElementById('ehl').style.opacity = '1';
      document.getElementById('ehl').style.transform = 'translateY(0)';
    }, 580);

    setTimeout(() => {
      document.getElementById('esub').style.transition = 'all 520ms cubic-bezier(0.16,1,0.3,1)';
      document.getElementById('esub').style.opacity = '1';
      document.getElementById('esub').style.transform = 'translateY(0)';
    }, 760);

    const cdRow = document.getElementById('cd-row');
    if (cdRow) go(cdRow, { opacity: '1' }, 400, 1000);
  }, 13000);

  /* Stage 4 — Buy window (18s) */
  setTimeout(() => {
    threeMode = 'buywindow';
    startCountdown(180);
    document.getElementById('nb-tag').style.color = '#ff5252';
    startCrawl('BUY WINDOW OPEN — all prices at session lows — window closes in 3 minutes', 'rgba(255,82,82,0.9)');
  }, 18000);
}

function startCountdown(secs) {
  clearInterval(cdInt);
  let rem = secs;
  const fill = document.getElementById('cd-fill');
  const num = document.getElementById('cd-num');

  fill.style.transition = 'none';
  fill.style.width = '100%';

  num.textContent = fmt(rem);
  cdInt = setInterval(() => {
    rem--;
    fill.style.transition = 'width 1s linear';
    fill.style.width = (rem / secs * 100) + '%';
    num.textContent = fmt(Math.max(0, rem));
    if (rem <= 0) {
      clearInterval(cdInt);
      setTimeout(endCrash, 1800);
    }
  }, 1000);
}

function endCrash() {
  crashActive = false;
  const ui = document.getElementById('ui');
  ui.classList.remove('dim');
  ui.style.animation = 'none';

  const wash = document.getElementById('wash');
  wash.style.transition = 'opacity 1.2s';
  wash.style.opacity = '0';

  const layer = document.getElementById('evl');
  layer.classList.remove('show');
  layer.style.transition = 'opacity 0.8s';
  layer.style.opacity = '0';

  const pill = document.getElementById('pill');
  pill.classList.remove('crash');
  document.getElementById('stext').textContent = 'Market open';
  document.getElementById('nb-tag').style.color = '#c9aa52';

  threeMode = 'normal';
  resetThree();

  setTimeout(() => {
    layer.style.display = 'none';
    const evc = document.getElementById('evc');
    evc.classList.remove('show');
    ['evc', 'epre', 'ehl', 'esub', 'cd-row'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.style.transition = 'none';
      el.style.opacity = '0';
      if (id === 'evc') el.style.transform = 'translateY(20px) scale(0.95)';
      if (id === 'epre') el.style.transform = 'translateY(-12px)';
      if (id === 'ehl') el.style.transform = 'translateY(26px)';
      if (id === 'esub') el.style.transform = 'translateY(12px)';
    });
    ['btl', 'btr', 'bbl', 'bbr', 'swt', 'swb'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.style.transition = 'none';
      el.style.opacity = '0';
      if (id.startsWith('sw')) el.style.transform = 'scaleX(0)';
    });

    // Reset prices back toward base
    D.forEach(d => {
      d.p = d.b * (0.9 + Math.random() * 0.1);
      d.h.push(d.p);
      if (d.h.length > 12) d.h.shift();
    });

    startCrawl('Market recovering — prices returning to normal · Buy window closed');
    buildBoard();
    renderTicker();
  }, 1000);
}
