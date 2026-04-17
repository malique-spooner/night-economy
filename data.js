/* ════════════════════════════════════════════════════════════════════
   MARKET DATA
   ════════════════════════════════════════════════════════════════════ */

const DRINKS = [
  { id: 'em', n: 'Espresso Martini', cat: 'cocktails', b: 8.50, p: 8.50, h: [8.45, 8.48, 8.52, 8.50, 8.55, 8.52, 8.50], o: 0 },
  { id: 'mt', n: 'Mojito', cat: 'cocktails', b: 7.50, p: 7.50, h: [7.48, 7.50, 7.52, 7.50, 7.48, 7.50, 7.50], o: 0 },
  { id: 'nk', n: 'Negroni', cat: 'cocktails', b: 8.00, p: 8.00, h: [7.98, 8.00, 8.02, 8.00, 8.01, 8.00, 8.00], o: 0 },
  { id: 'ot', n: 'Old Fashioned', cat: 'cocktails', b: 8.50, p: 8.50, h: [8.48, 8.50, 8.52, 8.50, 8.51, 8.50, 8.50], o: 0 },
  { id: 'da', n: 'Daiquiri', cat: 'cocktails', b: 7.00, p: 7.00, h: [6.98, 7.00, 7.02, 7.00, 7.01, 7.00, 7.00], o: 0 },
  { id: 'pg', n: 'Pint of Guinness', cat: 'beer', b: 5.50, p: 5.50, h: [5.48, 5.50, 5.52, 5.50, 5.51, 5.50, 5.50], o: 0 },
  { id: 'pl', n: 'Peroni Lager', cat: 'beer', b: 5.00, p: 5.00, h: [4.98, 5.00, 5.02, 5.00, 5.01, 5.00, 5.00], o: 0 },
  { id: 'sb', n: 'San Miguel', cat: 'beer', b: 5.00, p: 5.00, h: [4.98, 5.00, 5.02, 5.00, 5.01, 5.00, 5.00], o: 0 },
  { id: 'wp', n: 'Whisky (Pint)', cat: 'spirits', b: 6.50, p: 6.50, h: [6.48, 6.50, 6.52, 6.50, 6.51, 6.50, 6.50], o: 0 },
  { id: 'vd', n: 'Vodka Double', cat: 'spirits', b: 5.50, p: 5.50, h: [5.48, 5.50, 5.52, 5.50, 5.51, 5.50, 5.50], o: 0 },
  { id: 'rm', n: 'Rum & Coke', cat: 'spirits', b: 5.50, p: 5.50, h: [5.48, 5.50, 5.52, 5.50, 5.51, 5.50, 5.50], o: 0 },
  { id: 'zs', n: 'Zero Sugar Cider', cat: 'zero', b: 4.50, p: 4.50, h: [4.48, 4.50, 4.52, 4.50, 4.51, 4.50, 4.50], o: 0 }
];

const ORDER_WEIGHTS = [0.18, 0.15, 0.14, 0.10, 0.09, 0.08, 0.06, 0.07, 0.05, 0.04, 0.02, 0.02];

const GOSSIP_ITEMS = [
  'Late crowd just arrived — cocktail demand surging',
  'Whisky orders picking up — spirits category heating',
  'Beer sales holding steady — lager popular tonight',
  'Zero sugar options gaining traction — health conscious cohort',
  'Market volatility increasing — unusual trading patterns',
  'Espresso Martini flying off shelves — late night favorite',
  'Pricing pressure on beer — competitive night',
  'Spirits category consolidating — selective demand'
];

const NEWS_MESSAGES = [
  n => `${n} just ordered — price rising · £${DRINKS.find(d => d.id === n)?.p.toFixed(2)} now`,
  n => `Order activity: ${DRINKS.find(d => d.id === n)?.n} catching bids`,
  () => `Unordered drinks decaying — the longer you wait, the cheaper they get`
];
