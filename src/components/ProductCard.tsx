import { ArrowUpRight, Check, Heart, Plus, Scale, Star } from "lucide-react";
import type { Product } from "../types";
import { discount, money } from "../lib/catalogue";
import { Link } from "react-router";
import { productPath } from "../lib/products";
import { ProductImage } from "./ProductImage";

export function ProductCard({
  product: p,
  saved,
  compared,
  toggleSaved,
  toggleCompared,
  linkState,
  add,
}: {
  product: Product;
  saved: boolean;
  compared: boolean;
  toggleSaved: () => void;
  toggleCompared: () => void;
  linkState: { from: string };
  add: () => void;
}) {
  const sale = discount(p);
  return (
    <article className="product-card">
      <div className="product-image-wrap">
        <Link
          className="product-image-link"
          to={productPath(p.id, p.source)}
          state={linkState}
          aria-label={`View ${p.name}`}
        >
          <ProductImage
            media={{ src: p.image, label: "Main photo" }}
            name={p.name}
          />
        </Link>
        {p.badge && (
          <span
            className={`product-badge ${p.badge === "New arrival" ? "new" : ""}`}
          >
            {p.badge}
          </span>
        )}
        <button
          className={`save-button ${saved ? "is-saved" : ""}`}
          onClick={toggleSaved}
          aria-label={`${saved ? "Unsave" : "Save"} ${p.name}`}
          aria-pressed={saved}
        >
          <Heart size={17} fill={saved ? "currentColor" : "none"} />
        </button>
        <Link
          className="quick-view"
          to={productPath(p.id, p.source)}
          state={linkState}
          tabIndex={-1}
          aria-hidden="true"
        >
          Take a closer look <ArrowUpRight size={15} />
        </Link>
      </div>
      <div className="product-info">
        <div className="product-meta">
          <span>
            {p.brand} <span className="dot">·</span> {p.category}
          </span>
          <span className="rating">
            <Star size={12} fill="currentColor" />
            {p.rating.toFixed(1)} <span>({p.reviewCount})</span>
          </span>
        </div>
        <h3>
          <Link to={productPath(p.id, p.source)} state={linkState}>
            {p.name}
          </Link>
        </h3>
        <p className="product-tagline">
          {Object.entries(p.specs)
            .slice(0, 2)
            .map(([, value]) => value)
            .join(" · ")}
        </p>
        <div className="product-price-row">
          <div className="product-prices">
            <strong>{money(p.price)}</strong>
            {sale > 0 && (
              <>
                <del>{money(p.originalPrice!)}</del>
                <span className="sale-label">−{sale}%</span>
              </>
            )}
          </div>
          <span
            className="color-dot"
            style={{ background: p.color }}
            aria-label="Product colour"
          />
        </div>
        <div className="card-actions">
          <button
            className={`compare-toggle ${compared ? "selected" : ""}`}
            onClick={toggleCompared}
            aria-pressed={compared}
            aria-label={`${compared ? "Remove" : "Add"} ${p.name} ${compared ? "from" : "to"} comparison`}
          >
            {compared ? <Check size={15} /> : <Scale size={15} />} Compare
          </button>
          <button
            className="add-button"
            onClick={add}
            disabled={!p.stock}
            aria-label={`Add ${p.name} to bag`}
          >
            {p.stock ? (
              <>
                <Plus size={15} /> Add to bag
              </>
            ) : (
              "Sold out"
            )}
          </button>
        </div>
      </div>
    </article>
  );
}
