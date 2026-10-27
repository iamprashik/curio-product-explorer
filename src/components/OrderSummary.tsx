import { useId, type ReactNode } from "react";
import { Check, Tag, X } from "lucide-react";
import { money } from "../lib/catalogue";
import { DELIVERY, type CheckoutQuote } from "../lib/checkout";
import { ProductImage } from "./ProductImage";

export function OrderSummary({
  quote,
  children,
  editBag,
  couponInput,
  onCouponChange,
  onApplyCoupon,
  onRemoveCoupon,
  couponMessage = "",
  disabled = false,
}: {
  quote: CheckoutQuote;
  children?: ReactNode;
  editBag?: () => void;
  couponInput?: string;
  onCouponChange?: (value: string) => void;
  onApplyCoupon?: () => void;
  onRemoveCoupon?: () => void;
  couponMessage?: string;
  disabled?: boolean;
}) {
  const heading = useId();
  const input = useId();
  return (
    <aside className="checkout-summary" aria-labelledby={heading}>
      <div className="checkout-summary-heading">
        <h2 id={heading}>Your good finds</h2>
        {editBag && (
          <button type="button" onClick={editBag} disabled={disabled}>
            Edit bag
          </button>
        )}
      </div>
      <div
        className="checkout-lines"
        role="group"
        aria-label="Order items"
        tabIndex={0}
      >
        {quote.lines.map((line) => (
          <div
            className="checkout-line"
            key={line.productId + ":" + line.variantId}
          >
            <div className="checkout-line-image">
              <ProductImage
                media={{ src: line.image, label: "Product photo" }}
                name={line.name}
              />
              <span aria-label={`${line.quantity} units`}>{line.quantity}</span>
            </div>
            <div className="checkout-line-copy">
              <small>{line.brand}</small>
              <h3>{line.name}</h3>
              <p>{line.variantLabel}</p>
              <span>{money(line.unitPriceCents / 100)} each</span>
            </div>
            <strong>
              {money((line.unitPriceCents * line.quantity) / 100)}
            </strong>
          </div>
        ))}
      </div>
      {onApplyCoupon && (
        <div className="checkout-coupon">
          <label htmlFor={input}>
            <Tag size={15} />
            Have a demo discount code?
          </label>
          <div>
            <input
              id={input}
              aria-describedby={
                couponMessage || quote.couponError
                  ? input + "-message"
                  : undefined
              }
              value={couponInput ?? ""}
              placeholder="Enter code"
              autoComplete="off"
              maxLength={20}
              disabled={disabled}
              onChange={(event) => onCouponChange?.(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onApplyCoupon();
                }
              }}
            />
            <button
              type="button"
              className="outline-button"
              disabled={disabled}
              onClick={onApplyCoupon}
            >
              Apply code
            </button>
          </div>
          {(quote.couponError || couponMessage) && (
            <p id={input + "-message"} className="coupon-message" role="status">
              {quote.couponError || couponMessage}
            </p>
          )}
          {quote.coupon && (
            <div className="applied-coupon">
              <span>{quote.coupon}</span>
              <button
                type="button"
                onClick={onRemoveCoupon}
                disabled={disabled}
                aria-label="Remove discount code"
              >
                <X size={12} />
                Remove
              </button>
            </div>
          )}
          <details className="coupon-help">
            <summary>View demo codes</summary>
            <p>
              <strong>CURIO10</strong> — 10% off a $75+ product subtotal.
              <br />
              <strong>SAVE25</strong> — $25 off a $200+ product subtotal.
              <br />
              One code per demo order.
            </p>
          </details>
        </div>
      )}
      <dl className="checkout-totals">
        <div>
          <dt>Products</dt>
          <dd>{money(quote.subtotalCents / 100)}</dd>
        </div>
        {quote.discountCents > 0 && (
          <div className="checkout-discount">
            <dt>
              <Check size={13} />
              {quote.coupon}
            </dt>
            <dd>−{money(quote.discountCents / 100)}</dd>
          </div>
        )}
        <div>
          <dt>{DELIVERY[quote.delivery].label}</dt>
          <dd>
            {quote.deliveryCents ? money(quote.deliveryCents / 100) : "Free"}
          </dd>
        </div>
        <div className="checkout-total">
          <dt>
            Total <small>USD</small>
          </dt>
          <dd>{money(quote.totalCents / 100)}</dd>
        </div>
      </dl>
      <p className="checkout-tax-note">
        Sample USD prices. Tax is not calculated in this demo.
      </p>
      {children}
    </aside>
  );
}
