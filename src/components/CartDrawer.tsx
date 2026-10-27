import {
  ArrowRight,
  Check,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import type { CartItem, Product } from "../types";
import { cartTotal, money } from "../lib/catalogue";
import { Dialog } from "./Dialog";
import { cartKey, cartProduct, selectedVariant } from "../lib/products";

export function CartDrawer({
  cart,
  products,
  close,
  change,
  checkout,
  remove,
}: {
  cart: CartItem[];
  products: Product[];
  close: () => void;
  change: (product: Product, quantity: number, variantId?: string) => void;
  checkout: () => void;
  remove: (item: CartItem) => void;
}) {
  const lines = cart
    .map((item) => {
      const base = products.find((p) => p.id === item.productId);
      return { item, base, product: base && cartProduct(base, item) };
    })
    .filter(
      (line): line is { item: CartItem; base: Product; product: Product } =>
        !!line.product && !!line.base && line.product.stock > 0,
    );
  const unavailable = cart.filter(
    (item) => !lines.some((line) => line.item === item),
  );
  const count = lines.reduce(
    (n, line) => n + Math.min(line.item.quantity, line.product.stock),
    0,
  );
  const subtotal = cartTotal(cart, products);
  const savings = lines.reduce(
    (n, { item, product: p }) =>
      n +
      Math.max(0, (p.originalPrice ?? p.price) - p.price) *
        Math.min(item.quantity, p.stock),
    0,
  );
  return (
    <Dialog
      title="Your shopping bag"
      close={close}
      kind="drawer"
      className="cart-drawer"
    >
      {unavailable.length > 0 && (
        <div className="bag-unavailable">
          <p>
            A few saved items are no longer available. They aren’t included in
            your total.
          </p>
          {unavailable.map((item, index) => (
            <div key={cartKey(item)}>
              <span>
                {products.find((p) => p.id === item.productId)?.name ??
                  "Unavailable product"}
                <small> · Unavailable option</small>
              </span>
              <button
                onClick={() => remove(item)}
                aria-label={`Remove unavailable ${products.find((p) => p.id === item.productId)?.name ?? "product"}, item ${index + 1}`}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
      {lines.length ? (
        <>
          <p className="bag-count">
            {count} {count === 1 ? "good find" : "good finds"}, all in one
            place.
          </p>
          <div className="cart-items">
            {lines.map(({ item, base, product: p }) => (
              <div className="cart-line" key={cartKey(item)}>
                <img src={p.image} alt={p.name} width="90" height="90" />
                <div className="cart-line-info">
                  <span className="eyebrow">{p.brand}</span>
                  <h3>{p.name}</h3>
                  <p className="cart-variant">
                    {selectedVariant(base, item.variantId).label}
                  </p>
                  <strong>{money(p.price)}</strong>
                  <div className="cart-line-bottom">
                    <div className="quantity-control">
                      <button
                        onClick={() =>
                          change(
                            base,
                            Math.min(item.quantity, p.stock) - 1,
                            item.variantId,
                          )
                        }
                        aria-label={`Decrease quantity of ${p.name}, ${selectedVariant(base, item.variantId).label}`}
                      >
                        <Minus size={13} />
                      </button>
                      <output
                        aria-label={`Quantity of ${p.name}, ${selectedVariant(base, item.variantId).label}`}
                      >
                        {Math.min(item.quantity, p.stock)}
                      </output>
                      <button
                        onClick={() =>
                          change(base, item.quantity + 1, item.variantId)
                        }
                        disabled={item.quantity >= Math.min(p.stock, 99)}
                        aria-label={`Increase quantity of ${p.name}, ${selectedVariant(base, item.variantId).label}`}
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                    <button
                      className="icon-button remove-item"
                      onClick={() => change(base, 0, item.variantId)}
                      aria-label={`Remove ${p.name}, ${selectedVariant(base, item.variantId).label} from bag`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="cart-summary">
            {savings > 0 && (
              <div className="savings-note">
                <Check size={14} /> A good find: you’re saving{" "}
                {money(Math.round(savings * 100) / 100)}
              </div>
            )}
            <div className="summary-line">
              <span>Subtotal</span>
              <strong>{money(subtotal)}</strong>
            </div>
            <div className="summary-line muted">
              <span>Discounts & delivery</span>
              <span>At checkout</span>
            </div>
            <div className="summary-total">
              <span>Total</span>
              <strong>
                {money(subtotal)} <small>USD</small>
              </strong>
            </div>
            <button
              className="primary-button"
              onClick={checkout}
              disabled={
                unavailable.length > 0 ||
                lines.some((line) => line.item.quantity > line.product.stock)
              }
            >
              Continue to checkout <ArrowRight size={17} />
            </button>
            <p className="demo-note">
              A portfolio shopping experience. No real purchases or payments.
            </p>
          </div>
        </>
      ) : (
        <div className="empty-bag">
          <span className="empty-bag-icon">
            <ShoppingBag size={31} />
          </span>
          <h3>Room for a good find.</h3>
          <p>
            Your bag is empty. Explore the collection and add something you
            love.
          </p>
          <button className="primary-button" onClick={close}>
            Explore the collection <ArrowRight size={17} />
          </button>
        </div>
      )}
    </Dialog>
  );
}
