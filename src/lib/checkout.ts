import type { CartItem, CatalogueSource, Product } from "../types";
import { selectedVariant, variantsOf } from "./products";
import { updateCart } from "./catalogue";

export const DELIVERY = {
  standard: {
    label: "Standard delivery",
    estimate: "3–5 business days",
    fee: 699,
  },
  express: {
    label: "Express delivery",
    estimate: "1–2 business days",
    fee: 1499,
  },
} as const;
export type DeliveryMethod = keyof typeof DELIVERY;
export const FREE_DELIVERY_CENTS = 10000;
export const COUNTRIES = [
  ["CA", "Canada"],
  ["US", "United States"],
  ["GB", "United Kingdom"],
  ["AU", "Australia"],
  ["NP", "Nepal"],
  ["OTHER", "Other"],
] as const;
export interface CheckoutValues {
  fullName: string;
  email: string;
  address1: string;
  address2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
}
export type CheckoutField = keyof CheckoutValues;
export const EMPTY_DETAILS: CheckoutValues = {
  fullName: "",
  email: "",
  address1: "",
  address2: "",
  city: "",
  region: "",
  postalCode: "",
  country: "CA",
};
export const DEMO_DETAILS: CheckoutValues = {
  fullName: "Alex Taylor",
  email: "alex@example.com",
  address1: "123 Demo Street",
  address2: "",
  city: "Toronto",
  region: "Ontario",
  postalCode: "M5V 2T6",
  country: "CA",
};
export interface OrderLine {
  productId: string;
  variantId: string;
  variantLabel: string;
  name: string;
  brand: string;
  image: string;
  source: CatalogueSource;
  quantity: number;
  unitPriceCents: number;
}
export interface CheckoutQuote {
  lines: OrderLine[];
  subtotalCents: number;
  discountCents: number;
  deliveryCents: number;
  totalCents: number;
  delivery: DeliveryMethod;
  coupon: string;
  couponError: string;
  issues: string[];
}
export const normalizedCoupon = (value: string) => value.trim().toUpperCase();
export function couponDiscount(
  subtotal: number,
  code: string,
): { discount: number; error: string } {
  const value = normalizedCoupon(code);
  if (!value) return { discount: 0, error: "" };
  if (value === "CURIO10")
    return subtotal >= 7500
      ? { discount: Math.round((subtotal * 10) / 100), error: "" }
      : {
          discount: 0,
          error: "CURIO10 needs a product subtotal of $75 or more.",
        };
  if (value === "SAVE25")
    return subtotal >= 20000
      ? { discount: 2500, error: "" }
      : {
          discount: 0,
          error: "SAVE25 needs a product subtotal of $200 or more.",
        };
  return {
    discount: 0,
    error: "That demo code is not available. Try CURIO10 or SAVE25.",
  };
}
export function checkoutQuote(
  cart: CartItem[],
  products: Product[],
  delivery: DeliveryMethod = "standard",
  coupon = "",
): CheckoutQuote {
  const lines: OrderLine[] = [];
  const issues: string[] = [];
  for (const item of cart) {
    const product = products.find((p) => p.id === item.productId);
    if (!product) {
      issues.push(
        "An item in your bag is no longer in the available collection. Remove it before continuing.",
      );
      continue;
    }
    if (
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 99
    ) {
      issues.push(`Please check the quantity for ${product.name}.`);
      continue;
    }
    const variant = item.variantId
      ? variantsOf(product).find((v) => v.id === item.variantId)
      : selectedVariant(product);
    if (!variant) {
      issues.push(
        `${product.name}: this saved option is no longer available. Remove it from your bag.`,
      );
      continue;
    }
    const existing = lines.find(
      (line) => line.productId === product.id && line.variantId === variant.id,
    );
    const quantity = item.quantity + (existing?.quantity ?? 0);
    if (quantity > Math.min(variant.stock, 99))
      issues.push(
        `${product.name}, ${variant.label}: ${variant.stock ? `only ${Math.min(variant.stock, 99)} available. Update the quantity in your bag.` : "this option is sold out. Remove it from your bag."}`,
      );
    if (existing) existing.quantity = quantity;
    else
      lines.push({
        productId: product.id,
        variantId: variant.id,
        variantLabel: variant.label,
        name: product.name,
        brand: product.brand,
        image: product.image,
        source:
          product.source ??
          (product.id.startsWith("dummy-") ? "dummyjson" : "curio"),
        quantity: item.quantity,
        unitPriceCents: Math.round(variant.price * 100),
      });
  }
  const subtotalCents = lines.reduce(
    (n, line) => n + line.unitPriceCents * line.quantity,
    0,
  );
  const discount = couponDiscount(subtotalCents, coupon);
  const deliveryCents = !lines.length
    ? 0
    : delivery === "standard" &&
        subtotalCents - discount.discount >= FREE_DELIVERY_CENTS
      ? 0
      : DELIVERY[delivery].fee;
  return {
    lines,
    subtotalCents,
    discountCents: discount.discount,
    deliveryCents,
    totalCents: subtotalCents - discount.discount + deliveryCents,
    delivery,
    coupon: normalizedCoupon(coupon),
    couponError: discount.error,
    issues: [...new Set(issues)],
  };
}
export function cartSignature(cart: CartItem[]): string {
  return JSON.stringify(
    cart
      .map((item) => ({
        id: item.productId,
        variant: item.variantId ?? "",
        quantity: item.quantity,
      }))
      .sort((a, b) =>
        (a.id + ":" + a.variant).localeCompare(b.id + ":" + b.variant),
      ),
  );
}
export function quoteSignature(quote: CheckoutQuote): string {
  return JSON.stringify({
    lines: quote.lines,
    subtotal: quote.subtotalCents,
    discount: quote.discountCents,
    delivery: quote.deliveryCents,
    total: quote.totalCents,
    coupon: quote.coupon,
  });
}
export function cleanDetails(value: CheckoutValues): CheckoutValues {
  return Object.fromEntries(
    Object.entries(value).map(([key, text]) => [key, text.trim()]),
  ) as unknown as CheckoutValues;
}
export function validateDetails(
  value: CheckoutValues,
): Partial<Record<CheckoutField, string>> {
  const v = cleanDetails(value);
  const errors: Partial<Record<CheckoutField, string>> = {};
  if (v.fullName.length < 2 || v.fullName.length > 100)
    errors.fullName = "Enter a name between 2 and 100 characters.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email) || v.email.length > 160)
    errors.email = "Enter a valid email address.";
  if (v.address1.length < 3 || v.address1.length > 200)
    errors.address1 = "Enter a street address between 3 and 200 characters.";
  if (v.address2.length > 200)
    errors.address2 = "Keep the second address line under 200 characters.";
  if (v.city.length < 2 || v.city.length > 100)
    errors.city = "Enter a city or town between 2 and 100 characters.";
  if (!COUNTRIES.some(([code]) => code === v.country))
    errors.country = "Choose a delivery country.";
  if (["CA", "US"].includes(v.country) && !v.region)
    errors.region = "Enter your state or province.";
  if (v.region.length > 80)
    errors.region = "Keep the region under 80 characters.";
  if (v.country === "CA" && !/^[a-z]\d[a-z][ -]?\d[a-z]\d$/i.test(v.postalCode))
    errors.postalCode = "Enter a Canadian postal code, such as M5V 2T6.";
  else if (v.country === "US" && !/^\d{5}(-\d{4})?$/.test(v.postalCode))
    errors.postalCode = "Enter a US ZIP code, such as 10001 or 10001-1234.";
  else if (v.postalCode.length > 20)
    errors.postalCode = "Keep the postal code under 20 characters.";
  return errors;
}
export function isCheckoutValues(value: unknown): value is CheckoutValues {
  return (
    !!value &&
    typeof value === "object" &&
    Object.keys(EMPTY_DETAILS).every(
      (key) => typeof (value as Record<string, unknown>)[key] === "string",
    )
  );
}
export function repeatOrder(
  cart: CartItem[],
  lines: OrderLine[],
  products: Product[],
): { cart: CartItem[]; added: number; messages: string[] } {
  let next = [...cart];
  let added = 0;
  const messages: string[] = [];
  for (const line of lines) {
    const product = products.find((p) => p.id === line.productId);
    const variant =
      product && variantsOf(product).find((v) => v.id === line.variantId);
    if (!product || !variant || !variant.stock) {
      messages.push(
        `${line.name}, ${line.variantLabel}, is no longer available.`,
      );
      continue;
    }
    const existing = next
      .filter(
        (item) =>
          item.productId === product.id &&
          (item.variantId ?? variantsOf(product)[0].id) === variant.id,
      )
      .reduce((n, item) => n + item.quantity, 0);
    const amount = Math.max(
      0,
      Math.min(line.quantity, Math.min(variant.stock, 99) - existing),
    );
    if (amount) {
      next = updateCart(next, product, existing + amount, variant.id);
      added += amount;
    }
    if (amount < line.quantity)
      messages.push(
        `${line.name}: ${amount ? `added ${amount} of ${line.quantity}` : "no more can be added"} because of the current stock or bag limit.`,
      );
  }
  return { cart: next, added, messages };
}
