import { describe, expect, it } from "vitest";
import catalogue from "../public/catalogue.json";
import {
  cartTotal,
  DEFAULT_FILTERS,
  filterProducts,
  filtersToSearch,
  isProduct,
  readFilters,
  updateCart,
} from "../src/lib/catalogue";
import { isCart, isStringList } from "../src/lib/storage";
import type { Product } from "../src/types";

const products: Product[] = (catalogue as unknown[]).filter(isProduct);
describe("catalogue discovery", () => {
  it("combines category, brand, search, price, rating, and availability", () => {
    const filtered = filterProducts(
      products,
      {
        ...DEFAULT_FILTERS,
        query: "headphones",
        category: "Audio",
        brands: ["Aural"],
        maxPrice: 200,
        minRating: 4.5,
        inStock: true,
      },
      [],
    );
    expect(filtered.map((p) => p.id)).toEqual(["aural-studio"]);
  });
  it("finds multiple search terms across product fields and ignores case", () => {
    const filtered = filterProducts(
      products,
      { ...DEFAULT_FILTERS, query: "FORMA  laptop" },
      [],
    );
    expect(filtered).toHaveLength(4);
  });
  it("sorts prices without mutating catalogue order", () => {
    const original = products.map((p) => p.id);
    const sorted = filterProducts(
      products,
      { ...DEFAULT_FILTERS, sort: "price-asc" },
      [],
    );
    expect(sorted[0].price).toBe(49);
    expect(sorted.at(-1)?.price).toBe(1499);
    expect(products.map((p) => p.id)).toEqual(original);
  });
  it("limits the saved view to saved products", () => {
    expect(
      filterProducts(products, { ...DEFAULT_FILTERS, savedOnly: true }, [
        "tempo-day",
      ]).map((p) => p.id),
    ).toEqual(["tempo-day"]);
  });
  it("excludes sold-out items when the availability filter is active", () => {
    expect(
      filterProducts(products, { ...DEFAULT_FILTERS, inStock: true }, []).some(
        (p) => p.stock === 0,
      ),
    ).toBe(false);
  });
});
describe("bookmarkable filters", () => {
  it("round-trips a complete filter combination and selected product", () => {
    const f = {
      ...DEFAULT_FILTERS,
      query: "camera & lens",
      category: "Cameras" as const,
      brands: ["Moment"],
      minPrice: 100,
      maxPrice: 750,
      minRating: 4.5,
      sort: "rating" as const,
      dealsOnly: true,
      savedOnly: true,
      page: 2,
    };
    const search = filtersToSearch(f, "moment-travel");
    expect(readFilters(search)).toEqual(f);
    expect(new URLSearchParams(search).get("product")).toBe("moment-travel");
  });
  it("sanitises malformed ranges, categories, and page numbers", () => {
    expect(
      readFilters("?category=bad&min=-50&max=nope&rating=99&page=NaN&sort=bad"),
    ).toEqual({ ...DEFAULT_FILTERS, minRating: 5 });
    expect(readFilters("?min=999&max=10").maxPrice).toBe(999);
    expect(readFilters("?page=2.6").page).toBe(2);
  });
});
describe("shopping bag", () => {
  const p = products[0];
  it("caps quantities at available stock and removes zero quantities", () => {
    const full = updateCart([], p, 1000);
    expect(full).toEqual([
      { productId: p.id, variantId: p.variants![0].id, quantity: p.stock },
    ]);
    expect(updateCart(full, p, 0)).toEqual([]);
    expect(
      updateCart(
        [],
        products.find((p) => p.stock === 0)!,
        1,
      ),
    ).toEqual([]);
  });
  it("updates existing quantities without duplicate bag lines", () => {
    expect(updateCart([{ productId: p.id, quantity: 1 }], p, 3)).toEqual([
      { productId: p.id, variantId: p.variants![0].id, quantity: 3 },
    ]);
  });
  it("calculates totals in cents and ignores removed catalogue items", () => {
    const fractional = { ...p, variants: undefined, price: 0.1 };
    expect(
      cartTotal(
        [
          { productId: p.id, quantity: 3 },
          { productId: "missing", quantity: 2 },
        ],
        [fractional],
      ),
    ).toBe(0.3);
  });
});
describe("stored data validation", () => {
  it("rejects invalid or duplicate saved ids and cart entries", () => {
    expect(isStringList(["one", "one"])).toBe(false);
    expect(isStringList([23])).toBe(false);
    expect(isCart([{ productId: "one", quantity: -4 }])).toBe(false);
    expect(isCart([{ productId: "one", quantity: 0.5 }])).toBe(false);
    expect(
      isCart([
        { productId: "one", quantity: 1 },
        { productId: "one", quantity: 2 },
      ]),
    ).toBe(false);
  });
  it("ensures every sample product uses a valid, unique id", () => {
    expect(products).toHaveLength(catalogue.length);
    expect(new Set(products.map((p) => p.id)).size).toBe(products.length);
  });
});
