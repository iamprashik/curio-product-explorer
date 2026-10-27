import { beforeEach, describe, expect, it, vi } from "vitest";
import catalogue from "../public/catalogue.json";
import { isProduct } from "../src/lib/catalogue";
import {
  checkoutQuote,
  couponDiscount,
  DEMO_DETAILS,
  EMPTY_DETAILS,
  repeatOrder,
  validateDetails,
} from "../src/lib/checkout";
import {
  isOrder,
  isOrders,
  makeOrder,
  ORDERS_KEY,
  readOrders,
  saveOrder,
} from "../src/lib/orders";

const products = (catalogue as unknown[]).filter(isProduct);
const p = products[0];
const line = { productId: p.id, variantId: "original", quantity: 1 };
const order = () =>
  makeOrder(
    checkoutQuote([line], products),
    DEMO_DETAILS,
    "12345678-1234-1234-1234-123456789012",
    new Date("2026-10-15T14:00:00Z"),
  );
beforeEach(() => localStorage.clear());

describe("checkout pricing rules", () => {
  it("prices the selected option and percentage discounts in cents", () => {
    const quote = checkoutQuote(
      [{ ...line, variantId: "sand", quantity: 2 }],
      products,
      "standard",
      " curio10 ",
    );
    expect(quote.subtotalCents).toBe(31800);
    expect(quote.discountCents).toBe(3180);
    expect(quote.deliveryCents).toBe(0);
    expect(quote.totalCents).toBe(28620);
    expect(quote.lines[0]).toMatchObject({
      variantLabel: "Sand finish",
      unitPriceCents: 15900,
      quantity: 2,
    });
  });
  it("applies the fixed discount and minimum spend rules", () => {
    expect(
      checkoutQuote([{ ...line, quantity: 2 }], products, "standard", "SAVE25"),
    ).toMatchObject({
      subtotalCents: 29800,
      discountCents: 2500,
      totalCents: 27300,
    });
    expect(couponDiscount(7499, "CURIO10").error).toContain("$75");
    expect(couponDiscount(19999, "SAVE25").error).toContain("$200");
    expect(couponDiscount(10000, "made-up").error).toContain("not available");
  });
  it("uses the discounted subtotal for free delivery and keeps express delivery separate", () => {
    const sample = { ...p, price: 100, variants: undefined };
    const cart = [{ productId: p.id, quantity: 1 }];
    expect(checkoutQuote(cart, [sample], "standard")).toMatchObject({
      deliveryCents: 0,
      totalCents: 10000,
    });
    expect(checkoutQuote(cart, [sample], "standard", "CURIO10")).toMatchObject({
      discountCents: 1000,
      deliveryCents: 699,
      totalCents: 9699,
    });
    expect(checkoutQuote(cart, [sample], "express", "CURIO10")).toMatchObject({
      deliveryCents: 1499,
      totalCents: 10499,
    });
  });
  it("handles small fractional prices and empty bags without floating totals", () => {
    const fractional = { ...p, price: 0.1, variants: undefined };
    expect(
      checkoutQuote([{ productId: p.id, quantity: 3 }], [fractional])
        .totalCents,
    ).toBe(729);
    expect(checkoutQuote([], products).totalCents).toBe(0);
  });
  it("blocks removed options, missing products and insufficient stock", () => {
    expect(
      checkoutQuote(
        [{ ...line, variantId: "removed" }],
        products,
      ).issues.join(),
    ).toContain("no longer available");
    expect(
      checkoutQuote([{ ...line, productId: "missing" }], products).issues,
    ).toHaveLength(1);
    expect(
      checkoutQuote(
        [{ ...line, variantId: "sand", quantity: 9 }],
        products,
      ).issues.join(),
    ).toContain("only 8 available");
    expect(
      checkoutQuote([{ ...line, quantity: 0 }], products).issues,
    ).toHaveLength(1);
  });
  it("combines a legacy default line and its explicit option before checking stock", () => {
    const quote = checkoutQuote(
      [{ productId: p.id, quantity: 24 }, line],
      products,
    );
    expect(quote.lines).toHaveLength(1);
    expect(quote.lines[0].quantity).toBe(25);
    expect(quote.issues.join()).toContain("only 24 available");
  });
});
describe("contact and delivery validation", () => {
  it("accepts the sample details and rejects incomplete fields", () => {
    expect(validateDetails(DEMO_DETAILS)).toEqual({});
    expect(validateDetails(EMPTY_DETAILS)).toMatchObject({
      fullName: expect.any(String),
      email: expect.any(String),
      address1: expect.any(String),
      city: expect.any(String),
      region: expect.any(String),
      postalCode: expect.any(String),
    });
    expect(
      validateDetails({ ...DEMO_DETAILS, email: "no-address" }).email,
    ).toBeTruthy();
  });
  it("validates country-specific postal formats while allowing international details", () => {
    expect(
      validateDetails({
        ...DEMO_DETAILS,
        country: "US",
        postalCode: "10001-1234",
        region: "New York",
      }),
    ).toEqual({});
    expect(
      validateDetails({ ...DEMO_DETAILS, country: "US", postalCode: "M5V 2T6" })
        .postalCode,
    ).toContain("US ZIP");
    expect(
      validateDetails({
        ...DEMO_DETAILS,
        country: "OTHER",
        region: "",
        postalCode: "",
      }),
    ).toEqual({});
    expect(
      validateDetails({ ...DEMO_DETAILS, country: "INVALID" }).country,
    ).toBeTruthy();
  });
});
describe("durable demo receipts", () => {
  it("saves an immutable price and option snapshot with a stable receipt", () => {
    const quote = checkoutQuote([line], products);
    const receipt = makeOrder(
      quote,
      DEMO_DETAILS,
      "12345678-1234-1234-1234-123456789012",
      new Date("2026-10-15T14:00:00Z"),
    );
    quote.lines[0].unitPriceCents = 99999;
    expect(receipt.lines[0].unitPriceCents).toBe(14900);
    expect(receipt.reference).toBe("CURIO-20261015-12345678");
    expect(isOrder(receipt)).toBe(true);
    expect(saveOrder(receipt)).toHaveLength(1);
    expect(readOrders().orders).toEqual([receipt]);
  });
  it("does not duplicate a receipt when the same save is repeated", () => {
    const receipt = order();
    saveOrder(receipt);
    saveOrder(receipt);
    expect(readOrders().orders).toHaveLength(1);
  });
  it("rejects tampered totals, invalid lines and duplicate order ids", () => {
    const receipt = order();
    expect(isOrder({ ...receipt, totalCents: 1 })).toBe(false);
    expect(
      isOrder({ ...receipt, customer: { ...DEMO_DETAILS, email: "bad" } }),
    ).toBe(false);
    expect(isOrders([receipt, receipt])).toBe(false);
    expect(() => makeOrder(checkoutQuote([], products), DEMO_DETAILS)).toThrow(
      "Review your bag",
    );
  });
  it("leaves saved data intact when the history is malformed", () => {
    localStorage.setItem(ORDERS_KEY, "{broken");
    expect(readOrders().error).toBeTruthy();
    expect(() => saveOrder(order())).toThrow("Your bag is unchanged");
    expect(localStorage.getItem(ORDERS_KEY)).toBe("{broken");
  });
  it("reports failed writes without clearing the saved bag", () => {
    localStorage.setItem("curio.cart.v1", JSON.stringify([line]));
    const set = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key,
      value,
    ) {
      if (key === ORDERS_KEY)
        throw new DOMException("Full", "QuotaExceededError");
      return set.call(this, key, value);
    });
    expect(() => saveOrder(order())).toThrow("Your bag is unchanged");
    expect(JSON.parse(localStorage.getItem("curio.cart.v1")!)).toEqual([line]);
  });
});
describe("buy again", () => {
  it("keeps existing bag lines and caps repeated quantities at current availability", () => {
    const old = order();
    old.lines[0].quantity = 4;
    const limited = {
      ...p,
      stock: 2,
      variants: p.variants!.map((v) => ({
        ...v,
        stock: 2,
        price: v.price + 10,
      })),
    };
    const result = repeatOrder([line], old.lines, [limited]);
    expect(result.added).toBe(1);
    expect(result.cart).toEqual([{ ...line, quantity: 2 }]);
    expect(result.messages.join()).toContain("added 1 of 4");
    expect(old.lines[0].unitPriceCents).toBe(14900);
  });
  it("skips products or options that are no longer available", () => {
    const receipt = order();
    expect(repeatOrder([], receipt.lines, [])).toMatchObject({
      added: 0,
      cart: [],
    });
    expect(
      repeatOrder([], receipt.lines, [
        {
          ...p,
          stock: 0,
          variants: p.variants!.map((v) => ({ ...v, stock: 0 })),
        },
      ]).messages.join(),
    ).toContain("no longer available");
  });
});
