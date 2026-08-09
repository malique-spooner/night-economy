export const siteHero = {
  kicker: "A live drinks market for venues",
  title: "A drinks market guests can play.",
  copy: "Live prices. More reasons to explore the menu. Always within your limits.",
  stats: ["Live prices", "Price limits", "One shared market"],
  footnote: "Designed for bars, hotels, members clubs, and hospitality groups",
} as const;

export const siteReasons = [
  {
    number: "01",
    title: "More to talk about",
    copy: "A social reason to look up and explore the menu.",
  },
  {
    number: "02",
    title: "Demand in motion",
    copy: "Recent sales shape the next live prices.",
  },
  {
    number: "03",
    title: "Limits you set",
    copy: "Every price stays inside your approved range.",
  },
] as const;

export const siteProductSlides = [
  { tone: "display", label: "Room display", copy: "Live prices, shared by the room." },
  { tone: "mobile", label: "Guest menu", copy: "The market in every guest’s hand." },
  { tone: "portal", label: "Venue controls", copy: "Choose the drinks and their limits." },
  { tone: "event", label: "One connected market", copy: "Every surface stays in sync." },
] as const;

export const defaultSitePlanId = "growth";
