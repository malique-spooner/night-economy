/* ════════════════════════════════════════════════════════════════════
   MARKET DATA — The Pickle House
   ════════════════════════════════════════════════════════════════════ */

function h(base) {
  return Array.from({length: 7}, () => +(base + (Math.random() - 0.5) * 0.1).toFixed(2));
}

const DRINKS = [
  // ── BLOODY MARYS ──────────────────────────────────────────────────
  { id: 'cbm',  n: "Classic Bloody Mary",      cat: 'bloody-mary',   b: 12.00, p: 12.00, h: h(12.00), o: 0 },
  { id: 'pca',  n: "Pickled Cactus",           cat: 'bloody-mary',   b: 13.00, p: 13.00, h: h(13.00), o: 0 },
  { id: 'psa',  n: "Pickled Samurai",          cat: 'bloody-mary',   b: 13.00, p: 13.00, h: h(13.00), o: 0 },

  // ── MARGARITAS ────────────────────────────────────────────────────
  { id: 'cmar', n: "Classic Margarita",        cat: 'margarita',     b: 12.00, p: 12.00, h: h(12.00), o: 0 },
  { id: 'smar', n: "Spiced Margarita",         cat: 'margarita',     b: 12.50, p: 12.50, h: h(12.50), o: 0 },
  { id: 'tmar', n: "Tommy's Margarita",        cat: 'margarita',     b: 12.00, p: 12.00, h: h(12.00), o: 0 },
  { id: 'mmar', n: "Mezcal Margarita",         cat: 'margarita',     b: 13.00, p: 13.00, h: h(13.00), o: 0 },

  // ── SPRITZ ────────────────────────────────────────────────────────
  { id: 'asp',  n: "Aperol Spritz",            cat: 'spritz',        b: 11.00, p: 11.00, h: h(11.00), o: 0 },
  { id: 'csp',  n: "Campari Spritz",           cat: 'spritz',        b: 11.00, p: 11.00, h: h(11.00), o: 0 },
  { id: 'hugo', n: "Hugo",                     cat: 'spritz',        b: 12.00, p: 12.00, h: h(12.00), o: 0 },
  { id: 'fsp',  n: "Festive Spritz",           cat: 'spritz',        b: 12.00, p: 12.00, h: h(12.00), o: 0 },

  // ── NEGRONI ───────────────────────────────────────────────────────
  { id: 'cneg', n: "Classic Negroni",          cat: 'negroni',       b: 12.00, p: 12.00, h: h(12.00), o: 0 },
  { id: 'sneg', n: "Sweeter Negroni",          cat: 'negroni',       b: 12.50, p: 12.50, h: h(12.50), o: 0 },
  { id: 'skneg',n: "Smokey Negroni",           cat: 'negroni',       b: 13.00, p: 13.00, h: h(13.00), o: 0 },
  { id: 'clneg',n: "Clear Negroni",            cat: 'negroni',       b: 13.00, p: 13.00, h: h(13.00), o: 0 },

  // ── OLD FASHIONED ─────────────────────────────────────────────────
  { id: 'cof',  n: "Classic Old Fashioned",    cat: 'old-fashioned', b: 12.00, p: 12.00, h: h(12.00), o: 0 },
  { id: 'sof',  n: "Smokey Old Fashioned",     cat: 'old-fashioned', b: 13.00, p: 13.00, h: h(13.00), o: 0 },
  { id: 'oor',  n: "Oink on the Rocks",        cat: 'old-fashioned', b: 13.00, p: 13.00, h: h(13.00), o: 0 },

  // ── ESPRESSO ──────────────────────────────────────────────────────
  { id: 'cem',  n: "Classic Espresso Martini", cat: 'espresso',      b: 12.00, p: 12.00, h: h(12.00), o: 0 },
  { id: 'flc',  n: "Four Leaf Clover",         cat: 'espresso',      b: 12.50, p: 12.50, h: h(12.50), o: 0 },
  { id: 'tfo',  n: "The Fresh One",            cat: 'espresso',      b: 12.00, p: 12.00, h: h(12.00), o: 0 },

  // ── SIGNATURE ─────────────────────────────────────────────────────
  { id: 'tt',   n: "Tide & Tempest",           cat: 'signature',     b: 13.00, p: 13.00, h: h(13.00), o: 0 },
  { id: 't75',  n: "The 75th Peel",            cat: 'signature',     b: 14.00, p: 14.00, h: h(14.00), o: 0 },
  { id: 'mny',  n: "3461 Miles From NY",       cat: 'signature',     b: 14.00, p: 14.00, h: h(14.00), o: 0 },
  { id: 'cfr',  n: "Caesar Fell Off The Rack", cat: 'signature',     b: 13.00, p: 13.00, h: h(13.00), o: 0 },
  { id: 'cmm',  n: "Collin Met Martin",        cat: 'signature',     b: 13.00, p: 13.00, h: h(13.00), o: 0 },
  { id: 'pa',   n: "Pink Affair",              cat: 'signature',     b: 13.00, p: 13.00, h: h(13.00), o: 0 },
  { id: 'mz',   n: "Manzana",                  cat: 'signature',     b: 13.00, p: 13.00, h: h(13.00), o: 0 },
  { id: 'cr',   n: "Cielo Rosa",               cat: 'signature',     b: 13.00, p: 13.00, h: h(13.00), o: 0 },
  { id: 'chc',  n: "Chancellor's Choice",      cat: 'signature',     b: 13.00, p: 13.00, h: h(13.00), o: 0 },
  { id: 'witw', n: "Whisky In The Wild",       cat: 'signature',     b: 13.00, p: 13.00, h: h(13.00), o: 0 },
  { id: 'ktf',  n: "Keep The Fruit",           cat: 'signature',     b: 14.00, p: 14.00, h: h(14.00), o: 0 },
  { id: 'lwj',  n: "Last Word Judgement",      cat: 'signature',     b: 14.00, p: 14.00, h: h(14.00), o: 0 },

  // ── MOCKTAILS ─────────────────────────────────────────────────────
  { id: 'wb',   n: "Woodland Bloom",           cat: 'mocktail',      b: 8.00,  p: 8.00,  h: h(8.00),  o: 0 },
  { id: 'hbg',  n: "Holborn's Garden",         cat: 'mocktail',      b: 8.00,  p: 8.00,  h: h(8.00),  o: 0 },
  { id: 'ngr',  n: "No-Groni",                 cat: 'mocktail',      b: 8.00,  p: 8.00,  h: h(8.00),  o: 0 },
  { id: 'ans',  n: "Aper-No Spritz",           cat: 'mocktail',      b: 8.00,  p: 8.00,  h: h(8.00),  o: 0 },
  { id: 'wbp',  n: "Bloody Pickle (0%)",       cat: 'mocktail',      b: 8.00,  p: 8.00,  h: h(8.00),  o: 0 },
];

const ORDER_WEIGHTS = [
  // bloody-mary (3)
  0.06, 0.05, 0.05,
  // margarita (4)
  0.07, 0.06, 0.05, 0.05,
  // spritz (4)
  0.07, 0.05, 0.04, 0.04,
  // negroni (4)
  0.06, 0.05, 0.05, 0.04,
  // old-fashioned (3)
  0.05, 0.04, 0.04,
  // espresso (3)
  0.08, 0.05, 0.04,
  // signature (12)
  0.06, 0.05, 0.06, 0.05, 0.04, 0.04, 0.04, 0.05, 0.04, 0.04, 0.03, 0.04,
  // mocktail (5)
  0.02, 0.02, 0.02, 0.02, 0.02,
];

const CULTURAL_BLURBS = {
  cbm:  'Zubrowka + BM Mix + tomato · the Pickle House original · celery and two olives',
  pca:  'Mezcal + cactus mix · avocado garnish · the south-of-the-border Mary',
  psa:  'Toki Suntory + pickled ginger + carrot · East meets the bloody glass',
  cmar: 'Espolon + Cointreau + sour · half salt rim · the Mexican benchmark',
  smar: 'Tabasco heat in every sip · chilli slice + spicy rim · for those who want fire',
  tmar: "Tommy's agave riff · no Cointreau · just tequila, sour, and agave",
  mmar: 'Mezcal smoke over sour + Cointreau · lime twist · the complex sibling',
  asp:  'Aperol + Prosecco + soda · orange on orange · the aperitivo hour',
  csp:  'Campari + Prosecco + soda · the more bitter sibling · orange twist',
  hugo: 'St Germain + gin + elderflower + Prosecco · the Alpine classic',
  fsp:  'Manchester Marmalade + festive syrup + Prosecco · the seasonal special',
  cneg: 'Tanqueray + Campari + Lillet Rose · the trinity · stir 20–25 seconds',
  sneg: "Warner's Rhubarb + Campari + rhubarb syrup · the sweeter side of bitter",
  skneg:'Laphroig + Amaro + Campari + lemon bitters · smoke meets bitter',
  clneg:'Italicus + Tanqueray + Lillet Dry · crystal clear · lemon bitters',
  cof:  'Jameson + brown sugar + Angostura · the original cocktail · stir 20–25s',
  sof:  'Laphroig smoke over brown sugar + bitters · the peaty Old Fashioned',
  oor:  'Woodford + maple syrup + Angostura · the Pickle House signature pour',
  cem:  'Zubrowka Vanilla + Tia Maria + Licor 43 + espresso · three coffee beans',
  flc:  'Jameson + Baileys + Guinness Syrup + espresso · the Dublin après',
  tfo:  'Zubrowka Vanilla + Tia Maria + peppermint + espresso · the cool one',
  tt:   'Pussers + Anne Bonny rum duo + OJ + rich sugar + soda · the seafarer',
  t75:  'Tanqueray + OJ + sugar + orange bitters + Champagne · the 75th rework',
  mny:  'Bullet Rye + sour + Pinot Noir foam · 3461 miles of American ambition',
  cfr:  'Appleton + Courvoisier + brown sugar + chocolate bitters · Caesar\'s legacy',
  cmm:  "Martin Miller's + herbed syrup + sour + soda · the garden Collins",
  pa:   'Zubrowka + cherry syrup + cranberry + Champagne · blush and bubbles',
  mz:   'Tanqueray + apple liqueur + apple juice + sour · vegan foam + lime powder',
  cr:   'Dragon Fruit Espolon + elderflower + sour + kafir leaf + chilli · floral heat',
  chc:  'Jameson + Amaro Averna + caramel + orange bitters · the Chancellor\'s pour',
  witw: 'Monkey Shoulder + dry vermouth + Angostura + Maraschino · into the wild',
  ktf:  'Adnams + Tanqueray 10 + Lillet Dry + lemon bitters · discard the lemon',
  lwj:  'Tanqueray + Chartreuse + sour + Maraschino · the final round',
  wb:   'Cranberry + apple + orange + passionfruit + sour · the full-flavour zero',
  hbg:  "Apple + elderflower + sour + mint + cucumber · Holborn's garden zero",
  ngr:  'Anon Nogroni + Tanqueray 0% · the sophisticated alcohol-free bitter',
  ans:  'Anon Bitter Sweet + zero Prosecco + soda · all the ritual, none of the spirit',
  wbp:  'BM Mix + sour + tomato juice · the designated driver\'s Bloody Mary',
};

const BOARD_VIEWS = [
  { label: 'COCKTAILS',        ids: ['cbm','pca','cmar','mmar','cneg','skneg','cof','oor'] },
  { label: 'SIGNATURES',       ids: ['tt','t75','mny','cfr','pa','cr','chc','lwj'] },
  { label: 'ESPRESSO · SPRITZ',ids: ['cem','flc','tfo','asp','csp','hugo','cmm','ktf'] },
  { label: 'ZERO · MORE',      ids: ['wb','hbg','ngr','ans','wbp','smar','tmar','psa'] },
];
