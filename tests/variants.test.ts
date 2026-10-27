import { describe, expect, it } from "vitest";
import { cartTotal, isProduct, updateCart } from "../src/lib/catalogue";
import { isCart } from "../src/lib/storage";
import {
  selectedVariant,
  variantProduct,
  productPath,
} from "../src/lib/products";
import catalogue from "../public/catalogue.json";
const p = (catalogue as unknown[]).filter(isProduct)[0];

describe("variant shopping rules", () => {
  it("separates options, stock limits, line removal and totals", () => {
    let cart = updateCart([], p, 2, "original");
    cart = updateCart(cart, p, 100, "sand");
    expect(cart).toEqual([
      { productId: p.id, variantId: "original", quantity: 2 },
      { productId: p.id, variantId: "sand", quantity: 8 },
    ]);
    expect(cartTotal(cart, [p])).toBe(1570);
    expect(updateCart(cart, p, 0, "original")).toEqual([
      { productId: p.id, variantId: "sand", quantity: 8 },
    ]);
    expect(updateCart(cart, p, NaN, "sand")).toEqual(cart);
  });
  it("merges an old default bag line when its option is updated", () => {
    expect(
      updateCart([{ productId: p.id, quantity: 1 }], p, 3, "original"),
    ).toEqual([{ productId: p.id, variantId: "original", quantity: 3 }]);
  });
  it("does not substitute a differently priced option for an invalid stored variant", () => {
    expect(
      cartTotal(
        [{ productId: p.id, variantId: "removed-option", quantity: 2 }],
        [p],
      ),
    ).toBe(0);
    expect(updateCart([], p, 2, "removed-option")).toEqual([]);
  });
  it("validates option data and allows distinct options of the same product", () => {
    expect(
      isCart([
        { productId: p.id, variantId: "original", quantity: 1 },
        { productId: p.id, variantId: "sand", quantity: 1 },
      ]),
    ).toBe(true);
    expect(
      isCart([
        { productId: p.id, variantId: "sand", quantity: 1 },
        { productId: p.id, variantId: "sand", quantity: 2 },
      ]),
    ).toBe(false);
    expect(
      isProduct({
        ...p,
        variants: [{ id: "broken", label: "Broken", price: -2, stock: 1 }],
      }),
    ).toBe(false);
    expect(
      isProduct({ ...p, variants: [p.variants![0], p.variants![0]] }),
    ).toBe(false);
    expect(isProduct({ ...p, gallery: [{ src: "bad", label: "Bad" }] })).toBe(
      false,
    );
  });
  it("shares selected options in product links and derives variant specifications", () => {
    expect(productPath(p.id, "curio", "sand")).toBe(
      "/products/aural-studio?variant=sand",
    );
    expect(productPath("dummy-101", "dummyjson")).toBe(
      "/products/dummy-101?source=dummyjson",
    );
    expect(selectedVariant(p, "missing").id).toBe("original");
    expect(variantProduct(p, "sand")).toMatchObject({
      price: 159,
      stock: 8,
      specs: { Finish: "Sand" },
    });
  });
});
