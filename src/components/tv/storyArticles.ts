import type { MarketProduct } from "../../engine/types";
import { formatMoney } from "../format";
import { formatChangePercent, productTrend } from "./tvHelpers";
import type { TvStoryArticleState } from "../../engine/tvStoryArticleSettings";

type Article = { body: string; headline: string; kicker: string };
type ArticleState = TvStoryArticleState;

// 60 complete stories, deliberately written as individual nightlife-news items.
// Placeholders are replaced with live market values at the moment the item airs.
const articles: Record<ArticleState, Article[]> = {
  featured: [
    { kicker: "Tonight’s tip", headline: "[drink] is wearing the crown tonight.", body: "At [price], it has the room’s attention. [demand]." },
    { kicker: "Bar intelligence", headline: "If the board had a guest list, [drink] would be on it.", body: "The opening call was [opening]; now it is the serve people keep circling back to." },
    { kicker: "Hot property", headline: "[drink] has accidentally become everyone’s plan.", body: "[price] is the current call, and [demand-lower]." },
    { kicker: "The inside line", headline: "[drink] is doing main-character work.", body: "It started at [opening]. The current [price] tells you the room has made its choice." },
    { kicker: "Good taste report", headline: "[drink] is having the kind of night people remember.", body: "[demand] — which explains why [price] is still the number on everyone’s lips." },
    { kicker: "Notice served", headline: "[drink] is not here to blend in.", body: "The market has it at [price], with the opening price sitting back at [opening]." },
    { kicker: "Crowd favourite", headline: "[drink] has found its people.", body: "The room is keeping it in the conversation; [demand-lower]." },
    { kicker: "The board’s pick", headline: "[drink] is the recommendation you did not ask for.", body: "But at [price], it is a very convincing one. [demand]." },
    { kicker: "A small obsession", headline: "[drink] has become a recurring thought.", body: "It opened at [opening], and the room is still giving it plenty of oxygen." },
    { kicker: "After-dark dispatch", headline: "[drink] is making a case for ‘one more’.", body: "[price] is the live call. [demand]." },
    { kicker: "The mood board", headline: "[drink] is exactly where the night is at.", body: "Its opening price was [opening]; the current market is writing a more interesting chapter." },
    { kicker: "Unofficial advice", headline: "Do not overthink [drink].", body: "It is featured for a reason: [demand-lower], with [price] on the board." },
    { kicker: "The quiet flex", headline: "[drink] has made being popular look effortless.", body: "There is no need for a speech—the price is [price] and the room is doing the rest." },
    { kicker: "Worth knowing", headline: "[drink] is the bar’s current best-kept non-secret.", body: "[demand] while it trades at [price]." },
    { kicker: "Tonight’s headline", headline: "[drink] has the spotlight. Try not to stare.", body: "The room is moving around it, and [price] is the latest market call." },
  ],
  rising: [
    { kicker: "Price gossip", headline: "[drink] has developed expensive taste.", body: "It is [change] from opening and now sits [position]. [demand]." },
    { kicker: "The plot thickens", headline: "[drink] is heading north with purpose.", body: "From [opening] to [price], this is not a subtle little move." },
    { kicker: "A gentle warning", headline: "[drink] is getting ideas above its glass.", body: "[change] from opening. [demand] and the board has responded." },
    { kicker: "Upwardly mobile", headline: "[drink] has entered its ambitious era.", body: "The current call is [price]. It is [position]." },
    { kicker: "The bar is watching", headline: "[drink] is making the other drinks nervous.", body: "It has moved [change] since opening, with [demand-lower]." },
    { kicker: "No small talk", headline: "[drink] is climbing without asking permission.", body: "[price] is the number now; [opening] was merely the introduction." },
    { kicker: "Market mischief", headline: "[drink] has chosen confidence tonight.", body: "[demand] and the price is up [change] from where it began." },
    { kicker: "A very public glow-up", headline: "[drink] is looking rather pleased with itself.", body: "The board puts it at [price], [change] clear of opening." },
    { kicker: "The higher ground", headline: "[drink] has taken the scenic route upward.", body: "It is now [position], and [demand-lower]." },
    { kicker: "Current affairs", headline: "[drink] is raising the bar. Literally.", body: "Opening at [opening], it is now called at [price]." },
    { kicker: "A little dramatic", headline: "[drink] has made an entrance on the board.", body: "[change] from opening is enough to make people look twice." },
    { kicker: "The word is out", headline: "[drink] is no longer pretending to be affordable.", body: "[demand] as it trades [position]." },
    { kicker: "Under pressure", headline: "[drink] is handling popularity beautifully.", body: "The price has moved to [price], up [change] from opening." },
    { kicker: "Night shift news", headline: "[drink] is making upward movement look easy.", body: "It started at [opening]; the live price is now [price]." },
    { kicker: "The confident one", headline: "[drink] is not doing modesty tonight.", body: "[demand] and the market has added [change] to its opening call." },
  ],
  easing: [
    { kicker: "A kinder price", headline: "[drink] has decided to be generous.", body: "It is [change] from opening, currently called at [price]." },
    { kicker: "Value report", headline: "[drink] is having a surprisingly approachable moment.", body: "The opening was [opening]; the board now says [price]." },
    { kicker: "Good news, actually", headline: "[drink] has taken the pressure off.", body: "[demand] while its price sits [change] from opening." },
    { kicker: "The plot softens", headline: "[drink] has come back down to earth.", body: "It is trading at [price]—a gentler number than the [opening] opening call." },
    { kicker: "A small mercy", headline: "[drink] is being very reasonable right now.", body: "[change] from opening, with [demand-lower]." },
    { kicker: "The smart money", headline: "[drink] is quietly making a better case for itself.", body: "The live call is [price], below its [opening] starting point." },
    { kicker: "Bargain behaviour", headline: "[drink] has chosen charm over drama.", body: "The price has eased [change], and the room is noticing." },
    { kicker: "A softer landing", headline: "[drink] is giving guests a little breathing room.", body: "[price] is the current number. [demand]." },
    { kicker: "The board blinked", headline: "[drink] is suddenly easier to say yes to.", body: "It opened at [opening] and is now [change] from that call." },
    { kicker: "Useful intelligence", headline: "[drink] is having a value-led plot twist.", body: "[demand] as the price settles at [price]." },
    { kicker: "Keep this quiet", headline: "[drink] is the kind of deal people pretend they found by accident.", body: "It is [change] from its [opening] opening price." },
    { kicker: "Late-night logic", headline: "[drink] has made the case for a second round.", body: "The market has softened to [price], with [demand-lower]." },
    { kicker: "The relief desk", headline: "[drink] has loosened its tie.", body: "It is now [price], down [change] from opening." },
    { kicker: "A friendlier number", headline: "[drink] is meeting the room halfway.", body: "[demand] while it trades below the [opening] starting point." },
    { kicker: "Little win", headline: "[drink] has become the sensible rebel.", body: "It is [change] from opening, and that makes [price] look rather good." },
  ],
  steady: [
    { kicker: "Unbothered", headline: "[drink] refuses to be dramatic.", body: "It is still [price]. [demand]." },
    { kicker: "Calm in the room", headline: "[drink] is keeping its cool.", body: "No price theatrics here: [price] remains the call." },
    { kicker: "Steady hands", headline: "[drink] has not changed its mind.", body: "It opened at [opening] and is staying right there for now." },
    { kicker: "A rare thing", headline: "[drink] is behaving itself.", body: "The board still reads [price], while [demand-lower]." },
    { kicker: "No notes", headline: "[drink] is holding the line like a professional.", body: "It remains at [price]; nothing to see here except excellent restraint." },
    { kicker: "The reliable one", headline: "[drink] is not chasing headlines tonight.", body: "[price] is unchanged from opening, and honestly, fair enough." },
    { kicker: "Peaceful scenes", headline: "[drink] has opted out of the drama.", body: "[demand] but the live call remains [price]." },
    { kicker: "Quiet confidence", headline: "[drink] is exactly where it meant to be.", body: "The price is still [price], the same as the opening call." },
    { kicker: "The control group", headline: "[drink] is providing stability for the rest of us.", body: "At [price], it has not moved an inch since opening." },
    { kicker: "Somebody had to", headline: "[drink] is keeping the market grounded.", body: "While others make a scene, it stays at [price]." },
    { kicker: "As you were", headline: "[drink] is still doing exactly what it says on the tin.", body: "[demand] and the price remains [price]." },
    { kicker: "A solid character", headline: "[drink] has chosen consistency.", body: "It began at [opening] and has stayed there, no fuss required." },
    { kicker: "The steady friend", headline: "[drink] is not about to make this complicated.", body: "[price] is the opening price and the current price. Efficient." },
    { kicker: "No plot twist", headline: "[drink] remains beautifully predictable.", body: "The board’s live number is [price]; [demand-lower]." },
    { kicker: "Holding pattern", headline: "[drink] is taking the scenic route to nowhere.", body: "It is still [price], which is precisely where the night started." },
  ],
};

export function storyArticlePreview(id: string) {
  const match = /^(featured|rising|easing|steady)-(\d+)$/.exec(id);
  if (!match) return null;
  const article = articles[match[1] as ArticleState][Number(match[2]) - 1];
  return article ? `${article.headline} ${article.body}` : null;
}

export function storyArticle(product: MarketProduct, storyIndex: number, currency: string, marketPosition: string, demandSignal: string, enabledIds: string[]) {
  const state: ArticleState = product.priority ? "featured" : productTrend(product) === "up" ? "rising" : productTrend(product) === "dn" ? "easing" : "steady";
  const enabledArticles = articles[state].filter((_, index) => enabledIds.includes(`${state}-${index + 1}`));
  const article = (enabledArticles.length ? enabledArticles : articles[state])[(stableNumber(product.id) + storyIndex) % (enabledArticles.length || articles[state].length)];
  const values: Record<string, string> = {
    "[drink]": product.name,
    "[price]": formatMoney(product.currentPriceMinor, currency),
    "[opening]": formatMoney(product.basePriceMinor, currency),
    "[change]": formatChangePercent(product),
    "[position]": marketPosition,
    "[demand]": demandSignal,
    "[demand-lower]": lowerFirst(demandSignal),
  };
  const fill = (text: string) => Object.entries(values).reduce((result, [token, value]) => result.replaceAll(token, value), text);

  return {
    kicker: article.kicker,
    headline: fill(article.headline),
    copy: fill(article.body),
    factLabel: state === "rising" ? "Move from opening" : "Opening price",
    factValue: state === "rising" ? formatChangePercent(product) : formatMoney(product.basePriceMinor, currency),
  };
}

function lowerFirst(value: string) {
  return value ? `${value[0].toLowerCase()}${value.slice(1)}` : value;
}

function stableNumber(value: string) {
  return [...value].reduce((total, character) => total + character.charCodeAt(0), 0);
}
