import { useEffect, useState } from "react";
import type { MarketProduct, Venue } from "../../engine/types";
import { FeaturedProductTile } from "./FeaturedProductTile";
import { BoardDepth } from "./BoardDepth";
import { MarketProductRow } from "./MarketProductRow";
import {
  categoryChangePercent,
  categoryClass,
  categoryLabel,
  getCategoryFeaturedProducts,
  groupProductsByCategory,
  marketBoardLabel,
  productChangePercent,
  sortTvBoardProducts,
  sortTvCategories,
  TV_CATEGORY_PAGE_LIMIT,
} from "./tvHelpers";

type Props = {
  products: MarketProduct[];
  venue: Venue;
};

export function MarketBoard({ products, venue }: Props) {
  const [featureRotation, setFeatureRotation] = useState(0);
  const activeProducts = products.filter(product => product.isLive);
  const groups = sortTvCategories(groupProductsByCategory(activeProducts));
  const pages = groups.flatMap(([category, categoryProducts]) => {
    const sortedProducts = sortTvBoardProducts(categoryProducts);
    const featuredProducts = getCategoryFeaturedProducts(sortedProducts, featureRotation);
    const featuredIds = new Set(featuredProducts.map(product => product.id));
    const rowProducts = sortedProducts.filter(product => !featuredIds.has(product.id));
    // The board has a fixed, tested layout: the feature cards plus nine rows
    // make one complete TV page. Do not use a runtime height measurement here:
    // it can read before the layout settles and split a category unnecessarily.
    const rowsPerPage = Math.max(1, TV_CATEGORY_PAGE_LIMIT - featuredProducts.length);
    const pageCount = Math.max(1, Math.ceil(rowProducts.length / rowsPerPage));
    return Array.from({ length: pageCount }, (_, categoryPageIndex) => ({
      category,
      categoryPageIndex,
      categoryProducts,
      featuredProducts,
      pageCount,
      products: rowProducts.slice(categoryPageIndex * rowsPerPage, (categoryPageIndex + 1) * rowsPerPage),
    }));
  });
  const [pageIndex, setPageIndex] = useState(0);
  const pageKey = pages.map(page => `${page.category}-${page.categoryPageIndex}`).join("|");

  useEffect(() => { setPageIndex(0); }, [pageKey]);
  useEffect(() => {
    if (!pages.length) return undefined;
    const timer = window.setInterval(() => {
      setFeatureRotation(current => current + 1);
      if (pages.length > 1) setPageIndex(current => (current + 1) % pages.length);
    }, 7_000);
    return () => window.clearInterval(timer);
  }, [pages.length]);

  const currentPage = pages[pageIndex % Math.max(pages.length, 1)] ?? { category: "Live market", categoryPageIndex: 0, categoryProducts: [], featuredProducts: [], pageCount: 1, products: [] };
  const { category, categoryPageIndex, categoryProducts, featuredProducts, pageCount, products: boardProducts } = currentPage;
  const categoryChange = categoryChangePercent(categoryProducts);
  const marketEnergy = activeProducts.length
    ? Math.min(1, activeProducts.reduce((total, product) => total + Math.abs(productChangePercent(product)), 0) / activeProducts.length / 10)
    : 0;

  return (
    <div className="board">
      <BoardDepth energy={marketEnergy} />
      <div className="board-hdr">
        <span className="slbl">{marketBoardLabel(venue)}</span>
        <div className="board-view-indicator">
          <span className="board-view-lbl">{categoryLabel(category)} · {categoryPageIndex + 1} / {pageCount}</span>
          <div className="board-dots">
            {groups.map(([groupCategory]) => <div className={`bdot ${groupCategory === category ? "active" : ""}`} key={groupCategory}></div>)}
          </div>
        </div>
        <span className="updt">{venue.name}</span>
      </div>

      <div className="board-featured">
        {featuredProducts.map((product, index) => (
          <FeaturedProductTile currency={venue.currency} product={product} rank={index + 1} key={product.id} />
        ))}
      </div>

      <div className="col-hdr">
        <div className="ch">Drink</div>
        <div className="ch">Price</div>
        <div className="ch">Trend</div>
        <div className="ch">Change</div>
        <div className="ch"></div>
      </div>

      <div className="board-scroll">
        <div className="board-inner">
          <section className="cat-section" key={category}>
            <div className="cat-header">
              <span className={`cat-name ${categoryClass(category)}`}>◆ {categoryLabel(category)}</span>
              <span className="cat-meta">Page {categoryPageIndex + 1} of {pageCount} · {categoryChange >= 0 ? "+" : ""}{categoryChange.toFixed(1)}%</span>
            </div>
            {boardProducts.map(product => <MarketProductRow currency={venue.currency} product={product} key={product.id} />)}
          </section>
        </div>
      </div>
    </div>
  );
}
