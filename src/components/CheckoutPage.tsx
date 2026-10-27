import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  LoaderCircle,
  MapPin,
  ShoppingBag,
  Sparkles,
  Truck,
  UserRound,
} from "lucide-react";
import type { CartItem, Product } from "../types";
import {
  checkoutQuote,
  cleanDetails,
  COUNTRIES,
  couponDiscount,
  DEMO_DETAILS,
  DELIVERY,
  EMPTY_DETAILS,
  FREE_DELIVERY_CENTS,
  isCheckoutValues,
  normalizedCoupon,
  quoteSignature,
  validateDetails,
  type CheckoutField,
  type CheckoutValues,
  type DeliveryMethod,
} from "../lib/checkout";
import { makeOrder, type DemoOrder } from "../lib/orders";
import { money } from "../lib/catalogue";
import { OrderSummary } from "./OrderSummary";

const DRAFT_KEY = "curio.checkout-draft.v3";
function readDraft(): CheckoutValues {
  try {
    const raw: unknown = JSON.parse(
      sessionStorage.getItem(DRAFT_KEY) ?? "null",
    );
    if (isCheckoutValues(raw)) return raw;
  } catch {
    /* Optional draft. */
  }
  return { ...EMPTY_DETAILS };
}
function Field({
  name,
  label,
  values,
  errors,
  change,
  type = "text",
  autoComplete,
  required = true,
}: {
  name: CheckoutField;
  label: string;
  values: CheckoutValues;
  errors: Partial<Record<CheckoutField, string>>;
  change: (name: CheckoutField, value: string) => void;
  type?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <div className="checkout-field">
      <label htmlFor={"checkout-" + name}>
        {label}
        {!required && <span>Optional</span>}
      </label>
      <input
        id={"checkout-" + name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        maxLength={
          name === "email"
            ? 160
            : name === "address1" || name === "address2"
              ? 200
              : name === "postalCode"
                ? 20
                : 100
        }
        required={required}
        value={values[name]}
        onChange={(event) => change(name, event.target.value)}
        aria-invalid={!!errors[name]}
        aria-describedby={errors[name] ? "error-" + name : undefined}
      />
      {errors[name] && (
        <p id={"error-" + name} className="field-error">
          {errors[name]}
        </p>
      )}
    </div>
  );
}
export function CheckoutPage({
  cart,
  products,
  loading,
  refreshProducts,
  placeOrder,
  editBag,
  continueShopping,
}: {
  cart: CartItem[];
  products: Product[];
  loading: boolean;
  refreshProducts: (ids: string[], signal: AbortSignal) => Promise<Product[]>;
  placeOrder: (order: DemoOrder, expectedCart: CartItem[]) => void;
  editBag: () => void;
  continueShopping: () => void;
}) {
  const [values, setValues] = useState(readDraft);
  const [delivery, setDelivery] = useState<DeliveryMethod>("standard");
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState("");
  const [couponMessage, setCouponMessage] = useState("");
  const [errors, setErrors] = useState<Partial<Record<CheckoutField, string>>>(
    {},
  );
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);
  const quote = checkoutQuote(cart, products, delivery, coupon);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    return () => controller.current?.abort();
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(values));
    } catch {
      /* Optional tab-local draft. */
    }
  }, [values]);
  const change = (name: CheckoutField, value: string) => {
    const next = { ...values, [name]: value };
    setValues(next);
    if (Object.keys(errors).length) setErrors(validateDetails(next));
    setMessage("");
  };
  const applyCoupon = () => {
    const result = couponDiscount(quote.subtotalCents, couponInput);
    if (result.error) {
      setCouponMessage(result.error);
      return;
    }
    setCoupon(normalizedCoupon(couponInput));
    setCouponInput(normalizedCoupon(couponInput));
    setCouponMessage(couponInput.trim() ? "Demo code applied." : "");
    setMessage("");
  };
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const invalid = validateDetails(values);
    setErrors(invalid);
    setMessage("");
    if (Object.keys(invalid).length) {
      document.getElementById("checkout-" + Object.keys(invalid)[0])?.focus();
      return;
    }
    if (!quote.lines.length || quote.issues.length || quote.couponError) {
      setMessage(
        quote.couponError ||
          "Please review the items in your bag before continuing.",
      );
      requestAnimationFrame(() => messageRef.current?.focus());
      return;
    }
    pending.current = true;
    setBusy(true);
    const abort = new AbortController();
    controller.current = abort;
    const timeout = window.setTimeout(() => abort.abort(), 15000);
    const expected = cart.map((item) => ({ ...item }));
    try {
      const fresh = await refreshProducts(
        cart.map((item) => item.productId),
        abort.signal,
      );
      if (abort.signal.aborted) return;
      const updated = checkoutQuote(expected, fresh, delivery, coupon);
      if (updated.issues.length || updated.couponError)
        throw new Error(updated.issues[0] || updated.couponError);
      if (quoteSignature(updated) !== quoteSignature(quote))
        throw new Error(
          "Prices or product details have changed. Review the updated order summary, then place your demo order again.",
        );
      // The parent checks the live bag again before writing the order and clearing it.
      placeOrder(makeOrder(updated, cleanDetails(values)), expected);
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        /* Saved order is already durable. */
      }
    } catch (error) {
      if (abort.signal.aborted)
        setMessage(
          "The collection check was interrupted. Your bag is unchanged; please try again.",
        );
      else
        setMessage(
          error instanceof Error
            ? error.message
            : "The demo order could not be saved. Please try again.",
        );
      requestAnimationFrame(() => messageRef.current?.focus());
    } finally {
      window.clearTimeout(timeout);
      pending.current = false;
      setBusy(false);
    }
  }
  const regionRequired = ["CA", "US"].includes(values.country);
  if (!cart.length)
    return (
      <main className="page-shell commerce-page" id="commerce-content">
        <div className="commerce-empty">
          <ShoppingBag size={36} />
          <h1 ref={heading} tabIndex={-1}>
            A good order starts with a good find.
          </h1>
          <p>Your bag is empty. Add a product to start your demo checkout.</p>
          <button className="primary-button" onClick={continueShopping}>
            Explore the collection <ArrowRight size={16} />
          </button>
        </div>
      </main>
    );
  return (
    <main className="page-shell commerce-page" id="commerce-content">
      <button className="commerce-back" onClick={editBag}>
        <ArrowLeft size={15} />
        Back to your bag
      </button>
      <div className="commerce-heading">
        <div>
          <span className="eyebrow">GOOD FINDS, ONE LAST STEP</span>
          <h1 ref={heading} tabIndex={-1}>
            Make them yours<span>.</span>
          </h1>
          <p>A few details, then you’re all set for a demo order.</p>
        </div>
        <ol className="checkout-progress" aria-label="Checkout progress">
          <li>
            <Check size={13} />
            Bag
          </li>
          <li aria-current="step">
            <span>2</span>Details & review
          </li>
          <li>
            <span>3</span>Confirmation
          </li>
        </ol>
      </div>
      <form
        className="checkout-layout"
        noValidate
        onSubmit={submit}
        aria-label="Demo checkout"
      >
        <div className="checkout-details">
          <div className="checkout-demo-banner">
            <Sparkles size={19} />
            <div>
              <strong>Just trying things out?</strong>
              <p>Use sample details to explore the whole experience.</p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setValues({ ...DEMO_DETAILS });
                setErrors({});
                setMessage("");
              }}
            >
              Use demo details
            </button>
          </div>
          <fieldset className="checkout-section" disabled={busy}>
            <legend>
              <span>
                <UserRound size={18} />
              </span>
              Contact details
            </legend>
            <div className="checkout-fields two-columns">
              <Field
                name="fullName"
                label="Full name"
                autoComplete="name"
                values={values}
                errors={errors}
                change={change}
              />
              <Field
                name="email"
                label="Email address"
                type="email"
                autoComplete="email"
                values={values}
                errors={errors}
                change={change}
              />
            </div>
          </fieldset>
          <fieldset className="checkout-section" disabled={busy}>
            <legend>
              <span>
                <MapPin size={18} />
              </span>
              Where should your good finds go?
            </legend>
            <div className="checkout-fields">
              <Field
                name="address1"
                label="Street address"
                autoComplete="address-line1"
                values={values}
                errors={errors}
                change={change}
              />
              <Field
                name="address2"
                label="Apartment, suite, etc."
                autoComplete="address-line2"
                required={false}
                values={values}
                errors={errors}
                change={change}
              />
              <div className="two-columns">
                <Field
                  name="city"
                  label="City or town"
                  autoComplete="address-level2"
                  values={values}
                  errors={errors}
                  change={change}
                />
                <Field
                  name="region"
                  label="State / province / region"
                  autoComplete="address-level1"
                  required={regionRequired}
                  values={values}
                  errors={errors}
                  change={change}
                />
              </div>
              <div className="two-columns">
                <div className="checkout-field">
                  <label htmlFor="checkout-country">Country</label>
                  <select
                    id="checkout-country"
                    value={values.country}
                    onChange={(event) => change("country", event.target.value)}
                    autoComplete="country"
                    aria-invalid={!!errors.country}
                    aria-describedby={
                      errors.country ? "error-country" : undefined
                    }
                  >
                    {COUNTRIES.map(([code, name]) => (
                      <option key={code} value={code}>
                        {name}
                      </option>
                    ))}
                  </select>
                  {errors.country && (
                    <p className="field-error" id="error-country">
                      {errors.country}
                    </p>
                  )}
                </div>
                <Field
                  name="postalCode"
                  label="Postal / ZIP code"
                  autoComplete="postal-code"
                  required={regionRequired}
                  values={values}
                  errors={errors}
                  change={change}
                />
              </div>
            </div>
          </fieldset>
          <fieldset className="checkout-section" disabled={busy}>
            <legend>
              <span>
                <Truck size={18} />
              </span>
              A delivery option that fits
            </legend>
            <p className="section-intro">
              Free standard delivery on {money(FREE_DELIVERY_CENTS / 100)}+
              after discounts. These are sample delivery estimates.
            </p>
            <div className="delivery-options">
              {(Object.keys(DELIVERY) as DeliveryMethod[]).map((method) => (
                <label
                  className={delivery === method ? "selected" : ""}
                  key={method}
                >
                  <input
                    type="radio"
                    name="delivery-method"
                    value={method}
                    checked={delivery === method}
                    onChange={() => {
                      setDelivery(method);
                      setMessage("");
                    }}
                  />
                  <span>
                    <strong>{DELIVERY[method].label}</strong>
                    <small>{DELIVERY[method].estimate}</small>
                  </span>
                  <b>
                    {method === "standard" &&
                    quote.subtotalCents - quote.discountCents >=
                      FREE_DELIVERY_CENTS
                      ? "Free"
                      : money(DELIVERY[method].fee / 100)}
                  </b>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="checkout-payment-note">
            <Check size={18} />
            <div>
              <strong>A complete demo, with no payment.</strong>
              <p>
                You won’t enter card details. Your demo order and delivery
                details are saved in this browser.
              </p>
            </div>
          </div>
        </div>
        <div className="checkout-summary-column">
          <OrderSummary
            quote={quote}
            editBag={editBag}
            couponInput={couponInput}
            onCouponChange={(value) => {
              setCouponInput(value);
              setCouponMessage("");
            }}
            onApplyCoupon={applyCoupon}
            onRemoveCoupon={() => {
              setCoupon("");
              setCouponInput("");
              setCouponMessage("");
              setMessage("");
            }}
            couponMessage={couponMessage}
            disabled={busy}
          >
            {(quote.issues.length > 0 || message) && (
              <div
                className="checkout-problem"
                role="alert"
                tabIndex={-1}
                ref={messageRef}
              >
                <CircleAlert size={17} />
                <div>
                  {message && !quote.issues.includes(message) && (
                    <p>{message}</p>
                  )}
                  {quote.issues.map((issue) => (
                    <p key={issue}>{issue}</p>
                  ))}
                  {quote.issues.length > 0 && (
                    <button type="button" onClick={editBag}>
                      Review your bag
                    </button>
                  )}
                </div>
              </div>
            )}
            <button
              type="submit"
              className="primary-button place-order"
              disabled={
                busy || loading || !quote.lines.length || !!quote.issues.length
              }
            >
              {busy ? (
                <>
                  <LoaderCircle size={17} className="spin" />
                  Checking your good finds…
                </>
              ) : (
                <>
                  Place demo order <ArrowRight size={17} />
                </>
              )}
            </button>
            <p className="place-order-caption">
              Your bag is cleared after the order saves successfully.
            </p>
          </OrderSummary>
        </div>
      </form>
    </main>
  );
}
