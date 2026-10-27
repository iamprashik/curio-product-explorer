import type {
  CheckoutQuote,
  CheckoutValues,
  OrderLine,
  DeliveryMethod,
} from "./checkout";
import {
  cleanDetails,
  isCheckoutValues,
  validateDetails,
  DELIVERY,
} from "./checkout";

export const ORDERS_KEY = "curio.orders.v3";
export interface DemoOrder {
  schemaVersion: 1;
  id: string;
  reference: string;
  placedAt: string;
  currency: "USD";
  status: "Placed";
  customer: CheckoutValues;
  lines: OrderLine[];
  subtotalCents: number;
  discountCents: number;
  deliveryCents: number;
  totalCents: number;
  delivery: DeliveryMethod;
  coupon: string;
}
const cents = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
function isLine(value: unknown): value is OrderLine {
  if (!value || typeof value !== "object") return false;
  const line = value as OrderLine;
  return (
    ["productId", "variantId", "variantLabel", "name", "brand", "image"].every(
      (key) =>
        typeof (line as unknown as Record<string, unknown>)[key] === "string",
    ) &&
    !!line.productId &&
    !!line.variantId &&
    !!line.name &&
    /^https:\/\/|^\/(?!\/)/.test(line.image) &&
    ["curio", "dummyjson"].includes(line.source) &&
    Number.isInteger(line.quantity) &&
    line.quantity >= 1 &&
    line.quantity <= 99 &&
    cents(line.unitPriceCents)
  );
}
export function isOrder(value: unknown): value is DemoOrder {
  if (!value || typeof value !== "object") return false;
  const o = value as DemoOrder;
  return (
    o.schemaVersion === 1 &&
    typeof o.id === "string" &&
    /^[a-z0-9-]{8,80}$/i.test(o.id) &&
    typeof o.reference === "string" &&
    /^CURIO-[A-Z0-9-]+$/.test(o.reference) &&
    typeof o.placedAt === "string" &&
    Number.isFinite(Date.parse(o.placedAt)) &&
    o.currency === "USD" &&
    o.status === "Placed" &&
    isCheckoutValues(o.customer) &&
    Object.keys(validateDetails(o.customer)).length === 0 &&
    Array.isArray(o.lines) &&
    o.lines.length > 0 &&
    o.lines.every(isLine) &&
    new Set(o.lines.map((line) => line.productId + ":" + line.variantId))
      .size === o.lines.length &&
    [o.subtotalCents, o.discountCents, o.deliveryCents, o.totalCents].every(
      cents,
    ) &&
    o.subtotalCents ===
      o.lines.reduce((n, line) => n + line.quantity * line.unitPriceCents, 0) &&
    o.discountCents <= o.subtotalCents &&
    o.totalCents === o.subtotalCents - o.discountCents + o.deliveryCents &&
    Object.hasOwn(DELIVERY, o.delivery) &&
    typeof o.coupon === "string"
  );
}
export function isOrders(value: unknown): value is DemoOrder[] {
  return (
    Array.isArray(value) &&
    value.every(isOrder) &&
    new Set(value.map((order) => order.id)).size === value.length
  );
}
export function makeOrder(
  quote: CheckoutQuote,
  customer: CheckoutValues,
  id: string = crypto.randomUUID(),
  now = new Date(),
): DemoOrder {
  if (
    !quote.lines.length ||
    quote.issues.length ||
    quote.couponError ||
    Object.keys(validateDetails(customer)).length
  )
    throw new Error(
      "Review your bag and delivery details before placing the demo order.",
    );
  const order: DemoOrder = {
    schemaVersion: 1,
    id,
    reference: `CURIO-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${id.replaceAll("-", "").slice(0, 8).toUpperCase()}`,
    placedAt: now.toISOString(),
    currency: "USD",
    status: "Placed",
    customer: cleanDetails(customer),
    lines: quote.lines.map((line) => ({ ...line })),
    subtotalCents: quote.subtotalCents,
    discountCents: quote.discountCents,
    deliveryCents: quote.deliveryCents,
    totalCents: quote.totalCents,
    delivery: quote.delivery,
    coupon: quote.discountCents ? quote.coupon : "",
  };
  if (!isOrder(order))
    throw new Error("The demo order could not be prepared. Please try again.");
  return order;
}
export function readOrders(): { orders: DemoOrder[]; error: string } {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(ORDERS_KEY) ?? "[]");
    if (!isOrders(raw))
      return {
        orders: [],
        error:
          "Your saved demo orders could not be read. The saved data has not been changed.",
      };
    return { orders: raw, error: "" };
  } catch {
    return {
      orders: [],
      error:
        "Saved orders are unavailable in this browser. Check that site storage is enabled and try again.",
    };
  }
}
export function saveOrder(order: DemoOrder): DemoOrder[] {
  if (!isOrder(order))
    throw new Error("This order could not be saved. Your bag is unchanged.");
  const previous = readOrders();
  if (previous.error)
    throw new Error(previous.error + " Your bag is unchanged.");
  if (previous.orders.some((saved) => saved.id === order.id))
    return previous.orders;
  const next = [order, ...previous.orders];
  try {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(next));
  } catch {
    throw new Error(
      "This browser could not save the demo order. Your bag is unchanged. Free some site storage or allow site storage, then try again.",
    );
  }
  return next;
}
export const orderDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
