export type TvStoryArticleState = "featured" | "rising" | "easing" | "steady";

export type TvStoryArticleOption = {
  id: string;
  label: string;
  state: TvStoryArticleState;
};

const labelsByState: Record<TvStoryArticleState, string[]> = {
  featured: ["Tonight’s tip", "Bar intelligence", "Hot property", "The inside line", "Good taste report", "Notice served", "Crowd favourite", "The board’s pick", "A small obsession", "After-dark dispatch", "The mood board", "Unofficial advice", "The quiet flex", "Worth knowing", "Tonight’s headline"],
  rising: ["Price gossip", "The plot thickens", "A gentle warning", "Upwardly mobile", "The bar is watching", "No small talk", "Market mischief", "A very public glow-up", "The higher ground", "Current affairs", "A little dramatic", "The word is out", "Under pressure", "Night shift news", "The confident one"],
  easing: ["A kinder price", "Value report", "Good news, actually", "The plot softens", "A small mercy", "The smart money", "Bargain behaviour", "A softer landing", "The board blinked", "Useful intelligence", "Keep this quiet", "Late-night logic", "The relief desk", "A friendlier number", "Little win"],
  steady: ["Unbothered", "Calm in the room", "Steady hands", "A rare thing", "No notes", "The reliable one", "Peaceful scenes", "Quiet confidence", "The control group", "Somebody had to", "As you were", "A solid character", "The steady friend", "No plot twist", "Holding pattern"],
};

export const tvStoryArticleOptions: TvStoryArticleOption[] = (Object.entries(labelsByState) as Array<[TvStoryArticleState, string[]]>).flatMap(([state, labels]) => (
  labels.map((label, index) => ({ id: `${state}-${index + 1}`, label, state }))
));

// Start with the full editorial library enabled so a long-running board has
// genuine variety. The TV's category selector—not the number enabled—keeps
// the on-screen mix at 4 easing : 3 featured : 2 steady : 1 rising.
export const defaultTvStoryArticleIds = tvStoryArticleOptions.map(article => article.id);

const articleIdSet = new Set(tvStoryArticleOptions.map(article => article.id));

export function normalizeTvStoryArticleIds(value: unknown, fallback = defaultTvStoryArticleIds) {
  if (!Array.isArray(value)) return fallback;
  const valid = [...new Set(value.filter((id): id is string => typeof id === "string" && articleIdSet.has(id)))];
  return valid.length ? valid : fallback;
}
