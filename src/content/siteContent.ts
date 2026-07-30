export const siteHero = {
  kicker: "Live hospitality pricing",
  title: "Make every round feel live.",
  copy: "Connect the room display, guest menu, and operator controls to steer demand without giving up margin control.",
  stats: ["3 synced surfaces", "Operator guardrails", "One live market state"],
  footnote: "Designed for bars, hotels, members clubs, and hospitality groups",
} as const;

export const siteReasons = [
  {
    number: "01",
    title: "Instantly legible",
    copy: "Big prices and clear movement make the board readable from across the bar.",
  },
  {
    number: "02",
    title: "Calm under pressure",
    copy: "Guardrails keep the game lively without letting prices run away.",
  },
  {
    number: "03",
    title: "Guides demand, not just price",
    copy: "Spotlights and events help move guests toward the right drinks at the right time.",
  },
] as const;

export const siteProductSlides = [
  { tone: "display", label: "Room display", copy: "A live market guests can understand from across the room." },
  { tone: "mobile", label: "Guest menu", copy: "The same price and movement, ready to order from a phone." },
  { tone: "portal", label: "Operator controls", copy: "Set floors, ceilings, spotlights, and events from one place." },
  { tone: "event", label: "Market moment", copy: "One operator action moves every connected surface together." },
] as const;

export const defaultSitePlanId = "growth";

export const sitePilotProof = [
  { value: "Order mix", copy: "Compare which products move before, during, and after a market event." },
  { value: "Revenue per guest", copy: "Measure commercial impact against the venue’s own baseline." },
  { value: "Margin protection", copy: "Audit every price movement against operator-set floors and ceilings." },
  { value: "Guest engagement", copy: "Track menu attention and ordering response across the service." },
] as const;

export const siteBuyingAnswers = [
  { question: "How does a pilot work?", answer: "Start with one venue, configure the menu and guardrails, train the operating team, then compare the launch against an agreed baseline." },
  { question: "Do we need new hardware?", answer: "The product is designed for existing web-connected displays, guest phones, and an operator device. Final requirements depend on the venue setup." },
  { question: "What about our POS?", answer: "We map the live menu to the venue’s product catalogue and confirm the integration path during technical discovery before launch." },
  { question: "How are margins protected?", answer: "Operators define price floors, ceilings, and event limits. The market cannot move outside those configured boundaries." },
  { question: "Can it support multiple venues?", answer: "Yes. Group rollout follows a successful pilot so templates, permissions, and reporting can be standardized safely." },
  { question: "What does it cost?", answer: "Pricing depends on venue count, integration needs, and support. The first call is used to scope a transparent pilot proposal." },
] as const;
