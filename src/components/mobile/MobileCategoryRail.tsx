import { useEffect, useState } from "react";

type Props = {
  categories: Array<{
    id: string;
    label: string;
  }>;
};

export function MobileCategoryRail({ categories }: Props) {
  const [activeId, setActiveId] = useState(categories[0]?.id ?? "");
  const categoryIdsKey = categories.map(category => category.id).join("|");

  function scrollToCategory(id: string) {
    setActiveId(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  useEffect(() => {
    const sections = categories.map(category => document.getElementById(category.id)).filter((section): section is HTMLElement => Boolean(section));
    if (!sections.length) return;
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible) setActiveId(visible.target.id);
    }, { rootMargin: "-24% 0px -66% 0px", threshold: 0 });
    sections.forEach(section => observer.observe(section));
    return () => observer.disconnect();
  }, [categoryIdsKey]);

  return (
    <nav className="mobile-rail" aria-label="Menu categories">
      {categories.map((category, index) => (
        <button
          aria-controls={category.id}
          aria-current={activeId === category.id ? "location" : undefined}
          className={`mobile-rail-chip ${activeId === category.id ? "active" : ""}`}
          onClick={() => scrollToCategory(category.id)}
          type="button"
          key={category.id}
        >
          <CategoryIcon label={category.label} />
          <span>{category.label}</span>
        </button>
      ))}
    </nav>
  );
}

function CategoryIcon({ label }: { label: string }) {
  const common = { "aria-hidden": true as const, fill: "none", stroke: "currentColor", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, strokeWidth: 1.65, viewBox: "0 0 24 24" };
  const key = label.toLowerCase();
  if (key.includes("beer")) return <svg {...common}><path d="M7 3h10l-1 17H8L7 3Z" /><path d="M8 7h8M17 7h2a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-1M10 1v3m4-3v3" /></svg>;
  if (key.includes("cocktail") || key.includes("spritz")) return <svg {...common}><path d="M3 5h18l-7 8v6h-4v-6L3 5Z" /><path d="M8 9h8m-7 10h6" /></svg>;
  if (key.includes("wine")) return <svg {...common}><path d="M7 3h10v5a5 5 0 0 1-10 0V3Z" /><path d="M12 13v7m-4 1h8m-9-15h10" /></svg>;
  return <svg {...common}><path d="M8 3h8v5a4 4 0 0 1-8 0V3Z" /><path d="M12 12v8m-4 1h8m-8-13h8" /></svg>;
}
