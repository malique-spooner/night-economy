// Source: TLJ-DRINKS-BOOKLET-6.pdf (25 February 2026).
// Every priced line from the booklet is represented here. The Old Fashioned has
// no printed price; £13 is the venue-consistent provisional catalogue price.

const menu = [
  ...items("Cocktails", [
    ["New York Sour", 14], ["Pink Affair", 14], ["Jalapeno, Mint Julip", 12], ["Chancellor's Choice", 13], ["Collin Met Martin", 12], ["Manzana", 12], ["The 75th Peel", 12], ["Sarti Sour", 12],
    ["Whisky in the Wild", 13], ["Keep the Fruit.", 10], ["The Last Word Judgment", 14], ["Tide & Tempest", 12],
    ["Classic Negroni", 11], ["Sweet Negroni", 12], ["Smoky Negroni", 14], ["Clear Negroni", 11],
    ["Classic Margarita", 12], ["How Spicy? Margarita", 13], ["How Tommy Does It Margarita", 12.5], ["Better Than Tequila Margarita", 14],
    ["Aperol Spritz", 12], ["Campari Spritz", 12], ["Hugo Spritz", 12], ["Pimm's No.1 Spritz", 11], ["Sarti Spritz", 10],
    ["Classic Bloody Mary", 13], ["Cactus Bloody Mary", 15], ["Samurai Bloody Mary", 15],
    ["Classic Espresso", 11], ["Four Leaf Espresso", 12], ["After 8 Espresso", 12], ["Old Fashioned", 13],
  ]),
  ...items("Mocktails", [["Woodland Bloom", 8], ["Holborn Fields", 8], ["Bloody Nora", 8]]),
  ...items("Champagne", [
    ["Laure D'Echarmes Brut NV (125ml)", 12.9, "1003JB-125"], ["Laure D'Echarmes Brut NV (Bottle)", 65, "1003JB-BTL"], ["Louis Regnier Grand Reserve Rosé (Bottle)", 69, "1080LC"], ["Delamotte Brut NV (Bottle)", 75, "1006CB"], ["Heidsieck & Co Monopole Blue Top Brut (Bottle)", 75, "1005SM"], ["Bollinger NV (Bottle)", 99, "1026CB"], ["Bollinger Rosé (Bottle)", 120, "1025CB"], ["Laurent-Perrier Cuvee Rosé Brut (Bottle)", 130, "1020CB"], ["Dom Perignon (Bottle)", 250, "1060CB"], ["Cristal Louis Roederer (Bottle)", 425, "1070CB"],
  ]),
  ...items("Sparkling Wine", [
    ["Bottega Gold Prosecco 200ml", 9.5, "1170JB"], ["Bottega Rosé Prosecco 200ml", 9.5, "1171JB"], ["Prosecco Terre del Doge (125ml)", 7.25, "1149JB-125"], ["Prosecco Terre del Doge (Bottle)", 37.5, "1149JB-BTL"], ["Prosecco Rosé Vigana (Bottle)", 37.5, "1148JB"], ["Cremant Charles de Saint-Ceran Brut (Bottle)", 39, "1160CB"], ["Cava Joan Brut Reserva (Bottle)", 42, "1250CB"],
  ]),
  ...wineItems("Rosé Wine", [
    ["La Brouette Producteurs Plaimont IGP Comte, France", "4168CB", 7.9, 10.25, 29.5], ["Pinot Grigio Rose Marajo, Italy", "4161HT", 7.9, 10.25, 29.5], ["Henri Galliard Côtes de Provence", "4174JB", 9.9, 13.5, 39],
  ]),
  ...items("Rosé Wine", [["Source Gabriel Rose AOC Côtes de Provence (Bottle)", 45, "4170CB"], ["Balfour Nannette's, England (Bottle)", 49, "4177JB"], ["Whispering Angel Chateau d'Esclans Côtes de Provence (Bottle)", 65, "4190JB"]]),
  ...wineItems("Red Wine", [
    ["Merlot El Picador, Chile", "3635HT", 7.9, 10.25, 29.5], ["Shiraz Puertas Antiguas, Chile", "3640CB", 7.9, 10.25, 29.5], ["Jack & Gina Zinfandel", "3880JB", 7.9, 10.25, 29.5], ["Pinot Noir Sanziana Recas Cramele, Romania", "3850CB", 9.9, 13.5, 39], ["Rioja Marques Concordia, Spain", "3505JB", 9.9, 13.5, 39], ["Malbec Chamuyo Mendoza Vineyards, Argentina", "3650CB", 9.9, 13.5, 39], ["Muchietto IGT Primitivo del Salento, Italy", "3418CB", 10.9, 14.75, 42],
  ]),
  ...items("Red Wine", [["Cabernet Sauvignon DM. Saissac, France (Bottle)", 39, "3030CB"], ["Pinot Noir Les Lys de Leon Loire, France (Bottle)", 39, "3040CB"], ["Montepulciano d'Abruzzo Roccastella, Italy (Bottle)", 39, "3413CB"], ["Soraie IGT Baby Amarone Veneto Cecilia Berretta (Bottle)", 39, "3465CB"], ["Belezos Rioja Crianza, Spain (Bottle)", 39, "3525CB"], ["Belezos Rioja Reserva, Spain (Bottle)", 50, "3530CB"], ["Pinot Noir Eradus, NZ (Bottle)", 55, "3710CB"], ["Chateau Barrail du Blanc Grand Cru St Emilion (Bottle)", 72, "3365CB"], ["Belezos Rioja Gran Reserva, Spain (Bottle)", 85, "3535CB"]]),
  ...wineItems("White Wine", [
    ["Jack & Gina Chardonnay, USA", "2730JB", 7.9, 10.25, 29.5], ["Rioja Blanco Bodegas Muerza, Spain", "2605HT", 7.9, 10.25, 29.5], ["Pinot Grigio Ca'Tesore Venize, Italy", "2538HT", 7.9, 10.25, 29.5], ["Horgelus Gros Manseng Sauvignon Blanc, France", "2020JB", 7.9, 10.25, 29.5], ["Picpoul de Pinet Cuvee, France", "2031JB", 9.9, 13.5, 39], ["Cloud Island Sauvignon Blanc, NZ", "2810L", 9.9, 13.5, 39], ["Vinho Verde Tongue Twister, Portugal", "2607HT", 11.25, 15.25, 45], ["Columbia Estate Chardonnay, France", "2890JB", 11.25, 15.25, 45],
  ]),
  ...items("White Wine", [["Sauvignon Blanc/Rueda Vina Garedo Grupo Yllera, Spain (Bottle)", 39, "2640CB"], ["Les Lys de Leon Sauvignon Blanc Loire, France (Bottle)", 39, "2150CB"], ["Pecorino Roccastella, Italy (Bottle)", 39, "2542CB"], ["Fiano Muchietto Puglia, Italy (Bottle)", 39, "2548CB"], ["Pazo La Maza Albarino Adegas Galegas do Rias Baixas (Bottle)", 45, "2610CB"], ["Gavid di Gavi Fratelli Antonio E, Italy (Bottle)", 45, "2545CB"], ["Macon Burgundy Blanc Vignerons des Terres Secretes (Bottle)", 45, "2210JB"], ["Sancerre Domaine de la Grande Maison Chaumeau-Balland Loire (Bottle)", 55, "2120CB"]]),
  ...items("Vodka", [["Belvedere (25ml)", 5.5], ["Ciroc (25ml)", 5.5], ["Grey Goose (25ml)", 5.9], ["Zubrowka Biala (25ml)", 4.9], ["Zubrowka Vanilla (25ml)", 4.9]]),
  ...items("Liqueurs", [["Baileys (50ml)", 5.95], ["Campari (50ml)", 5.95], ["Chartreuse Green (50ml)", 12.5], ["Martini Dry (50ml)", 5.95], ["Martini Rosso (50ml)", 5.95], ["Pimm's No.1 (50ml)", 5.95], ["Tia Maria (50ml)", 5.95]]),
  ...items("Tequila", [["Cascabel Coffee (25ml)", 4.9], ["Espolon Blanc (25ml)", 4.9], ["Patron Silver (25ml)", 6.9], ["Quiquiriqui Mezcal (25ml)", 6.9], ["Don Julio Reposado (25ml)", 7.25]]),
  ...items("Gin", [["Bombay Sapphire (25ml)", 4.5], ["Brockman's Premium (25ml)", 4.9], ["Hendrick's (25ml)", 4.9], ["Malfy Con Arancia (25ml)", 4.9], ["Malfy Con Limone (25ml)", 4.9], ["Malfy Rosa (25ml)", 4.9], ["Roku Japan (25ml)", 5.9], ["Sipsmiths London Dry (25ml)", 4.9], ["Tanqueray (25ml)", 4.5], ["Tanqueray Ten (25ml)", 4.9], ["Warner's Rhubarb (25ml)", 4.9]]),
  ...items("Rum", [["Anne Bonney (25ml)", 5.5], ["Appleton Rum (25ml)", 4.5], ["Bacardi (25ml)", 4.5], ["Diplomatico Reserva Exclusiva (25ml)", 5.9], ["Gosling's Black Seal (25ml)", 4.5], ["Havana Club Rum Especial (25ml)", 4.5], ["Koko Kanu (25ml)", 4.5], ["Pussers Blue Label Rum (25ml)", 4.9], ["Sailor Jerry (25ml)", 4.5], ["The Kraken Black Spiced (25ml)", 4.5]]),
  ...items("Whiskey", [["Balvenie 12 Yr Double Wood (25ml)", 6.5], ["Balvenie 14 Yr Caribbean Cask (25ml)", 8.9], ["Bulleit Rye (25ml)", 4.9], ["Bushmills (25ml)", 4.5], ["Dalwhinnie 15 Yr Single Malt (25ml)", 5.9], ["Dalmore 12 Yr (25ml)", 12.5], ["Glenfiddich 12 Yr Single Malt (25ml)", 5.9], ["Glenfiddich 15 Yr Single Malt (25ml)", 9], ["Glenfiddich 18 Yr Single Malt (25ml)", 11.9], ["Jack Daniels (25ml)", 4.5], ["Jameson (25ml)", 4.5], ["Johnnie Walker Black (25ml)", 4.9], ["Johnnie Walker Blue (25ml)", 19], ["Laphroaig Islay Single Malt (25ml)", 5.9], ["Macallan Sherry Cask 12 Yr (25ml)", 9.5], ["Macallan 15 Yr (25ml)", 15.9], ["Macallan 18 Yr (25ml)", 27], ["Makers Mark Bourbon (25ml)", 4.5], ["Monkey Shoulder (25ml)", 4.9], ["Nikka From the Barrel (25ml)", 7.5], ["Southern Comfort (25ml)", 4.5], ["Suntory Toki (25ml)", 5.5], ["Suntory Chita (25ml)", 7.9], ["Suntory Hibiki (25ml)", 12.5], ["Woodford Reserve (25ml)", 4.9]]),
  ...items("Cognac & Armagnac", [["Courvoisier VS (25ml)", 4.5], ["Martell VS (25ml)", 4.5], ["Remy Martin VSOP (25ml)", 5.9]]),
  ...items("Mixers", [["Double Dutch Tonic", 3.5], ["Double Dutch Lime Tonic", 3.5], ["Double Dutch Ginger Ale", 3.5], ["Double Dutch Ginger Beer", 3.5], ["Fever Tree Lemon Tonic", 3.5], ["Fever Tree Light Mediterranean", 3.5], ["London Essence Pink Grapefruit Soda", 3.5], ["London Essence White Peach & Jasmine", 3.5], ["Red Bull Energy 250ml", 4.9]]),
  ...items("Soft Drinks", [["Coca Cola", 4.5], ["Diet Coke", 3.9], ["Coke Zero", 3.9], ["Lemonade", 4.5]]),
  ...items("Juices", [["Eager Apple", 3.9], ["Eager Cranberry", 3.9], ["Eager Orange", 3.9], ["Eager Pineapple", 3.9], ["Big Tom Tomato Juice", 4.2]]),
  ...items("Water", [["Harrogate Still 330ml", 3.9], ["Harrogate Still 750ml", 5.5], ["Harrogate Sparkling 330ml", 3.9], ["Harrogate Sparkling 750ml", 5.5]]),
  ...items("Beer Draft", [["Camden Hells Pint", 6.5], ["Beavertown Neck Oil Pint", 7], ["Brixton Reliance Pale Ale Pint", 6.8], ["Guinness Pint", 6.8], ["Kronenbourg 1664 Pint", 6.5], ["Peroni Nastro Azzurro Pint", 6.9], ["Asahi Super Dry Pint", 7], ["Camden Pale Ale Pint", 6.7], ["BrewDog Punk IPA Pint", 6.9], ["Meantime London Lager Pint", 6.6]]),
  ...items("Beer Cask", [["Timothy Taylor Landlord Pint", 6.1], ["Harvey's Sussex Best Pint", 5.9], ["Fuller's London Pride Pint", 6], ["Adnams Ghost Ship Pint", 6.2], ["Hobgoblin Gold Pint", 5.9], ["St Austell Proper Job Pint", 6.2]]),
  ...items("Beer 0%", [["Lucky Saint 0.5% Bottle", 5.8], ["Guinness 0.0% Can", 5.8], ["Peroni Libera 0.0% Bottle", 5.5], ["Heineken 0.0% Bottle", 5.3], ["BrewDog Punk AF Can", 5.5]]),
];

const initiallyLiveNames = new Set([
  // A deliberately short TV market: eight familiar choices per main category.
  "Guinness Pint", "Camden Hells Pint", "Beavertown Neck Oil Pint", "Brixton Reliance Pale Ale Pint", "Peroni Nastro Azzurro Pint", "Asahi Super Dry Pint", "Lucky Saint 0.5% Bottle", "Guinness 0.0% Can", "Kronenbourg 1664 Pint", "BrewDog Punk IPA Pint", "Camden Pale Ale Pint", "Heineken 0.0% Bottle",
  "Classic Espresso", "Classic Margarita", "Classic Negroni", "Aperol Spritz", "Sarti Spritz", "Old Fashioned", "Classic Bloody Mary", "Woodland Bloom", "Pink Affair", "The 75th Peel", "Hugo Spritz", "How Spicy? Margarita",
  "Grey Goose (25ml)", "Bombay Sapphire (25ml)", "Tanqueray (25ml)", "Bacardi (25ml)", "Havana Club Rum Especial (25ml)", "Jack Daniels (25ml)", "Jameson (25ml)", "Espolon Blanc (25ml)", "Hendrick's (25ml)", "Patron Silver (25ml)", "Sailor Jerry (25ml)", "Johnnie Walker Black (25ml)",
  "Prosecco Terre del Doge (Bottle)", "Laure D'Echarmes Brut NV (Bottle)", "La Brouette Producteurs Plaimont IGP Comte, France (Bottle)", "Pinot Grigio Rose Marajo, Italy (Bottle)", "Merlot El Picador, Chile (Bottle)", "Rioja Marques Concordia, Spain (Bottle)", "Pinot Grigio Ca'Tesore Venize, Italy (Bottle)", "Horgelus Gros Manseng Sauvignon Blanc, France (Bottle)", "Cloud Island Sauvignon Blanc, NZ (Bottle)", "Malbec Chamuyo Mendoza Vineyards, Argentina (Bottle)", "Picpoul de Pinet Cuvee, France (Bottle)", "Whispering Angel Chateau d'Esclans Côtes de Provence (Bottle)",
]);

export const tljCatalogue = menu.map(([category, name, price, sourceSku], index) => {
  const externalId = `pos_tlj_${slug(category)}_${slug(name)}`;
  const classification = classify(category, name);
  return {
    id: externalId,
    externalId,
    sku: sourceSku ?? `TLJ-${String(index + 1).padStart(3, "0")}`,
    name,
    ...classification,
    basePriceMinor: Math.round(price * 100),
    initiallyLive: initiallyLiveNames.has(name),
    demandWeight: demandFor(category, name),
  };
});

function items(category, rows) { return rows.map(([name, price, sku]) => [category, name, price, sku]); }
function wineItems(category, rows) {
  return rows.flatMap(([name, sku, small, medium, bottle]) => [
    [category, `${name} (175ml)`, small, `${sku}-175`], [category, `${name} (250ml)`, medium, `${sku}-250`], [category, `${name} (Bottle)`, bottle, `${sku}-BTL`],
  ]);
}
function slug(value) { return value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""); }
function demandFor(category, name) {
  if (category === "Cocktails") return name.includes("Espresso") || name.includes("Margarita") || name.includes("Spritz") ? 2 : 1;
  if (category.startsWith("Beer")) return /Guinness|Peroni|Camden Hells|Neck Oil|Asahi|Lucky Saint/.test(name) ? 1.8 : 1;
  if (category.includes("Wine") || category === "Champagne") return name.includes("Bottle") ? 0.2 : name.includes("175ml") ? 1 : 0.65;
  if (["Vodka", "Liqueurs", "Tequila", "Gin", "Rum", "Whiskey", "Cognac & Armagnac"].includes(category)) return /Macallan 18|Johnnie Walker Blue|Chartreuse/.test(name) ? 0.35 : 1;
  if (category === "Mocktails") return 0.7;
  return 0.55;
}

function classify(sourceCategory, name) {
  if (sourceCategory === "Mocktails") return { category: "Cocktails", subcategory: "Alcohol-free", productGroup: name, serveSize: null };
  if (sourceCategory === "Cocktails") {
    const subcategory = name.includes("Negroni") ? "Negroni" : name.includes("Margarita") ? "Margaritas" : name.includes("Spritz") ? "Spritz" : name.includes("Bloody Mary") ? "Bloody Mary" : name.includes("Espresso") ? "Espresso" : name === "Old Fashioned" ? "Old Fashioned" : "Signatures";
    return { category: "Cocktails", subcategory, productGroup: name, serveSize: null };
  }
  if (["Champagne", "Sparkling Wine", "Rosé Wine", "Red Wine", "White Wine"].includes(sourceCategory)) {
    const serveSize = name.match(/\((125ml|175ml|250ml|Bottle)\)/)?.[1] ?? (name.includes("200ml") ? "200ml" : "Bottle");
    return { category: "Wine", subcategory: sourceCategory.replace(" Wine", ""), productGroup: name.replace(/ \((125ml|175ml|250ml|Bottle)\)$/, ""), serveSize };
  }
  if (["Vodka", "Liqueurs", "Tequila", "Gin", "Rum", "Whiskey", "Cognac & Armagnac"].includes(sourceCategory)) return { category: "Spirits", subcategory: sourceCategory, productGroup: name, serveSize: name.match(/\((25ml|50ml)\)/)?.[1] ?? null };
  if (sourceCategory.startsWith("Beer ")) return { category: "Beer", subcategory: sourceCategory.slice(5), productGroup: name, serveSize: null };
  return { category: "Other Drinks", subcategory: sourceCategory, productGroup: name, serveSize: null };
}
