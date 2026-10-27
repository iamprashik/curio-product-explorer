import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Heart,
  Minus,
  Plus,
  Scale,
  ShoppingBag,
  Star,
  ZoomIn,
} from "lucide-react";
import type { CartItem, Product, ProductMedia } from "../types";
import { discount, money } from "../lib/catalogue";
import {
  sameVariant,
  selectedVariant,
  variantProduct,
  variantsOf,
} from "../lib/products";
import { Dialog } from "./Dialog";
import { ProductImage } from "./ProductImage";
import { ProductCard } from "./ProductCard";

export function ProductPage({
  product,
  products,
  cart,
  saved,
  compared,
  toggleSaved,
  toggleCompared,
  add,
  back,
  linkState,
}: {
  product: Product;
  products: Product[];
  cart: CartItem[];
  saved: string[];
  compared: string[];
  toggleSaved: (p: Product) => void;
  toggleCompared: (p: Product) => void;
  add: (p: Product, variant?: string, quantity?: number) => void;
  back: () => void;
  linkState: { from: string };
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const variants = variantsOf(product);
  const variant = selectedVariant(
    product,
    new URLSearchParams(location.search).get("variant") ?? undefined,
  );
  const p = variantProduct(product, variant.id);
  const gallery: ProductMedia[] = product.gallery?.length
    ? product.gallery
    : [{ src: product.image, label: "Main photo" }];
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const heading = useRef<HTMLHeadingElement>(null);
  const inBag = cart
    .filter((item) => sameVariant(item, product, variant.id))
    .reduce((n, item) => n + item.quantity, 0);
  const available = Math.max(0, Math.min(99, p.stock) - inBag);
  const safeQuantity = Math.min(quantity, Math.max(1, available));
  const sale = discount(p);
  const related = products
    .filter(
      (item) => item.category === product.category && item.id !== product.id,
    )
    .slice(0, 3);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [product.id]);
  const chooseVariant = (id: string) => {
    const params = new URLSearchParams(location.search);
    params.set("variant", id);
    navigate(location.pathname + "?" + params, {
      replace: true,
      state: location.state,
    });
    setQuantity(1);
  };
  const previous = () =>
    setActive((index) => (index - 1 + gallery.length) % gallery.length);
  const next = () => setActive((index) => (index + 1) % gallery.length);
  return (
    <main className="page-shell product-page" id="product-content">
      <div className="product-page-breadcrumb">
        <button onClick={back}>
          <ArrowLeft size={15} />
          Back to results
        </button>
        <span>/</span>
        <Link
          to={
            "/" +
            (product.source === "dummyjson" ? "?source=dummyjson&" : "?") +
            "category=" +
            encodeURIComponent(product.category)
          }
        >
          {product.category}
        </Link>
        <span>/</span>
        <span>{product.name}</span>
      </div>
      <div className="product-page-grid">
        <section className="product-gallery" aria-label="Product image gallery">
          <button
            className="gallery-main"
            onClick={() => setZoom(true)}
            aria-label={`Enlarge ${gallery[active].label}`}
          >
            <ProductImage
              key={gallery[active].src}
              media={gallery[active]}
              name={product.name}
              priority
            />
            <span className="gallery-zoom">
              <ZoomIn size={15} />
              Closer look
            </span>
            {product.badge && (
              <span className="product-badge">{product.badge}</span>
            )}
          </button>
          <div className="gallery-navigation">
            <span aria-live="polite">
              {gallery[active].label}
              <small>
                {active + 1} / {gallery.length}
              </small>
            </span>
            {gallery.length > 1 && (
              <div>
                <button
                  className="icon-button"
                  aria-label="Previous image"
                  onClick={previous}
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Next image"
                  onClick={next}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </div>
          <div
            className="gallery-thumbnails"
            role="group"
            aria-label="Choose a product image"
          >
            {gallery.map((media, index) => (
              <button
                key={`${media.src}-${index}`}
                className={active === index ? "selected" : ""}
                aria-label={`Show ${media.label}`}
                aria-pressed={active === index}
                onClick={() => setActive(index)}
              >
                <ProductImage media={media} name={product.name} />
                <span>{media.label}</span>
              </button>
            ))}
          </div>
          {product.source !== "dummyjson" && (
            <p className="photo-disclosure">
              Illustrative photo with detail crops. Sample finishes aren’t shown
              in the image.
            </p>
          )}
        </section>
        <section className="product-page-info" aria-labelledby="product-name">
          <div className="product-page-label">
            <span className="eyebrow">
              {p.brand} / {p.category}
            </span>
            <span>
              {product.source === "dummyjson"
                ? "EXTERNAL DEMO"
                : "CURATED PICK"}
            </span>
          </div>
          <h1 id="product-name" ref={heading} tabIndex={-1}>
            {p.name}
          </h1>
          <div className="product-page-rating">
            <Star size={15} fill="currentColor" />
            <strong>{p.rating.toFixed(1)}</strong>
            <span>{p.reviewCount} sample reviews</span>
          </div>
          <div className="product-page-price" aria-live="polite">
            <strong>{money(p.price)}</strong>
            {sale > 0 && (
              <>
                <del>{money(p.originalPrice!)}</del>
                <span className="sale-label">Save {sale}%</span>
              </>
            )}
            <small>USD · sample price</small>
          </div>
          <p className="product-page-description">{p.description}</p>
          <fieldset className="variant-options">
            <legend>
              Choose your option <span>{variant.label}</span>
            </legend>
            <div>
              {variants.map((option) => (
                <label
                  className={variant.id === option.id ? "selected" : ""}
                  key={option.id}
                >
                  <input
                    type="radio"
                    name="product-variant"
                    value={option.id}
                    checked={variant.id === option.id}
                    onChange={() => chooseVariant(option.id)}
                  />
                  {option.color && <i style={{ background: option.color }} />}
                  <span>
                    {option.label}
                    <small>
                      {money(option.price)}
                      {!option.stock ? " · Sold out" : ""}
                    </small>
                  </span>
                  {variant.id === option.id && <Check size={15} />}
                </label>
              ))}
            </div>
          </fieldset>
          <p
            className={`product-page-stock ${p.stock ? "" : "sold-out"}`}
            aria-live="polite"
          >
            <i />
            {p.stock
              ? `${p.stock} available in this option`
              : "This option is currently sold out"}
            {inBag > 0 && <span> · {inBag} in your bag</span>}
          </p>
          <div className="product-purchase">
            <div className="quantity-control">
              <button
                aria-label="Decrease product quantity"
                onClick={() => setQuantity(safeQuantity - 1)}
                disabled={safeQuantity <= 1 || !available}
              >
                <Minus size={16} />
              </button>
              <output aria-label="Product quantity">{safeQuantity}</output>
              <button
                aria-label="Increase product quantity"
                onClick={() => setQuantity(safeQuantity + 1)}
                disabled={safeQuantity >= available}
              >
                <Plus size={16} />
              </button>
            </div>
            <button
              className="primary-button"
              disabled={!available}
              onClick={() => add(product, variant.id, safeQuantity)}
            >
              <ShoppingBag size={17} />
              {!p.stock
                ? "Sold out"
                : !available
                  ? "All available items in bag"
                  : `Add to bag · ${money(Math.round(p.price * safeQuantity * 100) / 100)}`}
            </button>
          </div>
          <div className="product-secondary-actions">
            <button
              className={saved.includes(p.id) ? "selected" : ""}
              aria-pressed={saved.includes(p.id)}
              onClick={() => toggleSaved(product)}
            >
              <Heart
                size={17}
                fill={saved.includes(p.id) ? "currentColor" : "none"}
              />
              {saved.includes(p.id) ? "Saved to your finds" : "Save for later"}
            </button>
            <button
              aria-pressed={compared.includes(p.id)}
              onClick={() => toggleCompared(product)}
            >
              <Scale size={17} />
              {compared.includes(p.id)
                ? "Remove from comparison"
                : "Add to comparison"}
            </button>
          </div>
          <div className="product-demo-note">
            <Check size={16} />
            <p>
              A little room to explore.
              <span>
                Try options, compare finds, and complete a demo order. No
                payment is taken.
              </span>
            </p>
          </div>
          <details className="product-specifications" open>
            <summary>The details that matter</summary>
            <dl>
              {Object.entries(p.specs).map(([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </details>
        </section>
      </div>
      {related.length > 0 && (
        <section className="related-products" aria-labelledby="related-heading">
          <div className="related-heading">
            <div>
              <span className="eyebrow">KEEP YOUR CURIOSITY GOING</span>
              <h2 id="related-heading">A few more good finds.</h2>
            </div>
            <button onClick={back}>
              Back to the collection <ArrowRight size={16} />
            </button>
          </div>
          <div className="product-grid">
            {related.map((item) => (
              <ProductCard
                key={item.id}
                product={item}
                saved={saved.includes(item.id)}
                compared={compared.includes(item.id)}
                toggleSaved={() => toggleSaved(item)}
                toggleCompared={() => toggleCompared(item)}
                linkState={linkState}
                add={() => add(item)}
              />
            ))}
          </div>
        </section>
      )}
      {zoom && (
        <Dialog
          title={`${product.name} — closer look`}
          close={() => setZoom(false)}
          className="gallery-dialog"
        >
          <ProductImage
            key={gallery[active].src}
            media={gallery[active]}
            name={product.name}
            priority
          />
          <div className="zoom-navigation">
            <button
              className="outline-button"
              disabled={gallery.length < 2}
              onClick={previous}
            >
              <ChevronLeft size={16} />
              Previous
            </button>
            <span aria-live="polite">
              {gallery[active].label} · {active + 1} / {gallery.length}
            </span>
            <button
              className="outline-button"
              disabled={gallery.length < 2}
              onClick={next}
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </Dialog>
      )}
    </main>
  );
}
