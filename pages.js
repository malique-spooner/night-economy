/* ════════════════════════════════════════════════════════════════════
   APP PAGES — mobile menu, manager dashboard, employee controls
   ════════════════════════════════════════════════════════════════════ */

const APP_VIEW_NAMES = {
  site: 'Site',
  tv: 'TV View',
  mobile: 'Mobile Menu',
  portal: 'Portal',
};

const APP_VIEW_ALIASES = {
  manager: 'portal',
  employee: 'portal',
  'mobile-v2': 'mobile',
};

const PAGE_STATE = {
  site: {
    selectedPlan: 'growth',
    activeMoment: 'market',
  },
  mobile: {
    selectedCat: 'cocktails',
  },
  portal: {
    role: 'owner',
    selectedTab: 'overview',
  },
  manager: {
    range: 'session',
    sortKey: 't',
    sortDir: 'desc',
    search: '',
    selectedId: null,
  },
  employee: {
    search: '',
    selectedId: null,
    highlightChanges: true,
    saveState: 'saved',
    toast: '',
    baseline: null,
    selectedCat: 'all',
    dirtyTimer: null,
  },
};

let siteWhyScrollController = null;
let siteLandingScrollController = null;
let siteTestimonialCarouselTimer = null;

const PAGE_STEP = 0.5;
const SAFE_PRICE_MIN = 0.25;

const MOBILE_MENU_SECTIONS = [
  {
    id: 'cocktails',
    label: 'Cocktails',
    note: 'House cocktails and signatures in one simple stream.',
    items: () => [...D]
      .filter(d => d.cat !== 'mocktail')
      .sort((a, b) => b.o - a.o || a.p - b.p)
      .map(d => ({
        name: d.n,
        price: formatMoney(d.p),
        note: getMobileMenuNote(d),
        tone: getMobileMenuTone(d),
        delta: +(((d.p - d.b) / d.b) * 100).toFixed(1),
      })),
  },
  {
    id: 'zeroes',
    label: 'Zeroes',
    note: 'Alcohol-free drinks for easy ordering.',
    items: () => D
      .filter(d => d.cat === 'mocktail')
      .sort((a, b) => a.p - b.p || a.n.localeCompare(b.n))
      .map(d => ({
        name: d.n,
        price: formatMoney(d.p),
        note: 'Zero alcohol',
        tone: 'zero',
        delta: 0,
      })),
  },
  {
    id: 'beers',
    label: 'Beers',
    note: 'Simple bottles and pints for the table.',
    items: () => ([
      { name: 'House Lager', price: '£6.80', note: 'Clean and cold', tone: 'beer', delta: 0.4 },
      { name: 'Pale Ale', price: '£7.20', note: 'Bright and easy', tone: 'beer', delta: -0.3 },
      { name: 'Session IPA', price: '£7.60', note: 'A little more bite', tone: 'beer', delta: 0.8 },
      { name: 'Pilsner', price: '£6.90', note: 'Sharp and simple', tone: 'beer', delta: -0.2 },
    ]),
  },
  {
    id: 'food',
    label: 'Food',
    note: 'Small plates that keep the order moving.',
    items: () => ([
      { name: 'Salted Chips', price: '£5.50', note: 'Crackly and hot', tone: 'food', delta: 0.2 },
      { name: 'Olives', price: '£4.80', note: 'Quick table starter', tone: 'food', delta: 0.0 },
      { name: 'Loaded Fries', price: '£8.90', note: 'Best with a round', tone: 'food', delta: -0.4 },
      { name: 'Croquettes', price: '£7.80', note: 'Small, rich, shareable', tone: 'food', delta: 0.1 },
    ]),
  },
];

function getAppView() {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('view');
  const resolved = APP_VIEW_ALIASES[requested] || requested;
  return APP_VIEW_NAMES[resolved] ? resolved : 'site';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[ch]);
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function formatMoney(value) {
  return `£${Number(value || 0).toFixed(2)}`;
}

function formatShortTime(ts) {
  return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatShortDate(ts) {
  return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function initWhyScrollStory() {
  const section = document.getElementById('site-why');
  if (!section) return;

  siteWhyScrollController?.disconnect?.();

  const cards = [...section.querySelectorAll('.site-why-card')];
  const visual = section.querySelector('.site-why-visual');
  const stageTitle = section.querySelector('[data-why-stage-title]');
  const stageSub = section.querySelector('[data-why-stage-sub]');
  if (!cards.length) return;

  let rafId = 0;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      entry.target.toggleAttribute('data-inview', entry.isIntersecting);
    });
  }, {
    threshold: [0, 0.15, 0.35, 0.55, 0.75, 1],
    rootMargin: '0px 0px -10% 0px',
  });

  observer.observe(section);
  cards.forEach(card => observer.observe(card));

  function update() {
    rafId = 0;
    const rect = section.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const progress = clamp01((viewportHeight * 0.72 - rect.top) / (rect.height + viewportHeight * 0.36));

    section.style.setProperty('--why-progress', progress.toFixed(4));
    section.dataset.progress = progress.toFixed(4);
    section.dataset.inview = rect.bottom > 0 && rect.top < viewportHeight ? 'true' : 'false';

    cards.forEach((card, index) => {
      const localProgress = clamp01(progress * cards.length - index);
      card.style.setProperty('--card-progress', localProgress.toFixed(4));
      card.dataset.active = localProgress >= 0.42 ? 'true' : 'false';
    });

    if (visual) {
      const wrap = visual.parentElement;
      const wrapRect = wrap?.getBoundingClientRect();
      const pinTop = 96;
      const visualHeight = visual.offsetHeight || 0;
      if (!wrap || !wrapRect || window.innerWidth <= 900) {
        visual.removeAttribute('style');
      } else if (wrapRect.top > pinTop) {
        visual.style.position = 'relative';
        visual.style.top = '';
        visual.style.left = '';
        visual.style.width = '';
        visual.style.marginTop = '';
      } else if (wrapRect.bottom <= pinTop + visualHeight) {
        visual.style.position = 'absolute';
        visual.style.top = `${Math.max(0, wrap.offsetHeight - visualHeight)}px`;
        visual.style.left = '0';
        visual.style.width = '100%';
        visual.style.marginTop = '0';
      } else {
        visual.style.position = 'fixed';
        visual.style.top = `${pinTop}px`;
        visual.style.left = `${wrapRect.left}px`;
        visual.style.width = `${wrapRect.width}px`;
        visual.style.marginTop = '0';
      }
    }

    const activeIndex = Math.min(cards.length - 1, Math.max(0, Math.floor(progress * cards.length)));
    if (visual) visual.dataset.scene = String(activeIndex + 1);
    if (stageTitle && cards[activeIndex]) stageTitle.textContent = cards[activeIndex].querySelector('strong')?.textContent || '';
    if (stageSub && cards[activeIndex]) stageSub.textContent = cards[activeIndex].querySelector('p')?.textContent || '';
  }

  function onScroll() {
    if (rafId) return;
    rafId = requestAnimationFrame(update);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  siteWhyScrollController = {
    disconnect() {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      observer.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
    },
  };
}

function initSiteLandingMotion() {
  siteLandingScrollController?.disconnect?.();
  if (siteTestimonialCarouselTimer) {
    clearInterval(siteTestimonialCarouselTimer);
    siteTestimonialCarouselTimer = null;
  }

  const counters = [...document.querySelectorAll('[data-count-to]')];
  const draggables = [...document.querySelectorAll('[data-drag-scroll]')];
  const autoCarousel = document.querySelector('[data-auto-carousel]');
  const cleanups = [];

  if (counters.length) {
    const counterObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting || entry.target.dataset.counted === 'true') return;
        entry.target.dataset.counted = 'true';
        const target = Number(entry.target.dataset.countTo || 0);
        const suffix = entry.target.dataset.countSuffix || '';
        const prefix = entry.target.dataset.countPrefix || '';
        const duration = 1250;
        const started = performance.now();

        function tick(now) {
          const progress = clamp01((now - started) / duration);
          const eased = 1 - Math.pow(1 - progress, 3);
          const value = Math.round(target * eased);
          entry.target.textContent = `${prefix}${value.toLocaleString('en-GB')}${suffix}`;
          if (progress < 1) requestAnimationFrame(tick);
        }

        requestAnimationFrame(tick);
      });
    }, { threshold: 0.35 });

    counters.forEach(counter => counterObserver.observe(counter));
    cleanups.push(() => counterObserver.disconnect());
  }

  draggables.forEach(track => {
    let isDown = false;
    let startX = 0;
    let startScroll = 0;

    const onPointerDown = event => {
      isDown = true;
      startX = event.clientX;
      startScroll = track.scrollLeft;
      track.classList.add('is-dragging');
      track.setPointerCapture?.(event.pointerId);
    };
    const onPointerMove = event => {
      if (!isDown) return;
      track.scrollLeft = startScroll - (event.clientX - startX);
    };
    const stopDragging = () => {
      isDown = false;
      track.classList.remove('is-dragging');
    };

    track.addEventListener('pointerdown', onPointerDown);
    track.addEventListener('pointermove', onPointerMove);
    track.addEventListener('pointerup', stopDragging);
    track.addEventListener('pointercancel', stopDragging);
    track.addEventListener('mouseleave', stopDragging);
    cleanups.push(() => {
      track.removeEventListener('pointerdown', onPointerDown);
      track.removeEventListener('pointermove', onPointerMove);
      track.removeEventListener('pointerup', stopDragging);
      track.removeEventListener('pointercancel', stopDragging);
      track.removeEventListener('mouseleave', stopDragging);
    });
  });

  if (autoCarousel) {
    let paused = false;
    const pause = () => { paused = true; };
    const resume = () => { paused = false; };
    autoCarousel.addEventListener('focusin', pause);
    autoCarousel.addEventListener('focusout', resume);
    siteTestimonialCarouselTimer = setInterval(() => {
      if (paused || autoCarousel.matches('.is-dragging')) return;
      const maxScroll = autoCarousel.scrollWidth - autoCarousel.clientWidth;
      if (maxScroll <= 0) return;
      const next = autoCarousel.scrollLeft + Math.min(392, autoCarousel.clientWidth * 0.72);
      autoCarousel.scrollLeft = next >= maxScroll - 8 ? 0 : next;
    }, 3600);
    cleanups.push(() => {
      autoCarousel.removeEventListener('focusin', pause);
      autoCarousel.removeEventListener('focusout', resume);
      if (siteTestimonialCarouselTimer) {
        clearInterval(siteTestimonialCarouselTimer);
        siteTestimonialCarouselTimer = null;
      }
    });
  }

  siteLandingScrollController = {
    disconnect() {
      cleanups.forEach(cleanup => cleanup());
    },
  };
}

function groupBy(items, keyFn) {
  return items.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

function cloneSettings(settings = MARKET_SETTINGS) {
  return JSON.parse(JSON.stringify(settings));
}

function getBaseline() {
  if (!PAGE_STATE.employee.baseline) {
    PAGE_STATE.employee.baseline = cloneSettings();
  }
  return PAGE_STATE.employee.baseline;
}

const PORTAL_PROFILE_KEY = 'night-economy-portal-profile';

function loadPortalProfile() {
  const defaults = {
    subscribed: false,
    plan: 'growth',
    venueName: 'Pickle House',
    ownerName: 'Venue Owner',
    email: 'owner@night-economy.app',
    seats: 6,
    billing: 'Monthly',
  };
  try {
    const raw = localStorage.getItem(PORTAL_PROFILE_KEY);
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  } catch (err) {
    return defaults;
  }
}

function savePortalProfile(profile) {
  try {
    localStorage.setItem(PORTAL_PROFILE_KEY, JSON.stringify(profile));
  } catch (err) {
    // Ignore storage failures.
  }
}

function getMobileMenuTone(drink) {
  if (!drink) return 'muted';
  if (drink.p <= drink.b) return 'value';
  if (drink.o > 2) return 'fast';
  if (drink.cat === 'signature') return 'house';
  if (drink.cat === 'mocktail') return 'zero';
  return 'classic';
}

function getMobileMenuNote(drink) {
  if (!drink) return '';
  if (drink.cat === 'signature') return 'House signature';
  if (drink.cat === 'spritz') return 'Bright and easy';
  if (drink.cat === 'espresso') return 'Coffee-led classic';
  if (drink.cat === 'old-fashioned') return 'A darker pour';
  if (drink.cat === 'negroni') return 'Bitter and clean';
  if (drink.cat === 'margarita') return 'Fast crowd-pleaser';
  if (drink.cat === 'bloody-mary') return 'Bold and savoury';
  if (drink.cat === 'mocktail') return 'Zero alcohol';
  return 'Bar staple';
}

function injectPageShell() {
  if (document.getElementById('pageShell')) return;

  const shell = document.createElement('div');
  shell.id = 'pageShell';
  shell.className = 'page-shell';
  shell.innerHTML = `
    <nav class="page-switcher" aria-label="Page switcher">
      <a class="page-chip" href="?view=site" data-view="site">Site</a>
      <a class="page-chip" href="?view=tv" data-view="tv">TV</a>
      <a class="page-chip" href="?view=mobile" data-view="mobile">Mobile</a>
      <a class="page-chip" href="?view=portal" data-view="portal">Portal</a>
    </nav>

    <div id="pageToast" class="page-toast" aria-live="polite"></div>

    <section id="siteView" class="alt-view site-view">
      <div class="site-shell">
        <section id="site-hero" class="site-hero">
          <div class="site-hero-inner">
            <div class="site-kicker">Night Economy</div>
            <h1>Turn your menu into a live market.</h1>
            <p>Night Economy brings live pricing, momentum, and market moments to the room, giving guests a reason to look up, order faster, and come back for what happens next.</p>
            <div class="site-hero-stats" aria-label="Live market stats">
              <span>Live index +12.4%</span>
              <span>Volume 1,840 orders</span>
              <span>Volatility controlled</span>
            </div>
            <div class="site-hero-foot">Built for bars, hotels, members clubs, and hospitality groups</div>
          </div>
        </section>

        <section id="site-why" class="site-section site-why">
          <div class="site-why-shell">
            <div class="site-section-split site-why-grid">
              <div class="site-why-copy">
                <div class="site-kicker">Why it wins</div>
                <h2>Software the room can feel.</h2>
                <p>Night Economy works because it feels immediate, not technical. Guests read the movement at a glance, staff know where to steer attention, and operators keep control without turning service into a system demo.</p>
                <div class="site-why-panel" aria-label="Why Night Economy works">
                  <article class="site-why-card site-why-card-primary">
                    <span>01</span>
                    <strong>Instantly legible</strong>
                    <p>Big type, clear movement, and one live signal make the room easy to understand from across the bar.</p>
                  </article>
                  <article class="site-why-card">
                    <span>02</span>
                    <strong>Calm under pressure</strong>
                    <p>The experience feels editorial and premium, so the room gets energy without noise or friction.</p>
                  </article>
                  <article class="site-why-card">
                    <span>03</span>
                    <strong>Guides demand, not just price</strong>
                    <p>Operators can shape what people notice next, which is the real lever behind higher-quality orders.</p>
                  </article>
                </div>
              </div>
              <div class="site-why-visual-wrap">
                <div class="site-why-visual" data-scene="1" aria-hidden="true">
                  <div class="site-display-mock">
                    <div class="site-display-top">
                      <span>Market open</span>
                      <strong>22:48</strong>
                    </div>
                    <div class="site-display-hero">
                      <span data-why-stage-title>Instantly legible</span>
                      <strong>£9.80</strong>
                    </div>
                    <div class="site-display-rows">
                      <i></i><i></i><i></i><i></i>
                    </div>
                    <div class="site-display-note" data-why-stage-sub>Big type, clear movement, and one live signal make the room easy to understand from across the bar.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="site-what" class="site-section">
          <div class="site-section-intro">
            <div class="site-kicker">The payoff</div>
            <h2>Three numbers the room can feel.</h2>
          </div>
          <div class="site-metric-grid">
            <article class="site-metric-card tone-room">
              <span data-count-to="3">0</span>
              <strong>Connected product surfaces</strong>
              <p>Room display, guest mobile, and operator portal all work together as one system.</p>
            </article>
            <article class="site-metric-card tone-guest">
              <span data-count-to="1840" data-count-suffix="+">0</span>
              <strong>Shared live market model</strong>
              <p>Orders can flow through a single live state, so every screen feels consistent at every touchpoint.</p>
            </article>
            <article class="site-metric-card tone-ops">
              <span data-count-to="12" data-count-prefix="+" data-count-suffix="%">0</span>
              <strong>Moments that keep attention alive</strong>
              <p>Movement, spotlight moments, and crash events give guests fresh reasons to look up and re-engage.</p>
            </article>
          </div>
        </section>

        <section id="site-decks" class="site-section site-decks">
          <div class="site-section-intro">
            <div class="site-kicker">Product flow</div>
            <h2>Drag through the venue stack.</h2>
            <p>Each surface has a job: make the room readable, keep the guest menu alive, and give operators calm control behind the bar.</p>
          </div>
          <div class="site-deck-track" data-drag-scroll aria-label="Venue stack carousel">
            <article class="site-deck-slide tone-display">
              <span>(01) Room display</span>
              <strong>Live pricing the whole room can read.</strong>
              <div class="site-deck-screen site-deck-preview">
                <iframe src="./?view=tv" title="Night Economy TV view preview" loading="lazy"></iframe>
              </div>
            </article>
            <article class="site-deck-slide tone-mobile">
              <span>(02) Guest mobile</span>
              <strong>A menu that mirrors the moment.</strong>
              <div class="site-deck-screen site-deck-preview phone">
                <iframe src="./?view=mobile" title="Night Economy mobile view preview" loading="lazy"></iframe>
              </div>
            </article>
            <article class="site-deck-slide tone-portal">
              <span>(03) Operator portal</span>
              <strong>Control demand without slowing service.</strong>
              <div class="site-deck-screen site-deck-preview">
                <iframe src="./?view=portal" title="Night Economy portal preview" loading="lazy"></iframe>
              </div>
            </article>
            <article class="site-deck-slide tone-event">
              <span>(04) Crash moment</span>
              <strong>High-attention events that create ritual.</strong>
              <div class="site-deck-screen site-deck-preview">
                <iframe src="./?view=tv&mode=crash" title="Night Economy crash preview" loading="lazy"></iframe>
              </div>
            </article>
          </div>
        </section>

        <section id="site-testimonials" class="site-section site-testimonials">
          <div class="site-section-intro">
            <div class="site-kicker">What people say</div>
            <h2>The value is obvious fast.</h2>
          </div>
          <div class="site-testimonial-marquee" aria-label="Testimonial carousel">
            <div class="site-testimonial-track">
              ${[0, 1].map(() => `
                <article class="site-testimonial-card tone-cream">
                  <p>It stops feeling like a menu and starts feeling like a live part of the venue. Guests begin talking about what is moving before the team even prompts them.</p>
                  <span>Venue founder, premium cocktail concept</span>
                </article>
                <article class="site-testimonial-card tone-white">
                  <p>The crash mechanic is what guests remember, but the control layer is what makes the product operationally usable.</p>
                  <span>Operator, launch partner</span>
                </article>
                <article class="site-testimonial-card tone-green">
                  <p>Spotlight and live value give us a natural way to guide demand without making the room feel scripted.</p>
                  <span>Bar manager, hotel group</span>
                </article>
                <article class="site-testimonial-card tone-dark">
                  <p>It gives the room its own ritual. Guests begin following the market instead of just reading a list and moving on.</p>
                  <span>Creative director, launch venue</span>
                </article>
                <article class="site-testimonial-card tone-cream">
                  <p>The best part is how quickly the team understood it. The screen gives them a shared language for the floor.</p>
                  <span>General manager, late-night venue</span>
                </article>
                <article class="site-testimonial-card tone-white">
                  <p>It makes premium ordering feel playful without cheapening the venue. That balance is hard to get right.</p>
                  <span>Hospitality consultant</span>
                </article>
                <article class="site-testimonial-card tone-green">
                  <p>Guests kept checking the board between rounds. It created a rhythm we normally have to manufacture with staff prompts.</p>
                  <span>Events lead, members club</span>
                </article>
              `).join('')}
            </div>
          </div>
        </section>

        <section id="site-subscribe" class="site-section site-subscribe">
          <div class="site-subscribe-copy">
            <div class="site-kicker">Get started</div>
            <h2>Start your first venue.</h2>
            <p>Choose the right plan, create the venue, and open your operator portal. From there, your live market is ready to configure and run.</p>
          </div>
          <div class="site-signup-panel">
            <div class="site-pricing-minimal" id="sitePricing"></div>
            <form class="site-signup-form" id="siteSignupForm">
              <label>
                <span>Venue name</span>
                <input id="siteVenueName" type="text" placeholder="Pickle House Shoreditch">
              </label>
              <label>
                <span>Owner name</span>
                <input id="siteOwnerName" type="text" placeholder="Alex Morgan">
              </label>
              <label>
                <span>Email</span>
                <input id="siteOwnerEmail" type="email" placeholder="owner@venue.com">
              </label>
              <label>
                <span>Plan</span>
                <select id="sitePlanSelect">
                  <option value="starter">Starter</option>
                  <option value="growth">Growth</option>
                  <option value="premium">Premium</option>
                </select>
              </label>
              <button class="site-primary" type="submit">Buy Now</button>
            </form>
          </div>
        </section>

        <footer class="site-footer">
          <div class="site-footer-brand">
            <div class="site-kicker">Night Economy</div>
            <h2>Build the venue people watch.</h2>
          </div>
          <div class="site-footer-cols">
            <div>
              <span>Product</span>
              <a href="#site-why">Why it works</a>
              <a href="#site-decks">Product moments</a>
              <a href="#site-subscribe">Operator portal</a>
            </div>
            <div>
              <span>Surfaces</span>
              <a href="#site-why">Room display</a>
              <a href="#site-why">Guest mobile</a>
              <a href="#site-why">Control center</a>
            </div>
            <div>
              <span>Company</span>
              <a href="mailto:hello@nighteconomy.app">hello@nighteconomy.app</a>
              <a href="#site-why">Founders</a>
              <a href="#site-hero">Back to top</a>
            </div>
          </div>
        </footer>
      </div>
    </section>

    <section id="mobileView" class="alt-view mobile-view">
      <div class="mobile-shell">
        <section class="mobile-hero">
          <div class="brand mobile-hero-title">Night Economy</div>
        </section>
        <nav class="mobile-rail" id="mobileMenuRail" aria-label="Menu categories"></nav>
        <main class="mobile-menu" id="mobileMenuSections"></main>
      </div>
    </section>

    <section id="portalView" class="alt-view portal-view">
      <div class="portal-shell">
        <div class="portal-layout">
          <aside class="portal-sidebar">
            <div class="portal-sidebar-brand">
              <div class="portal-sidebar-kicker">Night Economy</div>
              <strong>Operator Portal</strong>
            </div>
            <div class="portal-plan-card" id="portalPlanCard"></div>
            <div class="portal-role-switch" id="portalRoleSwitch"></div>
            <div class="portal-tabs portal-sidebar-tabs" id="portalTabs"></div>
            <div class="portal-launch-actions portal-sidebar-actions">
              <button class="manager-action" id="portalOpenMarket">Open Market</button>
              <button class="manager-action" id="portalCrashDrill">Crash Drill</button>
              <button class="manager-action" id="portalResetVenue">Reset Venue</button>
            </div>
            <div class="portal-sidebar-meta" id="portalSidebarMeta"></div>
          </aside>

          <main class="portal-main">
            <section class="portal-header">
              <div>
                <div class="portal-header-kicker">Venue command center</div>
                <h1>Run the floor, the pricing, and the launch.</h1>
                <p id="portalHeaderSub" class="portal-header-sub">A single workspace for live operations, pricing decisions, and venue setup.</p>
              </div>
              <div class="portal-inline-actions">
                <input id="portalDrinkSearch" class="manager-search portal-search" type="search" placeholder="Search drinks">
                <div class="save-pill" id="portalSaveState">Saved</div>
              </div>
            </section>
            <div id="portalWorkspace" class="portal-workspace"></div>
          </main>
        </div>
      </div>
    </section>

  `;

  document.body.appendChild(shell);
}

function setActiveAppView(view) {
  document.body.dataset.appView = view;
  document.documentElement.style.overflow = view === 'site' ? 'auto' : 'hidden';
  document.documentElement.style.height = view === 'site' ? 'auto' : '100%';
  document.body.style.overflow = view === 'site' ? 'auto' : 'hidden';
  document.body.style.height = view === 'site' ? 'auto' : '100%';
  document.body.style.minHeight = view === 'site' ? '100vh' : '100%';
  document.querySelectorAll('.page-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.view === view);
  });

  const tvRoot = document.querySelector('.root');
  if (tvRoot) tvRoot.style.display = view === 'tv' ? '' : 'none';

  document.querySelectorAll('.alt-view').forEach(panel => {
    panel.classList.toggle('active', panel.id === `${view}View`);
  });

  if (view === 'site') {
    const sitePanel = document.getElementById('siteView');
    if (sitePanel) {
      sitePanel.scrollTop = 0;
      requestAnimationFrame(() => {
        sitePanel.scrollTop = 0;
      });
    }
    window.scrollTo?.(0, 0);
  }

  document.title = `Night Economy — ${APP_VIEW_NAMES[view] || 'TV View'}`;
}

function showToast(message, tone = '') {
  const el = document.getElementById('pageToast');
  if (!el) return;
  el.textContent = message;
  el.className = `page-toast show ${tone}`.trim();
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    el.className = 'page-toast';
  }, 1700);
}

function renderStatPill(container, label, value, tone = '') {
  const pill = document.createElement('div');
  pill.className = `stat-pill ${tone}`.trim();
  pill.innerHTML = `<span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong>`;
  container.appendChild(pill);
}

function sparkline(values, color = '#3dd68c', width = 120, height = 34) {
  const safe = (values && values.length ? values : [0]).map(value => Number(value) || 0);
  const min = Math.min(...safe);
  const max = Math.max(...safe);
  const range = max - min || 1;
  const bars = safe.map(value => {
    const pct = Math.max(12, ((value - min) / range) * 100);
    return `<span style="height:${pct}%"></span>`;
  }).join('');
  return `<div class="micro-bars ${height > 40 ? 'tall' : ''}" style="width:${width}px;height:${height}px;--bars-color:${color}">${bars}</div>`;
}

function getSalesRange(range) {
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  if (range === 'last-hour') return SALES_LOG.filter(row => row.t >= now - 60 * 60 * 1000);
  if (range === 'today') return SALES_LOG.filter(row => row.t >= todayStart.getTime());
  if (range === 'all') return [...SALES_LOG];
  return SALES_LOG.filter(row => row.t >= SESSION_STARTED_AT);
}

function getManagerRecords() {
  const search = PAGE_STATE.manager.search.trim().toLowerCase();
  const base = getSalesRange(PAGE_STATE.manager.range).filter(row => {
    if (!search) return true;
    const haystack = `${row.n} ${row.cat} ${row.type} ${row.price}`.toLowerCase();
    return haystack.includes(search);
  });
  const sortKey = PAGE_STATE.manager.sortKey;
  const dir = PAGE_STATE.manager.sortDir === 'asc' ? 1 : -1;
  return base.sort((a, b) => {
    let result = 0;
    if (sortKey === 't') result = a.t - b.t;
    if (sortKey === 'n') result = a.n.localeCompare(b.n);
    if (sortKey === 'cat') result = a.cat.localeCompare(b.cat);
    if (sortKey === 'price') result = a.price - b.price;
    return result * dir;
  });
}

function getTopCategory(rows = SALES_LOG) {
  const grouped = groupBy(rows, row => row.cat);
  const ranked = Object.entries(grouped).map(([cat, items]) => ({
    cat,
    orders: items.length,
    revenue: items.reduce((sum, item) => sum + item.price, 0),
  })).sort((a, b) => b.orders - a.orders || b.revenue - a.revenue);
  return ranked[0] || null;
}

function getCategoryCardsData() {
  return Object.entries(groupBy(D, d => d.cat)).map(([cat, items]) => {
    const totalOrders = items.reduce((sum, item) => sum + item.o, 0);
    const avgPrice = items.reduce((sum, item) => sum + item.p, 0) / items.length;
    const orderSeries = items.map(item => item.o);
    const changeSeries = items.map(item => ((item.p - item.b) / item.b) * 100);
    return { cat, items, totalOrders, avgPrice, orderSeries, changeSeries };
  }).sort((a, b) => b.totalOrders - a.totalOrders);
}

function getAttentionItems() {
  const items = [];
  const categoryRows = getCategoryCardsData();
  categoryRows.filter(row => {
    const soldOutCount = row.items.filter(d => d.soldOut).length;
    return soldOutCount >= Math.max(1, Math.ceil(row.items.length * 0.6));
  }).slice(0, 2).forEach(row => {
    const soldOutCount = row.items.filter(d => d.soldOut).length;
    items.push({
      tone: 'warn',
      title: `${row.cat.replace('-', ' ')} running low`,
      body: `${soldOutCount} of ${row.items.length} drinks are sold out or paused.`,
    });
  });

  D.filter(d => d.p >= d.ceiling * 0.98).slice(0, 2).forEach(d => {
    items.push({
      tone: 'alert',
      title: `${escapeHtml(d.n)} near ceiling`,
      body: `${formatMoney(d.p)} is pushing against the ceiling of ${formatMoney(d.ceiling)}.`,
    });
  });

  D.filter(d => d.o <= 1).slice(0, 2).forEach(d => {
    items.push({
      tone: 'muted',
      title: `${escapeHtml(d.n)} needs more trade`,
      body: `Only ${d.o} orders tonight. Consider nudging visibility or pricing.`,
    });
  });

  return items.slice(0, 6);
}

function rerenderOperatorView() {
  const view = getAppView();
  if (view === 'portal') {
    renderPortalView();
    return;
  }
  renderEmployeeView();
}

function buildProgressMeter(value, max, tone = 'green') {
  const pct = max > 0 ? Math.max(8, Math.min(100, (value / max) * 100)) : 8;
  return `
    <div class="meter meter-${tone}">
      <div class="meter-fill" style="width:${pct}%"></div>
    </div>
  `;
}

function getPortalTimeBuckets(records) {
  const labels = ['18:00', '19:00', '20:00', '21:00', '22:00', '23:00', '00:00'];
  const buckets = labels.map(label => ({ label, orders: 0, revenue: 0 }));
  records.forEach(row => {
    const hour = new Date(row.t).getHours();
    let index = hour - 18;
    if (hour === 0) index = 6;
    if (index < 0 || index > 6) return;
    buckets[index].orders += 1;
    buckets[index].revenue += row.price;
  });
  return buckets;
}

function getPortalHealthSnapshot(records) {
  const active = D.filter(d => !d.soldOut).length;
  const soldOut = D.filter(d => d.soldOut).length;
  const nearCeiling = D.filter(d => d.p >= d.ceiling * 0.98).length;
  const averageDelta = D.length
    ? D.reduce((sum, drink) => sum + (((drink.p - drink.b) / drink.b) * 100), 0) / D.length
    : 0;
  const revenue = records.reduce((sum, row) => sum + row.price, 0);
  return {
    active,
    soldOut,
    nearCeiling,
    averageDelta,
    revenue,
  };
}

function getPortalTopMovers() {
  return [...D]
    .sort((a, b) => Math.abs((b.p - b.b) / b.b) - Math.abs((a.p - a.b) / a.b))
    .slice(0, 5);
}

function getDrinkBaseline(drinkId) {
  const baseline = getBaseline().drinks[drinkId];
  return baseline || null;
}

function hasDrinkChanged(drink) {
  const baseline = getDrinkBaseline(drink.id);
  if (!baseline) return false;
  return ['name', 'cat', 'salePrice', 'floor', 'ceiling', 'soldOut'].some(key => {
    const current = key === 'name' ? drink.n
      : key === 'cat' ? drink.cat
      : key === 'salePrice' ? drink.b
      : drink[key];
    const previous = baseline[key];
    return String(current) !== String(previous);
  });
}

function queueSaveState(state, message = '') {
  PAGE_STATE.employee.saveState = state;
  PAGE_STATE.employee.toast = message;
  const pill = document.getElementById('employeeSaveState');
  if (pill) {
    pill.textContent = state === 'saved' ? 'Saved' : state === 'saving' ? 'Saving…' : 'Unsaved';
    pill.className = `save-pill ${state}`;
  }
  if (message) showToast(message, state === 'saved' ? 'success' : 'info');
}

function commitEmployeeEdit(drinkId, patch, label = 'Updated drink') {
  setDrinkMarketConfig(drinkId, patch, { recordHistory: true });
  queueSaveState('saved', label);
  rerenderOperatorView();
}

function commitCategoryEdit(cat, mutator, label = 'Updated category') {
  applyMarketTransaction(label, mutator);
  queueSaveState('saved', label);
  rerenderOperatorView();
}

function normalizeDrinkPatch(drink, patch) {
  const next = { ...patch };
  if (Object.prototype.hasOwnProperty.call(next, 'name')) {
    next.name = String(next.name || '').trim() || drink.n;
  }
  if (Object.prototype.hasOwnProperty.call(next, 'salePrice')) {
    const salePrice = Number(next.salePrice);
    next.salePrice = Number.isFinite(salePrice) ? Math.max(SAFE_PRICE_MIN, salePrice) : drink.b;
  }
  if (Object.prototype.hasOwnProperty.call(next, 'floor')) {
    const floor = Number(next.floor);
    next.floor = Number.isFinite(floor) ? Math.max(SAFE_PRICE_MIN, floor) : drink.floor;
  }
  if (Object.prototype.hasOwnProperty.call(next, 'ceiling')) {
    const ceiling = Number(next.ceiling);
    next.ceiling = Number.isFinite(ceiling) ? Math.max(SAFE_PRICE_MIN, ceiling) : drink.ceiling;
  }
  if (Object.prototype.hasOwnProperty.call(next, 'cat')) {
    next.cat = next.cat || drink.cat;
  }

  const sale = Object.prototype.hasOwnProperty.call(next, 'salePrice') ? next.salePrice : drink.b;
  let floor = Object.prototype.hasOwnProperty.call(next, 'floor') ? next.floor : drink.floor;
  let ceiling = Object.prototype.hasOwnProperty.call(next, 'ceiling') ? next.ceiling : drink.ceiling;

  if (floor >= ceiling) {
    const middle = (floor + ceiling) / 2 || sale;
    floor = Math.max(SAFE_PRICE_MIN, +(middle - 0.25).toFixed(2));
    ceiling = Math.max(floor + 0.25, +(middle + 0.25).toFixed(2));
  }

  next.floor = +floor.toFixed(2);
  next.ceiling = +ceiling.toFixed(2);
  if (next.salePrice !== undefined) next.salePrice = +next.salePrice.toFixed(2);
  return next;
}

function getVisibleEmployeeDrinks() {
  const search = PAGE_STATE.employee.search.trim().toLowerCase();
  const catFilter = PAGE_STATE.employee.selectedCat;
  return D.filter(d => {
    const matchesSearch = !search || `${d.n} ${d.cat}`.toLowerCase().includes(search);
    const matchesCat = catFilter === 'all' || d.cat === catFilter;
    return matchesSearch && matchesCat;
  });
}

function renderBoardInto(viewIdx, config = {}) {
  if (viewIdx !== undefined) currentBoardView = viewIdx;
  const view = BOARD_VIEWS[currentBoardView];
  const inner = document.getElementById(config.innerId || 'boardInner');
  const featured = document.getElementById(config.featuredId || 'boardFeatured');
  const labelEl = document.getElementById(config.labelId || 'boardViewLabel');
  const updatedEl = document.getElementById(config.updatedId || 'lupdt');
  const dots = config.dotSelector ? document.querySelectorAll(config.dotSelector) : document.querySelectorAll('.bdot');

  if (!inner) return;

  if (labelEl) labelEl.textContent = view.label;
  if (updatedEl) {
    const now = new Date();
    updatedEl.textContent = `Updated ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  }

  dots.forEach((dot, idx) => {
    if (idx === currentBoardView) dot.classList.add('active');
    else dot.classList.remove('active');
  });

  inner.style.transition = 'opacity 0.35s';
  inner.style.opacity = '0';
  if (featured) featured.style.opacity = '0';

  setTimeout(() => {
    inner.innerHTML = '';
    const drinks = D.filter(d => view.ids.includes(d.id));
    const featuredDrinks = [...drinks]
      .filter(d => !d.soldOut)
      .sort((a, b) => b.o - a.o || Math.abs((b.p - b.b) / b.b) - Math.abs((a.p - a.b) / a.b))
      .slice(0, 3);
    const cats = [...new Set(drinks.map(d => d.cat))];

    if (featured) {
      featured.innerHTML = featuredDrinks.map((d, idx) => {
        const pct = ((d.p - d.b) / d.b * 100);
        const up = d.p >= d.b;
        return `
          <article class="feature-tile ${d.soldOut ? 'sold-out' : ''}">
            <div class="feature-tile-top">
              <span class="feature-rank">0${idx + 1}</span>
              <span class="feature-cat">${d.cat.replace('-', ' ')}</span>
            </div>
            <strong class="feature-name">${d.n}</strong>
            <div class="feature-bottom">
              <div class="feature-price ${up ? 'up' : 'dn'}">£${d.p.toFixed(2)}</div>
              <div class="feature-change ${up ? 'up' : 'dn'}">${up ? '+' : ''}${pct.toFixed(1)}%</div>
            </div>
            ${buildPricePositionMarkup(d)}
          </article>
        `;
      }).join('');
      featured.style.opacity = '1';
    }

    cats.forEach(cat => {
      const items = drinks.filter(d => d.cat === cat);
      if (!items.length) return;
      const sec = document.createElement('div');
      sec.className = 'cat-section';

      const catChg = (items.reduce((s, d) => s + ((d.p - d.b) / d.b * 100), 0) / items.length).toFixed(1);
      const hdr = document.createElement('div');
      hdr.className = 'cat-header';
      hdr.innerHTML = `<span class="cat-name ${cat}">◆ ${cat.replace('-', ' ')}</span><span class="cat-meta">${catChg > 0 ? '+' : ''}${catChg}%</span>`;
      sec.appendChild(hdr);

      items.forEach(d => {
        const row = document.createElement('div');
        row.className = `drow ${d.o > 0 ? 'fresh' : 'decaying'} ${d.soldOut ? 'sold-out' : ''}`;
        row.id = `mobile-r${d.id}`;
        const pct = ((d.p - d.b) / d.b * 100).toFixed(1);
        const up = d.p >= d.b;
        const soldBadge = d.soldOut ? '<span class="val-badge">SOLD OUT</span>' : '';
        row.innerHTML = `
          <div><div class="dname">${d.n}${soldBadge}</div><div class="dcat-sub">${d.cat.replace('-',' ')}</div></div>
          <div class="dprice ${up?'up':'dn'}" id="mobile-p${d.id}">£${d.p.toFixed(2)}</div>
          <div class="spark-cell" id="mobile-sp${d.id}">${buildPricePositionMarkup(d)}</div>
          <div class="dpct ${up?'up':'dn'}" id="mobile-pct${d.id}">${up?'+':''}${pct}%</div>
          <div class="decay-wrap"><div class="decay-bar"><div class="decay-fill" style="width:${Math.min(100, d.o * 8.33)}%"></div></div><div class="darr ${up?'up':'dn'}" id="mobile-arr${d.id}">${up?'▲':'▼'}</div></div>
        `;
        sec.appendChild(row);
      });
      inner.appendChild(sec);
    });

    hydrateLineCharts(inner);
    inner.style.opacity = '1';
  }, 350);
}

function renderMobileMenuCards(items) {
  return items.map(item => `
    <article class="mobile-menu-card ${item.delta >= 0 ? 'up' : 'dn'}">
      <div class="mobile-menu-card-top">
        <strong>${escapeHtml(item.name)}</strong>
        <span>${escapeHtml(item.price)}</span>
      </div>
      <div class="mobile-menu-card-trend ${item.delta >= 0 ? 'up' : 'dn'}">${item.delta >= 0 ? '▲' : '▼'} ${Math.abs(item.delta).toFixed(1)}%</div>
      <div class="mobile-menu-card-note">${escapeHtml(item.note)}</div>
    </article>
  `).join('');
}

function getActiveScrollablePanel() {
  const view = getAppView();
  if (view !== 'site' && view !== 'mobile') return null;
  return document.getElementById(`${view}View`);
}

function routePanelScroll(event) {
  const panel = getActiveScrollablePanel();
  if (!panel) return;

  const delta = event.deltaY || 0;
  if (!delta) return;

  event.preventDefault();
  panel.scrollTop += delta;
}

function handlePanelArrowScroll(event) {
  const view = getAppView();
  const panel = getActiveScrollablePanel();
  if (!panel) return;
  if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return;

  const step = Math.max(120, Math.round(window.innerHeight * 0.18));
  let handled = true;
  const pageStep = Math.round(window.innerHeight * 0.8);
  if (view === 'site') {
    if (event.key === 'ArrowDown') window.scrollBy({ top: step, left: 0, behavior: 'auto' });
    else if (event.key === 'ArrowUp') window.scrollBy({ top: -step, left: 0, behavior: 'auto' });
    else if (event.key === 'PageDown' || event.key === ' ') window.scrollBy({ top: pageStep, left: 0, behavior: 'auto' });
    else if (event.key === 'PageUp') window.scrollBy({ top: -pageStep, left: 0, behavior: 'auto' });
    else if (event.key === 'Home') window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    else if (event.key === 'End') window.scrollTo({ top: document.documentElement.scrollHeight, left: 0, behavior: 'auto' });
    else handled = false;
  } else if (event.key === 'ArrowDown') panel.scrollTop += step;
  else if (event.key === 'ArrowUp') panel.scrollTop -= step;
  else if (event.key === 'PageDown' || event.key === ' ') panel.scrollTop += pageStep;
  else if (event.key === 'PageUp') panel.scrollTop -= pageStep;
  else if (event.key === 'Home') panel.scrollTop = 0;
  else if (event.key === 'End') panel.scrollTop = panel.scrollHeight;
  else handled = false;

  if (handled) event.preventDefault();
}

function renderManagerHistory() {
  const history = document.getElementById('managerHistory');
  if (!history) return;
  history.innerHTML = MARKET_HISTORY.slice().reverse().slice(0, 8).map(entry => `
    <article class="history-row">
      <div>
        <strong>${escapeHtml(entry.label || entry.kind || 'Change')}</strong>
        <span>${escapeHtml(formatShortDate(entry.t))} ${escapeHtml(formatShortTime(entry.t))}</span>
      </div>
      <button class="history-undo" data-history-undo="${entry.t}">Undo last</button>
    </article>
  `).join('') || '<div class="empty-state">No saved changes yet.</div>';

  history.querySelectorAll('[data-history-undo]').forEach(btn => {
    btn.addEventListener('click', () => {
      undoLastMarketChange();
      queueSaveState('saved', 'Reverted last change');
      renderManagerView();
    });
  });
}

function renderMobileView() {
  const rail = document.getElementById('mobileMenuRail');
  const sections = document.getElementById('mobileMenuSections');
  if (!rail || !sections) return;

  const activeSection = MOBILE_MENU_SECTIONS.some(section => section.id === PAGE_STATE.mobile.selectedCat)
    ? PAGE_STATE.mobile.selectedCat
    : MOBILE_MENU_SECTIONS[0].id;
  PAGE_STATE.mobile.selectedCat = activeSection;

  rail.innerHTML = MOBILE_MENU_SECTIONS.map(section => `
    <button class="mobile-rail-chip ${section.id === activeSection ? 'active' : ''}" data-mobile-section="${section.id}" type="button">
      ${escapeHtml(section.label)}
    </button>
  `).join('');

  sections.innerHTML = MOBILE_MENU_SECTIONS.map(section => {
    const items = section.items();
    return `
      <section class="mobile-menu-section" id="mobile-section-${escapeHtml(section.id)}">
        <div class="mobile-menu-section-head">
          <div>
            <h2>${escapeHtml(section.label)}</h2>
            <p>${escapeHtml(section.note)}</p>
          </div>
          <span>${items.length} items</span>
        </div>
        <div class="mobile-menu-grid">
          ${renderMobileMenuCards(items)}
        </div>
      </section>
    `;
  }).join('');

  rail.querySelectorAll('[data-mobile-section]').forEach(btn => {
    btn.addEventListener('click', () => {
      const sectionId = btn.dataset.mobileSection;
      const target = document.getElementById(`mobile-section-${sectionId}`);
      PAGE_STATE.mobile.selectedCat = sectionId;
      rail.querySelectorAll('.mobile-rail-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.mobileSection === sectionId);
      });
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  const mobileView = document.getElementById('mobileView');
  if (mobileView) {
    mobileView.scrollTop = 0;
    requestAnimationFrame(() => {
      mobileView.scrollTop = 0;
    });
  }
  window.scrollTo?.(0, 0);
}

const SITE_MOMENTS = {
  market: {
    kicker: '01 Market',
    headline: 'The board sets the pace.',
    copy: 'Guests see what is rising, what is cooling, and where the value is right now, turning pricing into a shared venue signal.',
    label: 'Market board',
    state: 'Open',
    foot: 'Open market · clear demand signal',
    rows: [
      { name: 'Classic Margarita', value: '£12.80' },
      { name: 'Smokey Old Fashioned', value: '£13.40' },
      { name: 'Hugo', value: '£11.60' },
    ],
    metrics: [
      { label: 'Movement', value: '+8.4%', tone: 'up' },
      { label: 'Volume', value: '1,840', tone: '' },
      { label: 'Visibility', value: 'High', tone: '' },
    ],
  },
  spotlight: {
    kicker: '02 Spotlight',
    headline: 'The room follows the feature.',
    copy: 'Pull one drink into focus so the room has a clear visual cue and a reason to pay attention to what is trending now.',
    label: 'Featured drink',
    state: 'Live',
    foot: 'Spotlight moment · featured pour',
    hero: { name: 'Oink on the Rocks', price: '£9.62', sub: 'old fashioned · in demand tonight' },
    rows: [
      { name: 'Best value', value: '£8.40' },
      { name: 'Momentum', value: 'Strong' },
      { name: 'Signal', value: 'Feature-led' },
    ],
    metrics: [
      { label: 'Attention', value: 'High', tone: 'up' },
      { label: 'Move', value: '+8.1%', tone: 'up' },
      { label: 'Status', value: 'Featured', tone: '' },
    ],
  },
  crash: {
    kicker: '03 Crash',
    headline: 'The moment resets the room.',
    copy: 'Use a category crash to create urgency, trigger a reset, and give the floor a reason to act before the window closes.',
    label: 'Crash mode',
    state: 'Live',
    foot: 'Crash moment · category reset',
    rows: [
      { name: 'Cocktails', value: 'Down 35%' },
      { name: 'Spirits', value: 'Down 28%' },
      { name: 'Signature', value: 'Reset live' },
    ],
    alert: 'Buy window open',
    metrics: [
      { label: 'Pressure', value: 'High', tone: 'up' },
      { label: 'Move', value: '-35%', tone: 'dn' },
      { label: 'Window', value: 'Open', tone: '' },
    ],
  },
};

function renderSiteMomentPanel(panel, momentKey) {
  const moment = SITE_MOMENTS[momentKey] || SITE_MOMENTS.market;
  const rows = moment.rows.map(row => `
    <div class="site-moment-row">
      <span>${escapeHtml(row.name)}</span>
      <strong>${escapeHtml(row.value)}</strong>
    </div>
  `).join('');

  panel.innerHTML = `
    <article class="site-moment-card site-moment-${escapeHtml(momentKey)}">
      <div class="site-moment-copy">
        <div class="site-moment-kicker">${escapeHtml(moment.kicker)}</div>
        <h3>${escapeHtml(moment.headline)}</h3>
        <p>${escapeHtml(moment.copy)}</p>
      </div>
      <div class="site-moment-visual">
        <div class="site-moment-visual-head">
          <span>${escapeHtml(moment.label)}</span>
          <strong>${escapeHtml(moment.state)}</strong>
        </div>
        ${momentKey === 'spotlight' ? `
          <div class="site-moment-hero">
            <div>
              <span>Featured drink</span>
              <strong>${escapeHtml(moment.hero.name)}</strong>
              <p>${escapeHtml(moment.hero.sub)}</p>
            </div>
            <b>${escapeHtml(moment.hero.price)}</b>
          </div>
        ` : ''}
        ${momentKey === 'crash' ? `
          <div class="site-moment-alert">${escapeHtml(moment.alert)}</div>
        ` : ''}
        <div class="site-moment-list">
          ${rows}
        </div>
        <div class="site-moment-metrics">
          ${moment.metrics ? moment.metrics.map(metric => `
            <div class="site-moment-metric">
              <span>${escapeHtml(metric.label)}</span>
              <strong class="${metric.tone || ''}">${escapeHtml(metric.value)}</strong>
            </div>
          `).join('') : ''}
        </div>
        <div class="site-moment-foot">${escapeHtml(moment.foot)}</div>
      </div>
    </article>
  `;
}

function renderSiteView() {
  const pricing = document.getElementById('sitePricing');
  const form = document.getElementById('siteSignupForm');
  const venueInput = document.getElementById('siteVenueName');
  const ownerInput = document.getElementById('siteOwnerName');
  const emailInput = document.getElementById('siteOwnerEmail');
  const planSelect = document.getElementById('sitePlanSelect');
  const momentPanel = document.getElementById('siteMomentPanel');
  if (!pricing || !form || !venueInput || !ownerInput || !emailInput || !planSelect) return;

  const plans = [
    {
      id: 'starter',
      name: 'Starter',
      price: '£149/mo',
      blurb: 'For venues proving demand with one live room display and guest mobile access.',
    },
    {
      id: 'growth',
      name: 'Growth',
      price: '£299/mo',
      blurb: 'For operators who want full market controls, stronger guidance, and daily visibility.',
    },
    {
      id: 'premium',
      name: 'Premium',
      price: '£549/mo',
      blurb: 'For groups rolling Night Economy out across multiple venues with hands-on support.',
    },
  ];

  pricing.innerHTML = plans.map(plan => `
    <article class="site-price-pill ${PAGE_STATE.site.selectedPlan === plan.id ? 'active' : ''}" data-site-plan="${plan.id}">
      <div>
        <strong>${plan.name}</strong>
        <span>${plan.price}</span>
      </div>
      <p>${plan.blurb}</p>
    </article>
  `).join('');
  pricing.querySelectorAll('[data-site-plan]').forEach(card => {
    card.addEventListener('click', () => {
      PAGE_STATE.site.selectedPlan = card.dataset.sitePlan;
      planSelect.value = PAGE_STATE.site.selectedPlan;
      renderSiteView();
    });
  });
  planSelect.onchange = () => {
    PAGE_STATE.site.selectedPlan = planSelect.value;
    renderSiteView();
  };

  const profile = loadPortalProfile();
  venueInput.value = profile.venueName === 'Pickle House' ? '' : profile.venueName;
  ownerInput.value = profile.ownerName === 'Venue Owner' ? '' : profile.ownerName;
  emailInput.value = profile.email === 'owner@night-economy.app' ? '' : profile.email;
  planSelect.value = PAGE_STATE.site.selectedPlan;
  if (momentPanel) {
    renderSiteMomentPanel(momentPanel, PAGE_STATE.site.activeMoment);
  }
  initSiteLandingMotion();

  document.querySelectorAll('.site-moment-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.siteMoment === PAGE_STATE.site.activeMoment);
    tab.addEventListener('click', () => {
      PAGE_STATE.site.activeMoment = tab.dataset.siteMoment;
      renderSiteView();
    });
  });

  form.onsubmit = (event) => {
    event.preventDefault();
    const nextProfile = {
      ...profile,
      subscribed: true,
      plan: planSelect.value,
      venueName: venueInput.value.trim() || 'New Night Economy Venue',
      ownerName: ownerInput.value.trim() || 'Venue Owner',
      email: emailInput.value.trim() || 'owner@night-economy.app',
      seats: planSelect.value === 'starter' ? 3 : planSelect.value === 'growth' ? 8 : 20,
      billing: 'Monthly',
    };
    savePortalProfile(nextProfile);
    PAGE_STATE.portal.role = 'owner';
    showToast(`Subscription activated for ${nextProfile.venueName}`, 'success');
    const url = new URL(window.location.href);
    url.searchParams.set('view', 'portal');
    window.history.pushState({}, '', url);
    setActiveAppView('portal');
    refreshAuxViews();
  };

  initWhyScrollStory();
}

function bindPortalEmployeeControls(controls) {
  controls.querySelectorAll('[data-drink-row]').forEach(row => {
    row.addEventListener('click', (event) => {
      if (event.target.closest('input, select, button, label')) return;
      PAGE_STATE.employee.selectedId = row.dataset.drinkRow;
      renderPortalView();
    });
  });

  controls.querySelectorAll('[data-field]').forEach(el => {
    if (el.tagName === 'INPUT' || el.tagName === 'SELECT') {
      el.addEventListener('focus', () => {
        PAGE_STATE.employee.selectedId = el.dataset.id;
      });
    }
  });

  controls.querySelectorAll('input, select').forEach(el => {
    const apply = () => {
      const id = el.dataset.id;
      const field = el.dataset.field;
      const drink = D.find(item => item.id === id);
      if (!drink) return;
      const patch = {};
      if (field === 'name' || field === 'cat') patch[field] = el.value;
      if (field === 'salePrice' || field === 'floor' || field === 'ceiling') patch[field] = Number(el.value);
      if (field === 'soldOut') patch.soldOut = el.checked;
      const next = normalizeDrinkPatch(drink, patch);
      PAGE_STATE.employee.saveState = 'unsaved';
      const pill = document.getElementById('portalSaveState');
      if (pill) {
        pill.textContent = 'Unsaved';
        pill.className = 'save-pill unsaved';
      }
      clearTimeout(PAGE_STATE.employee.dirtyTimer);
      PAGE_STATE.employee.dirtyTimer = setTimeout(() => {
        commitEmployeeEdit(id, next, `Updated ${drink.n}`);
        renderPortalView();
      }, 350);
    };
    if (el.type === 'checkbox' || el.tagName === 'SELECT') el.addEventListener('change', apply);
    else el.addEventListener('input', apply);
  });

  controls.querySelectorAll('[data-step]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const field = btn.dataset.field;
      const dir = Number(btn.dataset.step);
      const drink = D.find(item => item.id === id);
      if (!drink) return;
      const current = field === 'salePrice' ? drink.b : drink[field];
      const patch = {};
      patch[field] = +(Number(current) + dir).toFixed(2);
      commitEmployeeEdit(id, normalizeDrinkPatch(drink, patch), `Adjusted ${drink.n}`);
      renderPortalView();
    });
  });

  controls.querySelectorAll('[data-reset-drink]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.resetDrink;
      const drink = DRINKS.find(item => item.id === id);
      if (!drink) return;
      commitEmployeeEdit(id, {
        name: drink.n,
        cat: drink.cat,
        salePrice: drink.b,
        floor: +(drink.b * 0.65).toFixed(2),
        ceiling: +(drink.b * 1.65).toFixed(2),
        soldOut: false,
      }, `Reset ${drink.n}`);
      renderPortalView();
    });
  });

  controls.querySelectorAll('[data-cat-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.cat;
      const action = btn.dataset.catAction;
      const items = D.filter(d => d.cat === cat);
      if (!items.length) return;
      if (action === 'soldout') {
        commitCategoryEdit(cat, () => {
          MARKET_SETTINGS.categories[cat] = { ...(MARKET_SETTINGS.categories[cat] || { label: cat.replace('-', ' ') }), soldOut: true };
          items.forEach(d => {
            MARKET_SETTINGS.drinks[d.id] = { ...(MARKET_SETTINGS.drinks[d.id] || {}), soldOut: true };
          });
        }, `${cat.replace('-', ' ')} sold out`);
      }
      if (action === 'reset') {
        commitCategoryEdit(cat, () => {
          MARKET_SETTINGS.categories[cat] = { label: cat.replace('-', ' '), soldOut: false };
          DRINKS.filter(d => d.cat === cat).forEach(src => {
            MARKET_SETTINGS.drinks[src.id] = { name: src.n, cat: src.cat, salePrice: src.b, floor: +(src.b * 0.65).toFixed(2), ceiling: +(src.b * 1.65).toFixed(2), soldOut: false };
          });
        }, `${cat.replace('-', ' ')} reset`);
      }
    });
  });
}

function renderPortalView() {
  const profile = loadPortalProfile();
  const roleSwitch = document.getElementById('portalRoleSwitch');
  const planCard = document.getElementById('portalPlanCard');
  const tabs = document.getElementById('portalTabs');
  const sidebarMeta = document.getElementById('portalSidebarMeta');
  const workspace = document.getElementById('portalWorkspace');
  const search = document.getElementById('portalDrinkSearch');
  const saveState = document.getElementById('portalSaveState');
  const headerSub = document.getElementById('portalHeaderSub');
  if (!roleSwitch || !planCard || !tabs || !sidebarMeta || !workspace || !search || !saveState || !headerSub) return;

  const roles = [
    { id: 'owner', label: 'Owner', desc: 'Billing, launch controls, pricing, team.' },
    { id: 'manager', label: 'Manager', desc: 'Sales, exports, stock, and session ops.' },
    { id: 'staff', label: 'Staff', desc: 'Floor-safe view with limited pricing controls.' },
  ];
  const portalTabs = [
    ['overview', 'Overview'],
    ['ops', 'Live Ops'],
    ['menu', 'Menu & Pricing'],
    ['performance', 'Performance'],
    ['team', 'Team'],
    ['settings', 'Settings'],
  ];

  roleSwitch.innerHTML = roles.map(role => `<button class="range-chip ${PAGE_STATE.portal.role === role.id ? 'active' : ''}" data-portal-role="${role.id}">${role.label}</button>`).join('');
  roleSwitch.querySelectorAll('[data-portal-role]').forEach(btn => {
    btn.addEventListener('click', () => {
      PAGE_STATE.portal.role = btn.dataset.portalRole;
      renderPortalView();
    });
  });

  planCard.innerHTML = `
    <strong>${escapeHtml(profile.venueName)}</strong>
    <span>${escapeHtml(profile.plan)} plan · ${profile.subscribed ? 'Active subscription' : 'Demo mode'}</span>
    <span>${profile.seats} team seats · ${escapeHtml(profile.billing)}</span>
  `;

  tabs.innerHTML = portalTabs.map(([tab, label]) => `<button class="sort-chip ${PAGE_STATE.portal.selectedTab === tab ? 'active' : ''}" data-portal-tab="${tab}">${label}</button>`).join('');
  tabs.querySelectorAll('[data-portal-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      PAGE_STATE.portal.selectedTab = btn.dataset.portalTab;
      renderPortalView();
    });
  });

  const records = getManagerRecords();
  const sessionRecords = getSalesRange('session');
  const snapshot = getPortalHealthSnapshot(sessionRecords);
  const topCategory = getTopCategory(sessionRecords);
  const topMovers = getPortalTopMovers();
  const categoryRows = getCategoryCardsData();
  const alerts = getAttentionItems();
  const previewDrink = getEmployeePreviewDrink();
  const visible = getVisibleEmployeeDrinks();
  const groupedVisible = groupBy(visible, drink => drink.cat);
  const buckets = getPortalTimeBuckets(sessionRecords);
  const maxOrders = Math.max(1, ...categoryRows.map(row => row.totalOrders));
  const maxBucketRevenue = Math.max(1, ...buckets.map(bucket => bucket.revenue));

  sidebarMeta.innerHTML = `
    <div class="portal-sidebar-stat">
      <span>Market</span>
      <strong>${typeof crashActive !== 'undefined' && crashActive ? 'Crash mode' : 'Live'}</strong>
    </div>
    <div class="portal-sidebar-stat">
      <span>Revenue tonight</span>
      <strong>${formatMoney(snapshot.revenue)}</strong>
    </div>
    <div class="portal-sidebar-stat">
      <span>Sold out</span>
      <strong>${snapshot.soldOut} drinks</strong>
    </div>
  `;

  const headerCopy = {
    overview: 'A concise workspace for service, stock, and pricing decisions.',
    ops: 'Launch controls, live alerts, and operating rhythm for the floor team.',
    menu: 'Edit drinks, pricing guardrails, and sold-out state with real session context.',
    performance: 'Track demand, revenue, and category movement across the evening session.',
    team: 'Set access by role and keep operations safe as the venue scales.',
    settings: 'Configure the venue, subscription, displays, and rollout defaults.',
  };
  headerSub.textContent = headerCopy[PAGE_STATE.portal.selectedTab] || headerCopy.overview;

  const billingHtml = `
    <div class="portal-billing-stack">
      <div><span>Plan</span><strong>${escapeHtml(profile.plan)}</strong></div>
      <div><span>Billing</span><strong>${escapeHtml(profile.billing)}</strong></div>
      <div><span>Seats</span><strong>${profile.seats}</strong></div>
      <div><span>Top category</span><strong>${escapeHtml((topCategory?.cat || '—').replace('-', ' '))}</strong></div>
    </div>
    <div class="portal-permission-list">
      ${roles.map(role => `<article class="portal-permission ${PAGE_STATE.portal.role === role.id ? 'active' : ''}"><strong>${role.label}</strong><span>${role.desc}</span></article>`).join('')}
    </div>
  `;
  const alertHtml = alerts.length ? alerts.map(item => `
    <article class="alert-card ${item.tone}">
      <strong>${escapeHtml(item.title)}</strong>
      <span>${escapeHtml(item.body)}</span>
    </article>
  `).join('') : '<div class="empty-state">No urgent issues right now.</div>';
  const categoriesHtml = categoryRows.map(row => `
    <article class="portal-category-card">
      <div class="portal-category-head">
        <div>
          <strong>${escapeHtml(row.cat.replace('-', ' '))}</strong>
          <span>${row.items.length} drinks · ${row.totalOrders} orders</span>
        </div>
        <div class="portal-category-price">${formatMoney(row.avgPrice)}</div>
      </div>
      <div class="portal-category-metric">
        <label>Order volume</label>
        ${buildProgressMeter(row.totalOrders, maxOrders, 'green')}
      </div>
      <div class="portal-category-meta">
        <span>${row.items.filter(d => d.soldOut).length} sold out</span>
        <span>${row.items.filter(d => d.p >= d.ceiling * 0.98).length} near ceiling</span>
      </div>
    </article>
  `).join('');
  const moversHtml = topMovers.map(drink => {
    const delta = ((drink.p - drink.b) / drink.b) * 100;
    return `
      <article class="portal-mover-row">
        <div>
          <strong>${escapeHtml(drink.n)}</strong>
          <span>${escapeHtml(drink.cat.replace('-', ' '))}</span>
        </div>
        <div class="portal-mover-metrics">
          <span>${formatMoney(drink.p)}</span>
          <strong class="${delta >= 0 ? 'up' : 'dn'}">${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%</strong>
        </div>
      </article>
    `;
  }).join('');
  const activityHtml = records.length ? records.map(row => `
    <button class="record-row" data-portal-record="${row.id}:${row.t}">
      <span>${formatShortTime(row.t)}</span>
      <strong>${escapeHtml(row.n)}</strong>
      <span>${escapeHtml(row.cat.replace('-', ' '))}</span>
      <span class="tone ${row.type === 'buy' ? 'up' : 'dn'}">${row.type.toUpperCase()}</span>
      <span>${formatMoney(row.price)}</span>
    </button>
  `).join('') : '<div class="empty-state">No orders logged yet.</div>';
  const timelineHtml = buckets.map(bucket => `
    <article class="portal-timeline-row">
      <div>
        <strong>${bucket.label}</strong>
        <span>${bucket.orders} orders</span>
      </div>
      <div class="portal-timeline-bar">${buildProgressMeter(bucket.revenue, maxBucketRevenue, 'blue')}</div>
      <strong>${formatMoney(bucket.revenue)}</strong>
    </article>
  `).join('');
  const historyHtml = MARKET_HISTORY.slice().reverse().slice(0, 8).map(entry => `
    <article class="history-row">
      <div>
        <strong>${escapeHtml(entry.label || entry.kind || 'Change')}</strong>
        <span>${escapeHtml(formatShortDate(entry.t))} ${escapeHtml(formatShortTime(entry.t))}</span>
      </div>
      <button class="history-undo" data-portal-undo="${entry.t}">Undo last</button>
    </article>
  `).join('') || '<div class="empty-state">No saved changes yet.</div>';

  if (PAGE_STATE.portal.selectedTab === 'overview') {
    workspace.innerHTML = `
      <section class="portal-overview-grid">
        <div class="portal-pane portal-pane-summary">
          <div class="card-hdr">Venue Health</div>
          <div class="portal-summary" id="portalSummary"></div>
        </div>
        <div class="portal-pane">
          <div class="card-hdr">Live Alerts</div>
          <div class="alert-list">${alertHtml}</div>
        </div>
        <div class="portal-pane">
          <div class="card-hdr">Subscription & Access</div>
          <div class="portal-billing">${billingHtml}</div>
        </div>
      </section>
      <section class="portal-analytics-grid">
        <div class="portal-pane">
          <div class="card-hdr">Top Movers</div>
          <div class="portal-mover-list">${moversHtml}</div>
        </div>
        <div class="portal-pane">
          <div class="card-hdr">Category Health</div>
          <div class="portal-category-list">${categoriesHtml}</div>
        </div>
        <div class="portal-pane">
          <div class="card-hdr">Tonight Timeline</div>
          <div class="portal-timeline-list">${timelineHtml}</div>
        </div>
      </section>
    `;
  } else if (PAGE_STATE.portal.selectedTab === 'ops') {
    workspace.innerHTML = `
      <section class="portal-overview-grid portal-overview-grid-ops">
        <div class="portal-pane portal-pane-summary">
          <div class="card-hdr">Session Status</div>
          <div class="portal-summary" id="portalSummary"></div>
        </div>
        <div class="portal-pane">
          <div class="card-hdr">Checklist</div>
          <div class="portal-checklist">
            <article><strong>Board live</strong><span>TV display is ready to run the room.</span></article>
            <article><strong>Mobile linked</strong><span>Mobile reflects the same market state.</span></article>
            <article><strong>Price rails set</strong><span>Each drink has a base, floor, and ceiling.</span></article>
            <article><strong>Team access</strong><span>${PAGE_STATE.portal.role === 'staff' ? 'Staff-safe mode is active.' : 'Manager access is available tonight.'}</span></article>
          </div>
        </div>
        <div class="portal-pane">
          <div class="card-hdr">Live Alerts</div>
          <div class="alert-list">${alertHtml}</div>
        </div>
      </section>
      <section class="portal-pane">
        <div class="portal-section-head">
          <div>
            <div class="card-hdr">Launch Log</div>
            <div class="portal-section-sub">Every operator change is tracked so the session can be reset safely.</div>
          </div>
          <div class="portal-inline-actions">
            <button class="manager-action" id="portalUndo">Undo last change</button>
            <button class="manager-action" id="portalHighlight">Highlight changes: on</button>
          </div>
        </div>
        <div class="history-list" id="portalHistory">${historyHtml}</div>
      </section>
    `;
  } else if (PAGE_STATE.portal.selectedTab === 'menu') {
    workspace.innerHTML = `
      <section class="portal-ops-pane">
        <div class="portal-section-head">
          <div>
            <div class="card-hdr">Menu & Pricing</div>
            <div class="portal-section-sub">Edit drinks, stock status, and guardrails without leaving the operator workflow.</div>
          </div>
          <div class="portal-inline-actions">
            <button class="manager-action" id="portalUndo">Undo last change</button>
            <button class="manager-action" id="portalHighlight">Highlight changes: on</button>
          </div>
        </div>
        <div class="portal-preview" id="portalPreview"></div>
        <div class="portal-filter-row" id="portalCatFilters"></div>
        <div class="employee-list" id="portalControls"></div>
      </section>
    `;
  } else if (PAGE_STATE.portal.selectedTab === 'performance') {
    workspace.innerHTML = `
      <section class="portal-overview-grid">
        <div class="portal-pane portal-pane-summary">
          <div class="card-hdr">Performance Snapshot</div>
          <div class="portal-summary" id="portalSummary"></div>
        </div>
        <div class="portal-pane">
          <div class="card-hdr">Category Health</div>
          <div class="portal-category-list">${categoriesHtml}</div>
        </div>
        <div class="portal-pane">
          <div class="card-hdr">Timeline</div>
          <div class="portal-timeline-list">${timelineHtml}</div>
        </div>
      </section>
      <section class="portal-pane portal-pane-feed">
        <div class="portal-section-head">
          <div class="card-hdr">Order Activity</div>
          <div class="portal-inline-actions">
            <button class="manager-action" id="portalExportCsv">Export CSV</button>
            <button class="manager-action" id="portalExportJson">Export JSON</button>
          </div>
        </div>
        <div class="record-head" id="portalRecordHead"></div>
        <div class="record-list" id="portalSales">${activityHtml}</div>
      </section>
    `;
  } else if (PAGE_STATE.portal.selectedTab === 'team') {
    workspace.innerHTML = `
      <section class="portal-overview-grid">
        <div class="portal-pane portal-pane-summary">
          <div class="card-hdr">Roles</div>
          <div class="portal-summary" id="portalSummary"></div>
        </div>
        <div class="portal-pane">
          <div class="card-hdr">Permission Model</div>
          <div class="portal-billing">${billingHtml}</div>
        </div>
        <div class="portal-pane">
          <div class="card-hdr">Recommended Access</div>
          <div class="portal-checklist">
            <article><strong>Owner</strong><span>Billing, venue setup, launch logic, and system overrides.</span></article>
            <article><strong>Manager</strong><span>Session ops, stock, exports, and pricing guardrails.</span></article>
            <article><strong>Staff</strong><span>Read-heavy access with limited venue editing.</span></article>
          </div>
        </div>
      </section>
      <section class="portal-pane">
        <div class="card-hdr">Recent Change Log</div>
        <div class="history-list" id="portalHistory">${historyHtml}</div>
      </section>
    `;
  } else {
    workspace.innerHTML = `
      <section class="portal-overview-grid">
        <div class="portal-pane portal-pane-summary">
          <div class="card-hdr">Venue Setup</div>
          <div class="portal-summary" id="portalSummary"></div>
        </div>
        <div class="portal-pane">
          <div class="card-hdr">Subscription</div>
          <div class="portal-settings-list">
            <article><span>Venue</span><strong>${escapeHtml(profile.venueName)}</strong></article>
            <article><span>Plan</span><strong>${escapeHtml(profile.plan)}</strong></article>
            <article><span>Billing</span><strong>${escapeHtml(profile.billing)}</strong></article>
            <article><span>Seats</span><strong>${profile.seats}</strong></article>
          </div>
        </div>
        <div class="portal-pane">
          <div class="card-hdr">Devices & Surfaces</div>
          <div class="portal-checklist">
            <article><strong>TV surface</strong><span>Configured for the room display.</span></article>
            <article><strong>Mobile</strong><span>Configured for guest-facing market browsing.</span></article>
            <article><strong>Portal</strong><span>Configured for operator access and control.</span></article>
          </div>
        </div>
      </section>
      <section class="portal-pane">
        <div class="card-hdr">Prototype Notes</div>
        <div class="portal-settings-list">
          <article><span>State</span><strong>${profile.subscribed ? 'Subscribed prototype' : 'Demo mode'}</strong></article>
          <article><span>Market behaviour</span><strong>Live synthetic session from 18:00 to 01:00</strong></article>
          <article><span>Access model</span><strong>Owner, manager, and staff permission simulation</strong></article>
        </div>
      </section>
    `;
  }

  const summary = workspace.querySelector('#portalSummary');
  if (summary) {
    summary.innerHTML = '';
    renderStatPill(summary, 'Revenue', formatMoney(snapshot.revenue));
    renderStatPill(summary, 'Orders', String(sessionRecords.length));
    renderStatPill(summary, 'Active', String(snapshot.active));
    renderStatPill(summary, 'Sold Out', String(snapshot.soldOut));
    renderStatPill(summary, 'Near Ceiling', String(snapshot.nearCeiling));
    renderStatPill(summary, 'Avg Move', `${snapshot.averageDelta >= 0 ? '+' : ''}${snapshot.averageDelta.toFixed(1)}%`, snapshot.averageDelta >= 0 ? 'up' : '');
  }

  search.value = PAGE_STATE.employee.search;
  search.oninput = () => {
    PAGE_STATE.employee.search = search.value;
    renderPortalView();
  };

  const head = workspace.querySelector('#portalRecordHead');
  if (head) {
    const headers = [['t', 'Time'], ['n', 'Drink'], ['cat', 'Category'], ['type', 'Type'], ['price', 'Price']];
    head.innerHTML = headers.map(([key, label]) => `<button class="record-head-btn ${PAGE_STATE.manager.sortKey === key ? 'active' : ''}" data-sort="${key}">${escapeHtml(label)}</button>`).join('');
    head.querySelectorAll('[data-sort]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (PAGE_STATE.manager.sortKey === btn.dataset.sort) PAGE_STATE.manager.sortDir = PAGE_STATE.manager.sortDir === 'asc' ? 'desc' : 'asc';
        else {
          PAGE_STATE.manager.sortKey = btn.dataset.sort;
          PAGE_STATE.manager.sortDir = btn.dataset.sort === 'price' ? 'desc' : 'asc';
        }
        renderPortalView();
      });
    });
  }

  const history = workspace.querySelector('#portalHistory');
  history?.querySelectorAll('[data-portal-undo]').forEach(btn => {
    btn.addEventListener('click', () => {
      undoLastMarketChange();
      renderPortalView();
    });
  });

  const filters = workspace.querySelector('#portalCatFilters');
  if (filters) {
    filters.innerHTML = ['all', ...new Set(D.map(d => d.cat))].map(cat => `<button class="range-chip ${PAGE_STATE.employee.selectedCat === cat ? 'active' : ''}" data-portal-cat="${cat}">${escapeHtml(cat === 'all' ? 'All categories' : cat.replace('-', ' '))}</button>`).join('');
    filters.querySelectorAll('[data-portal-cat]').forEach(btn => {
      btn.addEventListener('click', () => {
        PAGE_STATE.employee.selectedCat = btn.dataset.portalCat;
        renderPortalView();
      });
    });
  }

  const preview = workspace.querySelector('#portalPreview');
  if (preview) {
    preview.innerHTML = previewDrink ? `
      <div class="preview-card ${previewDrink.soldOut ? 'sold-out' : ''}">
        <div class="preview-top">
          <div>
            <div class="card-hdr">Selected Drink</div>
            <div class="preview-name">${escapeHtml(previewDrink.n)}</div>
            <div class="preview-sub">${escapeHtml(previewDrink.cat.replace('-', ' '))}</div>
          </div>
          <div class="preview-price">${formatMoney(previewDrink.p)}</div>
        </div>
        <div class="portal-preview-layout">
          <div class="portal-preview-chart-wrap">
            <div class="portal-preview-chart" id="portalPreviewChart"></div>
          </div>
          <div class="portal-preview-aside">
            <div class="portal-preview-range">${buildPricePositionMarkup(previewDrink)}</div>
            <div class="preview-grid">
              <div><span>Base</span><strong>${formatMoney(previewDrink.b)}</strong></div>
              <div><span>Floor</span><strong>${formatMoney(previewDrink.floor)}</strong></div>
              <div><span>Ceiling</span><strong>${formatMoney(previewDrink.ceiling)}</strong></div>
              <div><span>Status</span><strong>${previewDrink.soldOut ? 'Sold out' : 'Live'}</strong></div>
            </div>
          </div>
        </div>
      </div>
    ` : '<div class="empty-state">No drinks match this search.</div>';
    const previewChart = document.getElementById('portalPreviewChart');
    if (previewDrink && previewChart) renderSpotlightTrendChart(previewChart, previewDrink);
  }

  const controls = workspace.querySelector('#portalControls');
  if (controls) {
    controls.innerHTML = Object.keys(groupedVisible).length ? Object.entries(groupedVisible).map(([cat, items]) => `
      <section class="employee-category">
        <div class="employee-category-head">
          <div>
            <div class="employee-category-name">${escapeHtml(cat.replace('-', ' '))}</div>
            <div class="employee-category-sub">${items.length} drinks · ${items.filter(d => d.soldOut).length} sold out</div>
          </div>
          <div class="employee-category-actions">
            <button data-cat-action="soldout" data-cat="${escapeHtml(cat)}">Mark sold out</button>
            <button data-cat-action="reset" data-cat="${escapeHtml(cat)}">Reset category</button>
          </div>
        </div>
        <div class="employee-drinks">${items.map(renderEmployeeDrinkRow).join('')}</div>
      </section>
    `).join('') : '<div class="empty-state">No drinks match this search.</div>';
    bindPortalEmployeeControls(controls);
  }

  saveState.textContent = PAGE_STATE.employee.saveState === 'saved' ? 'Saved' : PAGE_STATE.employee.saveState === 'saving' ? 'Saving…' : 'Unsaved';
  saveState.className = `save-pill ${PAGE_STATE.employee.saveState}`;

  document.getElementById('portalOpenMarket').onclick = () => {
    if (typeof initMode === 'function') initMode('base');
    showToast('Market opened on the live board', 'success');
  };
  document.getElementById('portalCrashDrill').onclick = () => {
    if (typeof initMode === 'function') initMode('crash');
    showToast('Crash drill launched', 'warn');
  };
  document.getElementById('portalResetVenue').onclick = () => {
    rebuildMarketState();
    if (typeof initMode === 'function') initMode('base');
    renderPortalView();
    showToast('Venue reset to opening state', 'success');
  };

  const undo = workspace.querySelector('#portalUndo');
  if (undo) {
    undo.onclick = () => {
      if (undoLastMarketChange()) {
        queueSaveState('saved', 'Reverted last change');
        renderPortalView();
      }
    };
  }

  const highlight = workspace.querySelector('#portalHighlight');
  if (highlight) {
    highlight.onclick = () => {
      PAGE_STATE.employee.highlightChanges = !PAGE_STATE.employee.highlightChanges;
      renderPortalView();
    };
    highlight.textContent = `Highlight changes: ${PAGE_STATE.employee.highlightChanges ? 'on' : 'off'}`;
  }

  const exportCsv = workspace.querySelector('#portalExportCsv');
  if (exportCsv) exportCsv.onclick = () => downloadManagerExport('csv', records);
  const exportJson = workspace.querySelector('#portalExportJson');
  if (exportJson) exportJson.onclick = () => downloadManagerExport('json', records);
}

function renderManagerView() {
  const summary = document.getElementById('managerSummary');
  const sales = document.getElementById('managerSales');
  const categories = document.getElementById('managerCategories');
  const alerts = document.getElementById('managerAlerts');
  const drawer = document.getElementById('managerDrawerBody');
  const range = document.getElementById('managerRange');
  const search = document.getElementById('managerSearch');
  const sort = document.getElementById('managerSort');
  const head = document.getElementById('managerRecordHead');
  if (!summary || !sales || !categories || !alerts || !drawer || !range || !search || !sort || !head) return;

  const records = getManagerRecords();
  const allRecords = getSalesRange('all');
  const revenue = records.reduce((sum, row) => sum + row.price, 0);
  const orders = records.length;
  const avgOrder = orders ? revenue / orders : 0;
  const soldOutCount = D.filter(d => d.soldOut).length;
  const topCategory = getTopCategory(records);
  summary.innerHTML = '';
  renderStatPill(summary, 'Revenue', formatMoney(revenue));
  renderStatPill(summary, 'Orders', String(orders));
  renderStatPill(summary, 'Avg Order', formatMoney(avgOrder));
  renderStatPill(summary, 'Sold Out', String(soldOutCount));
  renderStatPill(summary, 'Top Category', topCategory ? topCategory.cat.replace('-', ' ') : '—');

  const rangeItems = [
    ['session', 'Session'],
    ['last-hour', 'Last hour'],
    ['today', 'Today'],
    ['all', 'All time'],
  ];
  range.innerHTML = rangeItems.map(([value, label]) => `<button class="range-chip ${PAGE_STATE.manager.range === value ? 'active' : ''}" data-range="${value}">${label}</button>`).join('');
  range.querySelectorAll('[data-range]').forEach(btn => {
    btn.addEventListener('click', () => {
      PAGE_STATE.manager.range = btn.dataset.range;
      renderManagerView();
    });
  });

  search.value = PAGE_STATE.manager.search;
  search.oninput = () => {
    PAGE_STATE.manager.search = search.value;
    renderManagerView();
  };

  const sortOptions = [
    ['t', 'time'],
    ['n', 'drink'],
    ['cat', 'category'],
    ['price', 'price'],
  ];
  sort.innerHTML = sortOptions.map(([key, label]) => `
    <button class="sort-chip ${PAGE_STATE.manager.sortKey === key ? 'active' : ''}" data-sort="${key}">
      ${escapeHtml(label)}
      <span>${PAGE_STATE.manager.sortKey === key ? (PAGE_STATE.manager.sortDir === 'asc' ? '↑' : '↓') : ''}</span>
    </button>
  `).join('');
  sort.querySelectorAll('[data-sort]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (PAGE_STATE.manager.sortKey === btn.dataset.sort) {
        PAGE_STATE.manager.sortDir = PAGE_STATE.manager.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        PAGE_STATE.manager.sortKey = btn.dataset.sort;
        PAGE_STATE.manager.sortDir = btn.dataset.sort === 'price' ? 'desc' : 'asc';
      }
      renderManagerView();
    });
  });

  const headers = [
    ['t', 'Time'],
    ['n', 'Drink'],
    ['cat', 'Category'],
    ['type', 'Type'],
    ['price', 'Price'],
  ];
  head.innerHTML = headers.map(([key, label]) => `
    <button class="record-head-btn ${PAGE_STATE.manager.sortKey === key ? 'active' : ''}" data-sort="${key}">
      ${escapeHtml(label)}
    </button>
  `).join('');
  head.querySelectorAll('[data-sort]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (PAGE_STATE.manager.sortKey === btn.dataset.sort) {
        PAGE_STATE.manager.sortDir = PAGE_STATE.manager.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        PAGE_STATE.manager.sortKey = btn.dataset.sort;
        PAGE_STATE.manager.sortDir = btn.dataset.sort === 'price' ? 'desc' : 'asc';
      }
      renderManagerView();
    });
  });

  const rows = records;
  sales.innerHTML = rows.length ? rows.map(row => `
    <button class="record-row ${PAGE_STATE.manager.selectedId === row.id + ':' + row.t ? 'selected' : ''}" data-record="${row.id}:${row.t}">
      <span>${formatShortTime(row.t)}</span>
      <strong>${escapeHtml(row.n)}</strong>
      <span>${escapeHtml(row.cat.replace('-', ' '))}</span>
      <span class="tone ${row.type === 'buy' ? 'up' : 'dn'}">${row.type.toUpperCase()}</span>
      <span>${formatMoney(row.price)}</span>
    </button>
  `).join('') : '<div class="empty-state">No sales logged yet.</div>';
  sales.querySelectorAll('[data-record]').forEach(btn => {
    btn.addEventListener('click', () => {
      PAGE_STATE.manager.selectedId = btn.dataset.record;
      renderManagerView();
    });
  });

  const categoryRows = getCategoryCardsData();
  const managerMaxOrders = Math.max(1, ...categoryRows.map(row => row.totalOrders));
  categories.innerHTML = categoryRows.map(row => `
    <article class="category-card">
      <div class="category-card-head">
        <div>
          <strong>${escapeHtml(row.cat.replace('-', ' '))}</strong>
          <span>${row.items.length} drinks · ${row.totalOrders} orders</span>
        </div>
        <div class="category-card-stat">${formatMoney(row.avgPrice)}</div>
      </div>
      <div class="portal-category-metric">
        <label>Order volume</label>
        ${buildProgressMeter(row.totalOrders, managerMaxOrders, 'green')}
      </div>
      <div class="category-card-foot">
        <span>${row.items.filter(d => d.soldOut).length} sold out</span>
        <span>${row.items.filter(d => d.p >= d.ceiling * 0.98).length} near ceiling</span>
      </div>
    </article>
  `).join('');

  alerts.innerHTML = getAttentionItems().map(item => `
    <article class="alert-card ${item.tone}">
      <strong>${escapeHtml(item.title)}</strong>
      <span>${escapeHtml(item.body)}</span>
    </article>
  `).join('') || '<div class="empty-state">No urgent issues right now.</div>';

  renderManagerHistory();

  const selected = rows.find(row => `${row.id}:${row.t}` === PAGE_STATE.manager.selectedId) || rows[0] || null;
  if (selected) PAGE_STATE.manager.selectedId = `${selected.id}:${selected.t}`;
  drawer.innerHTML = selected ? renderManagerDrawer(selected, allRecords) : 'Select a sales record to inspect its history.';
  hydrateLineCharts(drawer);

  document.getElementById('managerExportCsv').onclick = () => downloadManagerExport('csv', rows);
  document.getElementById('managerExportJson').onclick = () => downloadManagerExport('json', rows);
}

function renderManagerDrawer(record, allRecords) {
  const drink = D.find(d => d.id === record.id);
  const related = allRecords.filter(row => row.id === record.id);
  const history = drink ? drink.h : [];
  return `
    <div class="drawer-grid">
      <div class="drawer-main">
        <div class="drawer-title">${escapeHtml(record.n)}</div>
        <div class="drawer-meta">
          <span>${escapeHtml(record.cat.replace('-', ' '))}</span>
          <span>${formatShortDate(record.t)} ${formatShortTime(record.t)}</span>
        </div>
        <div class="drawer-metrics">
          <div><span>Type</span><strong>${escapeHtml(record.type.toUpperCase())}</strong></div>
          <div><span>Price</span><strong>${formatMoney(record.price)}</strong></div>
          <div><span>Previous</span><strong>${formatMoney(record.prev)}</strong></div>
          <div><span>Orders</span><strong>${related.length}</strong></div>
        </div>
      </div>
      <div class="drawer-chart">
        <div class="card-hdr">Price History</div>
        ${sparkline(history, record.type === 'buy' ? '#ff5252' : '#3dd68c', 220, 60)}
      </div>
    </div>
    <div class="drawer-rules">
      <div><span>Floor</span><strong>${drink ? formatMoney(drink.floor) : '—'}</strong></div>
      <div><span>Normal sale price</span><strong>${drink ? formatMoney(drink.b) : '—'}</strong></div>
      <div><span>Ceiling</span><strong>${drink ? formatMoney(drink.ceiling) : '—'}</strong></div>
      <div><span>Status</span><strong>${drink && drink.soldOut ? 'Sold out' : 'Live'}</strong></div>
    </div>
    <div class="drawer-related">
      <div class="card-hdr">Related Orders</div>
      ${related.slice(-6).reverse().map(row => `
        <div class="record-row compact">
          <span>${formatShortTime(row.t)}</span>
          <strong>${formatMoney(row.price)}</strong>
          <span>${escapeHtml(row.type)}</span>
        </div>
      `).join('') || '<div class="empty-state">No related orders yet.</div>'}
    </div>
  `;
}

function getEmployeePreviewDrink() {
  const visible = getVisibleEmployeeDrinks();
  if (!visible.length) return null;
  const selected = visible.find(d => d.id === PAGE_STATE.employee.selectedId);
  return selected || visible[0];
}

function renderEmployeeView() {
  getBaseline();
  const summary = document.getElementById('employeeSummary');
  const controls = document.getElementById('employeeControls');
  const filters = document.getElementById('employeeCatFilters');
  const preview = document.getElementById('employeePreview');
  const search = document.getElementById('employeeSearch');
  const highlight = document.getElementById('employeeHighlight');
  const undo = document.getElementById('employeeUndo');
  const status = document.getElementById('employeeSaveState');
  if (!summary || !controls || !filters || !preview || !search || !highlight || !undo || !status) return;

  const visible = getVisibleEmployeeDrinks();
  const active = D.filter(d => !d.soldOut).length;
  const soldOut = D.filter(d => d.soldOut).length;
  const catCount = Object.keys(groupBy(D, d => d.cat)).length;
  const changedCount = D.filter(d => hasDrinkChanged(d)).length;
  summary.innerHTML = '';
  renderStatPill(summary, 'Active', String(active));
  renderStatPill(summary, 'Sold out', String(soldOut));
  renderStatPill(summary, 'Categories', String(catCount));
  renderStatPill(summary, 'Changed', String(changedCount), changedCount ? 'up' : '');

  search.value = PAGE_STATE.employee.search;
  search.oninput = () => {
    PAGE_STATE.employee.search = search.value;
    renderEmployeeView();
  };

  highlight.textContent = `Highlight changes: ${PAGE_STATE.employee.highlightChanges ? 'on' : 'off'}`;
  highlight.onclick = () => {
    PAGE_STATE.employee.highlightChanges = !PAGE_STATE.employee.highlightChanges;
    renderEmployeeView();
  };

  undo.onclick = () => {
    const ok = undoLastMarketChange();
    if (ok) {
      queueSaveState('saved', 'Reverted last change');
      renderEmployeeView();
      showToast('Reverted last change', 'success');
    } else {
      showToast('Nothing to undo', 'warn');
    }
  };

  queueSaveState(PAGE_STATE.employee.saveState);

  const cats = ['all', ...new Set(D.map(d => d.cat))];
  filters.innerHTML = cats.map(cat => `<button class="range-chip ${PAGE_STATE.employee.selectedCat === cat ? 'active' : ''}" data-cat="${cat}">${escapeHtml(cat === 'all' ? 'All categories' : cat.replace('-', ' '))}</button>`).join('');
  filters.querySelectorAll('[data-cat]').forEach(btn => {
    btn.addEventListener('click', () => {
      PAGE_STATE.employee.selectedCat = btn.dataset.cat;
      if (PAGE_STATE.employee.selectedCat !== 'all') {
        const first = getVisibleEmployeeDrinks()[0];
        if (first) PAGE_STATE.employee.selectedId = first.id;
      }
      renderEmployeeView();
    });
  });

  const previewDrink = getEmployeePreviewDrink();
  preview.innerHTML = previewDrink ? `
    <div class="preview-card ${previewDrink.soldOut ? 'sold-out' : ''}">
      <div class="preview-top">
        <div>
          <div class="card-hdr">Selected Drink</div>
          <div class="preview-name">${escapeHtml(previewDrink.n)}</div>
          <div class="preview-sub">${escapeHtml(previewDrink.cat.replace('-', ' '))}</div>
        </div>
        <div class="preview-price">${formatMoney(previewDrink.p)}</div>
      </div>
      <div class="portal-preview-range">${buildPricePositionMarkup(previewDrink)}</div>
      <div class="preview-grid">
        <div><span>Normal sale</span><strong>${formatMoney(previewDrink.b)}</strong></div>
        <div><span>Floor</span><strong>${formatMoney(previewDrink.floor)}</strong></div>
        <div><span>Ceiling</span><strong>${formatMoney(previewDrink.ceiling)}</strong></div>
        <div><span>Status</span><strong>${previewDrink.soldOut ? 'Sold out' : 'Live'}</strong></div>
      </div>
    </div>
  ` : '<div class="empty-state">No drinks match this search.</div>';

  const catsGrouped = groupBy(visible, d => d.cat);
  controls.innerHTML = Object.keys(catsGrouped).length ? Object.entries(catsGrouped).map(([cat, items]) => `
    <section class="employee-category" data-cat="${escapeHtml(cat)}">
        <div class="employee-category-head">
          <div>
            <div class="employee-category-name">${escapeHtml(cat.replace('-', ' '))}</div>
            <div class="employee-category-sub">${items.length} drinks · ${items.filter(d => d.soldOut).length} sold out</div>
          </div>
          <div class="employee-category-actions">
            <button data-cat-action="soldout" data-cat="${escapeHtml(cat)}">Mark sold out</button>
            <button data-cat-action="reset" data-cat="${escapeHtml(cat)}">Reset category</button>
            <button data-cat-action="floor-down" data-cat="${escapeHtml(cat)}">Floor -</button>
            <button data-cat-action="floor-up" data-cat="${escapeHtml(cat)}">Floor +</button>
            <button data-cat-action="ceiling-down" data-cat="${escapeHtml(cat)}">Ceiling -</button>
          <button data-cat-action="ceiling-up" data-cat="${escapeHtml(cat)}">Ceiling +</button>
        </div>
      </div>
      <div class="employee-drinks">
        ${items.map(d => renderEmployeeDrinkRow(d)).join('')}
      </div>
    </section>
  `).join('') : '<div class="empty-state">No drinks match this search.</div>';

  controls.querySelectorAll('[data-drink-row]').forEach(row => {
    row.addEventListener('click', (event) => {
      if (event.target.closest('input, select, button, label')) return;
      PAGE_STATE.employee.selectedId = row.dataset.drinkRow;
      renderEmployeeView();
    });
  });

  controls.querySelectorAll('[data-field]').forEach(el => {
    if (el.tagName === 'INPUT' || el.tagName === 'SELECT') {
      el.addEventListener('focus', () => {
        const id = el.dataset.id;
        PAGE_STATE.employee.selectedId = id;
      });
    }
  });

  controls.querySelectorAll('input, select').forEach(el => {
    const apply = () => {
      const id = el.dataset.id;
      const field = el.dataset.field;
      const drink = D.find(item => item.id === id);
      if (!drink) return;
      const patch = {};
      if (field === 'name' || field === 'cat') patch[field] = el.value;
      if (field === 'salePrice' || field === 'floor' || field === 'ceiling') patch[field] = Number(el.value);
      if (field === 'soldOut') patch.soldOut = el.checked;
      const next = normalizeDrinkPatch(drink, patch);
      PAGE_STATE.employee.saveState = 'unsaved';
      queueSaveState('unsaved');
      clearTimeout(PAGE_STATE.employee.dirtyTimer);
      PAGE_STATE.employee.dirtyTimer = setTimeout(() => {
        PAGE_STATE.employee.saveState = 'saving';
        if (field === 'cat') {
          commitEmployeeEdit(id, next, `Updated ${drink.n}`);
        } else {
          commitEmployeeEdit(id, next, `Updated ${drink.n}`);
        }
      }, 350);
    };

    if (el.type === 'checkbox' || el.tagName === 'SELECT') {
      el.addEventListener('change', apply);
    } else {
      el.addEventListener('input', apply);
    }
  });

  controls.querySelectorAll('[data-step]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const field = btn.dataset.field;
      const dir = Number(btn.dataset.step);
      const drink = D.find(item => item.id === id);
      if (!drink) return;
      const current = field === 'salePrice' ? drink.b : drink[field];
      const patch = {};
      patch[field] = +(Number(current) + dir).toFixed(2);
      const next = normalizeDrinkPatch(drink, patch);
      PAGE_STATE.employee.saveState = 'saving';
      commitEmployeeEdit(id, next, `Adjusted ${drink.n}`);
    });
  });

  controls.querySelectorAll('[data-reset-drink]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.resetDrink;
      const drink = DRINKS.find(item => item.id === id);
      if (!drink) return;
      commitEmployeeEdit(id, {
        name: drink.n,
        cat: drink.cat,
        salePrice: drink.b,
        floor: +(drink.b * 0.65).toFixed(2),
        ceiling: +(drink.b * 1.65).toFixed(2),
        soldOut: false,
      }, `Reset ${drink.n}`);
    });
  });

  controls.querySelectorAll('[data-cat-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.cat;
      const action = btn.dataset.catAction;
      const items = D.filter(d => d.cat === cat);
      if (!items.length) return;
      if (action === 'soldout') {
        commitCategoryEdit(cat, () => {
          MARKET_SETTINGS.categories[cat] = {
            ...(MARKET_SETTINGS.categories[cat] || { label: cat.replace('-', ' ') }),
            soldOut: true,
          };
          items.forEach(d => {
            MARKET_SETTINGS.drinks[d.id] = {
              ...(MARKET_SETTINGS.drinks[d.id] || {}),
              soldOut: true,
            };
          });
        }, `${cat.replace('-', ' ')} sold out`);
      }
      if (action === 'reset') {
        commitCategoryEdit(cat, () => {
          MARKET_SETTINGS.categories[cat] = {
            label: cat.replace('-', ' '),
            soldOut: false,
          };
          DRINKS.filter(d => d.cat === cat).forEach(src => {
            MARKET_SETTINGS.drinks[src.id] = {
              name: src.n,
              cat: src.cat,
              salePrice: src.b,
              floor: +(src.b * 0.65).toFixed(2),
              ceiling: +(src.b * 1.65).toFixed(2),
              soldOut: false,
            };
          });
        }, `${cat.replace('-', ' ')} reset`);
      }
      if (action === 'floor-up' || action === 'floor-down' || action === 'ceiling-up' || action === 'ceiling-down') {
        const field = action.startsWith('floor') ? 'floor' : 'ceiling';
        const delta = action.endsWith('up') ? PAGE_STEP : -PAGE_STEP;
        commitCategoryEdit(cat, () => {
          items.forEach(d => {
            const source = MARKET_SETTINGS.drinks[d.id] || {};
            const current = Number(source[field] ?? d[field]);
            source[field] = +Math.max(SAFE_PRICE_MIN, current + delta).toFixed(2);
            MARKET_SETTINGS.drinks[d.id] = source;
          });
        }, `${cat.replace('-', ' ')} ${field} adjusted`);
      }
    });
  });

  controls.querySelectorAll('[data-drink-row]').forEach(row => {
    if (PAGE_STATE.employee.highlightChanges && hasDrinkChanged(D.find(d => d.id === row.dataset.drinkRow))) {
      row.classList.add('changed');
    }
    if (PAGE_STATE.employee.selectedId === row.dataset.drinkRow) {
      row.classList.add('selected');
    }
  });

  status.textContent = PAGE_STATE.employee.saveState === 'saved' ? 'Saved' : PAGE_STATE.employee.saveState === 'saving' ? 'Saving…' : 'Unsaved';
  status.className = `save-pill ${PAGE_STATE.employee.saveState}`;
}

function renderEmployeeDrinkRow(d) {
  const changed = PAGE_STATE.employee.highlightChanges && hasDrinkChanged(d);
  const warning = d.floor >= d.ceiling ? 'Floor must stay below ceiling' : '';
  const selected = PAGE_STATE.employee.selectedId === d.id ? 'selected' : '';
  return `
    <article class="employee-row ${d.soldOut ? 'sold-out' : ''} ${changed ? 'changed' : ''} ${selected}" data-drink-row="${escapeHtml(d.id)}" tabindex="0">
      <div class="employee-main">
        <div class="employee-name-row">
          <input class="employee-name" data-field="name" data-id="${escapeHtml(d.id)}" value="${escapeHtml(d.n)}">
          <label class="toggle inline">
            <input type="checkbox" data-field="soldOut" data-id="${escapeHtml(d.id)}" ${d.soldOut ? 'checked' : ''}>
            <span>${d.soldOut ? 'Sold out' : 'Live'}</span>
          </label>
        </div>
        <select class="employee-cat" data-field="cat" data-id="${escapeHtml(d.id)}">
          ${[...new Set(DRINKS.map(item => item.cat))].map(cat => `<option value="${escapeHtml(cat)}" ${cat === d.cat ? 'selected' : ''}>${escapeHtml(cat.replace('-', ' '))}</option>`).join('')}
        </select>
        <div class="employee-note ${warning ? 'warn' : ''}">${warning || (changed ? 'Changed from opening snapshot' : 'Matches opening snapshot')}</div>
      </div>
      <div class="employee-grid">
        ${stepperField('Normal sale price', 'salePrice', d.id, d.b)}
        ${stepperField('Floor', 'floor', d.id, d.floor)}
        ${stepperField('Ceiling', 'ceiling', d.id, d.ceiling)}
      </div>
      <div class="employee-actions">
        <button data-reset-drink="${escapeHtml(d.id)}">Revert</button>
        <div class="mini-status">${d.o} orders</div>
      </div>
    </article>
  `;
}

function stepperField(label, field, id, value) {
  return `
    <label class="stepper">
      <span>${escapeHtml(label)}</span>
      <div class="stepper-row">
        <button type="button" data-step="-${PAGE_STEP}" data-field="${field}" data-id="${escapeHtml(id)}">−</button>
        <input type="number" step="0.01" data-field="${field}" data-id="${escapeHtml(id)}" value="${Number(value).toFixed(2)}">
        <button type="button" data-step="${PAGE_STEP}" data-field="${field}" data-id="${escapeHtml(id)}">+</button>
      </div>
    </label>
  `;
}

function downloadText(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadManagerExport(kind, rows) {
  if (kind === 'json') {
    downloadText(`night-economy-sales-${Date.now()}.json`, JSON.stringify(rows, null, 2), 'application/json');
    return;
  }
  const header = ['time', 'drink', 'category', 'type', 'prev', 'price'];
  const csv = [
    header.join(','),
    ...rows.map(row => [
      new Date(row.t).toISOString(),
      row.n,
      row.cat,
      row.type,
      row.prev,
      row.price,
    ].map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');
  downloadText(`night-economy-sales-${Date.now()}.csv`, csv, 'text/csv');
}

function refreshAuxViews() {
  const view = getAppView();
  if (view === 'site') renderSiteView();
  if (view === 'mobile') renderMobileView();
  if (view === 'portal') renderPortalView();
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

  window.addEventListener('focus', () => {
    if (getAppView() === 'mobile') renderMobileView();
  });

  window.refreshAuxViews = refreshAuxViews;

  document.addEventListener('keydown', (event) => {
    const viewNow = getAppView();
    if (event.key === '/' && viewNow === 'portal') {
      const inputId = 'portalDrinkSearch';
      const input = document.getElementById(inputId);
      if (input) {
        event.preventDefault();
        input.focus();
        input.select();
      }
    }

    if (viewNow === 'portal' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) {
      const visible = getVisibleEmployeeDrinks();
      if (!visible.length) return;
      const currentIndex = Math.max(0, visible.findIndex(d => d.id === PAGE_STATE.employee.selectedId));
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        const next = visible[Math.min(visible.length - 1, currentIndex + 1)];
        PAGE_STATE.employee.selectedId = next ? next.id : visible[0].id;
        renderPortalView();
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        const prev = visible[Math.max(0, currentIndex - 1)];
        PAGE_STATE.employee.selectedId = prev ? prev.id : visible[0].id;
        renderPortalView();
      }
      if (event.key === 'Escape') {
        PAGE_STATE.employee.search = '';
        PAGE_STATE.employee.selectedCat = 'all';
        renderPortalView();
      }
    }

    if (viewNow === 'site' || viewNow === 'mobile') {
      handlePanelArrowScroll(event);
    }
  });

  setInterval(() => {
    const viewNow = getAppView();
    if (viewNow === 'portal') refreshAuxViews();
  }, 1500);
}

document.addEventListener('DOMContentLoaded', initAppPages);
