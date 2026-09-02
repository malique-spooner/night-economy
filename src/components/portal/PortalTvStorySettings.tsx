import { tvStoryArticleOptions, type TvStoryArticleState } from "../../engine/tvStoryArticleSettings";
import { storyArticlePreview } from "../tv/storyArticles";

type Props = {
  disabled?: boolean;
  enabledIds: string[];
  onChange: (enabledIds: string[]) => void;
};

const stateCopy: Record<TvStoryArticleState, { description: string; title: string }> = {
  easing: { title: "Easing prices", description: "Shown most often — the value and better-price stories." },
  featured: { title: "Featured drinks", description: "Second most often — the drinks currently in the spotlight." },
  steady: { title: "Steady prices", description: "Used occasionally when a drink is holding its opening price." },
  rising: { title: "Rising prices", description: "Used sparingly so price increases feel like a real moment." },
};

const displayOrder: TvStoryArticleState[] = ["easing", "featured", "steady", "rising"];

export function PortalTvStorySettings({ disabled = false, enabledIds, onChange }: Props) {
  const enabled = new Set(enabledIds);
  const toggle = (id: string) => {
    const next = new Set(enabled);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };

  return <section className="portal-tv-story-editor" aria-label="TV story articles">
    <header>
      <span>TV story articles</span>
      <h2>What appears beside the market board</h2>
      <p>Choose the editorial labels that can appear on the TV. Easing stories lead the rotation, followed by featured, steady and then rising prices.</p>
    </header>
    <div className="portal-tv-story-groups">
      {displayOrder.map(state => {
        const options = tvStoryArticleOptions.filter(article => article.state === state);
        const selected = options.filter(article => enabled.has(article.id)).length;
        return <section className={`portal-tv-story-group ${state}`} key={state}>
          <div className="portal-tv-story-group-head"><div><strong>{stateCopy[state].title}</strong><small>{stateCopy[state].description}</small></div><b>{selected} on</b></div>
          <div className="portal-tv-story-options">
            {options.map(article => <label className={enabled.has(article.id) ? "is-enabled" : ""} key={article.id} title={storyArticlePreview(article.id) ?? article.label}>
              <input checked={enabled.has(article.id)} disabled={disabled} onChange={() => toggle(article.id)} type="checkbox" />
              <span>{article.label}</span>
            </label>)}
          </div>
        </section>;
      })}
    </div>
    {disabled && <small className="portal-tv-story-access-note">Owner or admin access is required to change TV stories.</small>}
  </section>;
}
