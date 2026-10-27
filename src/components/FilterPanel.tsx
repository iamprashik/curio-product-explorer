import { Check, ChevronDown, SlidersHorizontal, Star } from "lucide-react";
import { CATEGORIES, type Filters, type Product } from "../types";
import { activeFilterCount, money, PRICE_LIMIT } from "../lib/catalogue";

export function FilterPanel({
  products,
  filters: f,
  change,
  reset,
}: {
  products: Product[];
  filters: Filters;
  change: (patch: Partial<Filters>) => void;
  reset: () => void;
}) {
  const brands = [...new Set(products.map((p) => p.brand))].sort();
  const active = activeFilterCount(f);
  return (
    <div className="filter-panel">
      <div className="filter-title">
        <h2>
          <SlidersHorizontal size={16} /> Filters{" "}
          {active > 0 && <span className="filter-count">{active}</span>}
        </h2>
        <button className="text-button" onClick={reset}>
          Reset
        </button>
      </div>
      <fieldset className="filter-section">
        <legend>
          Category <ChevronDown size={14} />
        </legend>
        {["All", ...CATEGORIES].map((category) => (
          <label
            className={`category-option ${f.category === category ? "selected" : ""}`}
            key={category}
          >
            <input
              type="radio"
              name="category"
              checked={f.category === category}
              onChange={() =>
                change({ category: category as Filters["category"] })
              }
            />
            <span>{category === "All" ? "All products" : category}</span>
            <span className="category-count">
              {category === "All"
                ? products.length
                : products.filter((p) => p.category === category).length}
            </span>
          </label>
        ))}
      </fieldset>
      <fieldset className="filter-section">
        <legend>
          Price range <ChevronDown size={14} />
        </legend>
        <div className="price-inputs">
          <label>
            <span>Min</span>
            <span className="price-field">
              $
              <input
                aria-label="Minimum price"
                type="number"
                min="0"
                max={f.maxPrice}
                value={f.minPrice}
                onChange={(e) =>
                  change({
                    minPrice: Math.max(
                      0,
                      Math.min(f.maxPrice, Number(e.target.value)),
                    ),
                  })
                }
              />
            </span>
          </label>
          <span className="price-separator">–</span>
          <label>
            <span>Max</span>
            <span className="price-field">
              $
              <input
                aria-label="Maximum price"
                type="number"
                min={f.minPrice}
                max={PRICE_LIMIT}
                value={f.maxPrice}
                onChange={(e) =>
                  change({
                    maxPrice: Math.min(
                      PRICE_LIMIT,
                      Math.max(f.minPrice, Number(e.target.value)),
                    ),
                  })
                }
              />
            </span>
          </label>
        </div>
        <input
          className="price-range"
          aria-label="Maximum price slider"
          type="range"
          min={f.minPrice}
          max={PRICE_LIMIT}
          step="10"
          value={f.maxPrice}
          onChange={(e) => change({ maxPrice: Number(e.target.value) })}
        />
        <div className="range-labels">
          <span>{money(0)}</span>
          <span>{money(PRICE_LIMIT)}</span>
        </div>
      </fieldset>
      <fieldset className="filter-section">
        <legend>
          Brand <ChevronDown size={14} />
        </legend>
        {brands.map((brand) => (
          <label className="check-option" key={brand}>
            <input
              type="checkbox"
              checked={f.brands.includes(brand)}
              onChange={() =>
                change({
                  brands: f.brands.includes(brand)
                    ? f.brands.filter((b) => b !== brand)
                    : [...f.brands, brand],
                })
              }
            />
            <span>{brand}</span>
            <span className="category-count">
              {products.filter((p) => p.brand === brand).length}
            </span>
          </label>
        ))}
      </fieldset>
      <fieldset className="filter-section">
        <legend>
          Customer rating <ChevronDown size={14} />
        </legend>
        {[0, 4, 4.5].map((rating) => (
          <label className="check-option" key={rating}>
            <input
              type="radio"
              name="rating"
              checked={f.minRating === rating}
              onChange={() => change({ minRating: rating })}
            />
            <span>
              {rating ? (
                <>
                  <Star className="gold" size={13} fill="currentColor" />{" "}
                  {rating}
                  {rating === 4 ? ".0" : ""} & up
                </>
              ) : (
                "All ratings"
              )}
            </span>
          </label>
        ))}
      </fieldset>
      <fieldset className="filter-section">
        <legend>
          Good to know <ChevronDown size={14} />
        </legend>
        <label className="check-option">
          <input
            type="checkbox"
            checked={f.dealsOnly}
            onChange={(e) => change({ dealsOnly: e.target.checked })}
          />
          <span>On sale</span>
        </label>
        <label className="check-option">
          <input
            type="checkbox"
            checked={f.inStock}
            onChange={(e) => change({ inStock: e.target.checked })}
          />
          <span>In stock only</span>
        </label>
      </fieldset>
      <div className="filter-note">
        <div className="note-check">
          <Check size={16} />
        </div>
        <strong>A little help deciding?</strong>
        <p>Add up to 3 products to compare the details, side by side.</p>
      </div>
    </div>
  );
}
