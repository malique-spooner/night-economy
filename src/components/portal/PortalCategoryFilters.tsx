import { portalCategoryLabel } from "./portalHelpers";

type Props = {
  activeCategory: string | null;
  categories: string[];
  onCategoryChange: (category: string | null) => void;
};

export function PortalCategoryFilters({ activeCategory, categories, onCategoryChange }: Props) {
  return (
    <div className="portal-filter-row">
      <button aria-pressed={activeCategory === null} className={`range-chip ${activeCategory === null ? "active" : ""}`} type="button" onClick={() => onCategoryChange(null)}>All drinks</button>
      {categories.map(category => (
        <button aria-pressed={activeCategory === category} className={`range-chip ${activeCategory === category ? "active" : ""}`} type="button" key={category} onClick={() => onCategoryChange(category)}>
          {portalCategoryLabel(category)}
        </button>
      ))}
    </div>
  );
}
