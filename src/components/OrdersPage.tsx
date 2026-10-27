import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  LoaderCircle,
  PackageCheck,
  RotateCcw,
  Search,
  ShoppingBag,
} from "lucide-react";
import { money } from "../lib/catalogue";
import { DELIVERY, type CheckoutQuote } from "../lib/checkout";
import { orderDate, type DemoOrder } from "../lib/orders";
import { OrderSummary } from "./OrderSummary";

export function OrdersPage({
  orders,
  error,
  reload,
  continueShopping,
}: {
  orders: DemoOrder[];
  error: string;
  reload: () => void;
  continueShopping: () => void;
}) {
  const [search, setSearch] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const location = useLocation();
  const source =
    new URLSearchParams(location.search).get("source") === "dummyjson"
      ? "?source=dummyjson"
      : "";
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);
  const sorted = [...orders].sort(
    (a, b) => Date.parse(b.placedAt) - Date.parse(a.placedAt),
  );
  const visible = sorted.filter((order) =>
    (
      order.reference +
      " " +
      order.lines.map((line) => line.name + " " + line.variantLabel).join(" ")
    )
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  return (
    <main className="page-shell commerce-page" id="commerce-content">
      <button className="commerce-back" onClick={continueShopping}>
        <ArrowLeft size={15} />
        Back to the good finds
      </button>
      <div className="commerce-heading">
        <div>
          <span className="eyebrow">THE FINDS YOU MADE YOURS</span>
          <h1 ref={heading} tabIndex={-1}>
            Your little collection<span>.</span>
          </h1>
          <p>
            {orders.length} {orders.length === 1 ? "demo order" : "demo orders"}{" "}
            · Saved in this browser.
          </p>
        </div>
        <PackageCheck className="orders-heading-icon" size={46} />
      </div>
      {error && (
        <div className="catalogue-error" role="alert">
          <CircleAlert size={18} />
          <span>{error}</span>
          <button onClick={reload}>Retry saved orders</button>
        </div>
      )}
      {orders.length > 0 ? (
        <>
          <div className="orders-toolbar">
            <label className="orders-search">
              <Search size={17} />
              <span className="sr-only">Search orders</span>
              <input
                type="search"
                placeholder="Find an order or a product…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <span>Most recent first</span>
          </div>
          {visible.length ? (
            <div className="orders-list">
              {visible.map((order) => (
                <article className="order-card" key={order.id}>
                  <div className="order-card-top">
                    <div>
                      <small>ORDER</small>
                      <h2>{order.reference}</h2>
                      <p>{orderDate(order.placedAt)}</p>
                    </div>
                    <span className="order-status">
                      <Check size={13} />
                      Demo order placed
                    </span>
                  </div>
                  <div className="order-card-body">
                    <div className="order-card-thumbnails">
                      {order.lines.slice(0, 3).map((line) => (
                        <img
                          key={line.productId + ":" + line.variantId}
                          src={line.image}
                          alt={line.name}
                          width={68}
                          height={62}
                          loading="lazy"
                        />
                      ))}
                    </div>
                    <div className="order-card-description">
                      <strong>{order.lines[0].name}</strong>
                      <p>
                        {order.lines[0].variantLabel} ×{" "}
                        {order.lines[0].quantity}
                        {order.lines.length > 1
                          ? ` · ${order.lines.length - 1} more ${order.lines.length === 2 ? "find" : "finds"}`
                          : ""}
                      </p>
                    </div>
                    <div className="order-card-total">
                      <small>
                        {order.lines.reduce((n, line) => n + line.quantity, 0)}{" "}
                        items · Total USD
                      </small>
                      <strong>{money(order.totalCents / 100)}</strong>
                    </div>
                    <Link
                      className="outline-button"
                      to={"/orders/" + encodeURIComponent(order.id) + source}
                    >
                      View order <ArrowRight size={15} />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="commerce-empty compact">
              <Search size={32} />
              <h2>No matching orders just yet.</h2>
              <p>Try another product name or order number.</p>
              <button className="outline-button" onClick={() => setSearch("")}>
                Clear order search
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="commerce-empty">
          <PackageCheck size={40} />
          <h2>Your good finds will live here.</h2>
          <p>
            Place a demo order to keep a receipt, revisit the details, and buy
            your favourites again.
          </p>
          <button className="primary-button" onClick={continueShopping}>
            Explore the collection <ArrowRight size={16} />
          </button>
        </div>
      )}
      <p className="orders-storage-note">
        Demo orders belong to this browser. Clearing this site’s browser data
        removes the saved history.
      </p>
    </main>
  );
}
export function OrderDetailsPage({
  order,
  openOrders,
  continueShopping,
  buyAgain,
  openBag,
}: {
  order: DemoOrder | undefined;
  openOrders: () => void;
  continueShopping: () => void;
  buyAgain: (order: DemoOrder, signal: AbortSignal) => Promise<string>;
  openBag: () => void;
}) {
  const location = useLocation();
  const confirmed = new URLSearchParams(location.search).get("placed") === "1";
  const heading = useRef<HTMLHeadingElement>(null);
  const controller = useRef<AbortController | null>(null);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    return () => controller.current?.abort();
  }, [order?.id]);
  async function reorder() {
    if (!order || pending.current) return;
    pending.current = true;
    setBusy(true);
    setMessage("");
    const abort = new AbortController();
    controller.current = abort;
    const timeout = window.setTimeout(() => abort.abort(), 15000);
    try {
      setMessage(await buyAgain(order, abort.signal));
    } catch (error) {
      if (!abort.signal.aborted)
        setMessage(
          error instanceof Error
            ? error.message
            : "These products could not be refreshed. Try again.",
        );
      else
        setMessage("The collection check was interrupted. Please try again.");
    } finally {
      pending.current = false;
      setBusy(false);
      window.clearTimeout(timeout);
    }
  }
  if (!order)
    return (
      <main className="page-shell commerce-page" id="commerce-content">
        <div className="commerce-empty">
          <PackageCheck size={36} />
          <h1 ref={heading} tabIndex={-1}>
            This order isn’t in this browser.
          </h1>
          <p>
            Order receipts are saved locally in the browser where you placed the
            demo order.
          </p>
          <button className="primary-button" onClick={openOrders}>
            View My Orders <ArrowRight size={16} />
          </button>
        </div>
      </main>
    );
  const quote: CheckoutQuote = {
    lines: order.lines,
    subtotalCents: order.subtotalCents,
    discountCents: order.discountCents,
    deliveryCents: order.deliveryCents,
    totalCents: order.totalCents,
    delivery: order.delivery,
    coupon: order.coupon,
    couponError: "",
    issues: [],
  };
  return (
    <main className="page-shell commerce-page" id="commerce-content">
      <button className="commerce-back" onClick={openOrders}>
        <ArrowLeft size={15} />
        All your orders
      </button>
      <div className="order-confirmation-heading">
        <span className="order-confirmation-icon">
          <Check size={28} />
        </span>
        <span className="eyebrow">
          {confirmed ? "A GREAT LITTLE FIND" : "KEPT FOR ANOTHER LOOK"}
        </span>
        <h1 ref={heading} tabIndex={-1}>
          {confirmed ? "That’s a wrap." : "Your order, at a glance."}
        </h1>
        <p>
          {confirmed
            ? "Your demo order is saved. No payment was taken."
            : "A saved receipt of your good finds, including the prices when you placed the order."}
        </p>
        <span className="order-reference">{order.reference}</span>
      </div>
      <div className="order-details-layout">
        <div className="order-information">
          <section className="order-info-card">
            <h2>
              <PackageCheck size={19} />
              Demo order placed
            </h2>
            <p>{orderDate(order.placedAt)}</p>
            <div className="order-received">
              <Check size={15} />
              <span>Saved successfully in this browser.</span>
            </div>
            <p className="muted-order-note">
              This portfolio checkout creates a local demo receipt. No purchase,
              payment, or shipment is made.
            </p>
          </section>
          <div className="order-address-grid">
            <section className="order-info-card">
              <h2>Delivery details</h2>
              <address>
                <strong>{order.customer.fullName}</strong>
                <br />
                {order.customer.address1}
                {order.customer.address2 && (
                  <>
                    <br />
                    {order.customer.address2}
                  </>
                )}
                <br />
                {order.customer.city}
                {order.customer.region ? ", " + order.customer.region : ""}
                <br />
                {order.customer.postalCode}
                {order.customer.postalCode ? " · " : ""}
                {order.customer.country}
              </address>
            </section>
            <section className="order-info-card">
              <h2>Contact & delivery</h2>
              <p>{order.customer.email}</p>
              <strong className="order-delivery-label">
                {DELIVERY[order.delivery].label}
              </strong>
              <p>{DELIVERY[order.delivery].estimate} · Demo estimate</p>
              <p>No payment details collected.</p>
            </section>
          </div>
          <section className="order-info-card reorder-card">
            <h2>
              <RotateCcw size={18} />
              Another round of good finds?
            </h2>
            <p>
              Buy again uses the current prices and availability. Your saved
              receipt keeps its original details.
            </p>
            <div className="order-actions">
              <button
                className="primary-button"
                disabled={busy}
                onClick={reorder}
              >
                {busy ? (
                  <>
                    <LoaderCircle size={16} className="spin" />
                    Checking availability…
                  </>
                ) : (
                  <>
                    <RotateCcw size={16} />
                    Buy again
                  </>
                )}
              </button>
              <button className="outline-button" onClick={continueShopping}>
                Keep exploring <ArrowRight size={15} />
              </button>
            </div>
            {message && (
              <div className="reorder-message" role="status">
                <p>{message}</p>
                <button className="text-link" onClick={openBag}>
                  <ShoppingBag size={15} />
                  Review your bag
                </button>
              </div>
            )}
          </section>
        </div>
        <OrderSummary quote={quote} />
      </div>
    </main>
  );
}
