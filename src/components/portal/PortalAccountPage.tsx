import type { Venue } from "../../engine/types";
import type { VenueMemberRole } from "../../api/memberships";

type Props = {
  categories: string[];
  canEditTvStoryCategories: boolean;
  email: string;
  isSignedIn: boolean;
  onTvStoryCategoriesChange: (categories: string[]) => void;
  role: VenueMemberRole | null;
  source: "seed" | "supabase";
  venue: Venue;
};

export function PortalAccountPage({ categories, canEditTvStoryCategories, email, isSignedIn, onTvStoryCategoriesChange, role, source, venue }: Props) {
  const access = source === "seed" ? "Demo access" : role ? `${role[0].toUpperCase()}${role.slice(1)} access` : "No venue access";
  const toggleStoryCategory = (category: string) => {
    const selected = venue.tvStoryCategories.includes(category);
    if (selected && venue.tvStoryCategories.length === 1) return;
    onTvStoryCategoriesChange(selected ? venue.tvStoryCategories.filter(item => item !== category) : [...venue.tvStoryCategories, category]);
  };

  return (
    <section className="portal-page-grid portal-settings-page">
      <header className="portal-settings-heading">
        <span>Venue settings</span>
        <h1>Settings</h1>
        <p>Control the details that apply across your venue and its displays.</p>
      </header>

      <article className="portal-account-card portal-tv-story-settings">
        <span>TV story panel</span>
        <h2>Featured categories</h2>
        <p>The right-hand TV panel uses Cocktails only for now. Add other categories here when you want them included.</p>
        <details>
          <summary>{venue.tvStoryCategories.join(", ")}</summary>
          <div className="portal-tv-category-options">
            {categories.map(category => <label key={category}><input checked={venue.tvStoryCategories.includes(category)} disabled={!canEditTvStoryCategories || (venue.tvStoryCategories.length === 1 && venue.tvStoryCategories.includes(category))} onChange={() => toggleStoryCategory(category)} type="checkbox" /><span>{category}</span></label>)}
          </div>
        </details>
        {!canEditTvStoryCategories && <small>Owner or admin access required to change this.</small>}
      </article>

      <article className="portal-account-card portal-settings-details">
        <h2>Venue</h2>
        <dl className="portal-account-list">
          <div><dt>Venue</dt><dd>{venue.name}</dd></div>
          <div><dt>Timezone</dt><dd>{venue.timezone}</dd></div>
          <div><dt>Currency</dt><dd>{venue.currency}</dd></div>
        </dl>
      </article>

      <article className="portal-account-card portal-settings-details">
        <h2>Access</h2>
        <dl className="portal-account-list">
          <div><dt>Operator</dt><dd>{isSignedIn ? email || "Signed in" : "Not signed in"}</dd></div>
          <div><dt>Permission</dt><dd>{access}</dd></div>
        </dl>
      </article>
    </section>
  );
}
