import {
  CATEGORIES,
  type Product,
  type Filters,
  type Sort,
  type CartItem,
} from "../types.ts";
import {
  cartProduct,
  sameVariant,
  selectedVariant,
  variantsOf,
} from "./products.ts";

export const PAGE_SIZE = 9;
export const PRICE_LIMIT = 2000;
export const DEFAULT_FILTERS: Filters = {
  query: "",
  category: "All",
  brands: [],
  minPrice: 0,
  maxPrice: PRICE_LIMIT,
  minRating: 0,
  dealsOnly: false,
  inStock: false,
  savedOnly: false,
  sort: "featured",
  page: 1,
};
const SORTS: Sort[] = ["featured", "price-asc", "price-desc", "rating", "name"];

export function readFilters(search: string): Filters {
  const params = new URLSearchParams(search);
  const category = params.get("category");
  const sort = params.get("sort");
  const finite = (key: string, fallback: number, min: number, max: number) => {
    const value = params.has(key) ? Number(params.get(key)) : fallback;
    return Number.isFinite(value)
      ? Math.max(min, Math.min(max, value))
      : fallback;
  };
  const minPrice = finite("min", 0, 0, PRICE_LIMIT);
  return {
    query: (params.get("q") ?? "").slice(0, 200),
    category: CATEGORIES.includes(category as never)
      ? (category as Filters["category"])
      : "All",
    brands: [
      ...new Set((params.get("brands") ?? "").split(",").filter(Boolean)),
    ],
    minPrice,
    maxPrice: Math.max(minPrice, finite("max", PRICE_LIMIT, 0, PRICE_LIMIT)),
    minRating: finite("rating", 0, 0, 5),
    dealsOnly: params.get("deals") === "1",
    inStock: params.get("stock") === "1",
    savedOnly: params.get("saved") === "1",
    sort: SORTS.includes(sort as Sort) ? (sort as Sort) : "featured",
    page: Math.floor(finite("page", 1, 1, 10000)),
  };
}

export function filtersToSearch(filters: Filters, productId?: string): string {
  const p = new URLSearchParams();
  if (filters.query) p.set("q", filters.query);
  if (filters.category !== "All") p.set("category", filters.category);
  if (filters.brands.length) p.set("brands", filters.brands.join(","));
  if (filters.minPrice) p.set("min", String(filters.minPrice));
  if (filters.maxPrice !== PRICE_LIMIT) p.set("max", String(filters.maxPrice));
  if (filters.minRating) p.set("rating", String(filters.minRating));
  if (filters.dealsOnly) p.set("deals", "1");
  if (filters.inStock) p.set("stock", "1");
  if (filters.savedOnly) p.set("saved", "1");
  if (filters.sort !== "featured") p.set("sort", filters.sort);
  if (filters.page > 1) p.set("page", String(filters.page));
  if (productId) p.set("product", productId);
  return p.size ? `?${p.toString()}` : "";
}

export function filterProducts(
  products: Product[],
  filters: Filters,
  saved: string[],
): Product[] {
  const terms = filters.query
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const result = products.filter((p) => {
    const text =
      `${p.name} ${p.brand} ${p.category} ${p.description} ${Object.values(p.specs).join(" ")} ${p.variants?.map((v) => v.label).join(" ") ?? ""}`.toLocaleLowerCase();
    return (
      terms.every((term) => text.includes(term)) &&
      (filters.category === "All" || p.category === filters.category) &&
      (!filters.brands.length || filters.brands.includes(p.brand)) &&
      p.price >= filters.minPrice &&
      p.price <= filters.maxPrice &&
      p.rating >= filters.minRating &&
      (!filters.dealsOnly || (p.originalPrice ?? p.price) > p.price) &&
      (!filters.inStock || p.stock > 0) &&
      (!filters.savedOnly || saved.includes(p.id))
    );
  });
  switch (filters.sort) {
    case "price-asc":
      return result.sort((a, b) => a.price - b.price);
    case "price-desc":
      return result.sort((a, b) => b.price - a.price);
    case "rating":
      return result.sort(
        (a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount,
      );
    case "name":
      return result.sort((a, b) => a.name.localeCompare(b.name));
    default:
      return result;
  }
}

export function activeFilterCount(f: Filters): number {
  return (
    Number(f.category !== "All") +
    f.brands.length +
    Number(f.minPrice !== 0 || f.maxPrice !== PRICE_LIMIT) +
    Number(f.minRating > 0) +
    Number(f.dealsOnly) +
    Number(f.inStock)
  );
}

export function updateCart(
  cart: CartItem[],
  product: Product,
  quantity: number,
  variantId?: string,
): CartItem[] {
  const variant = selectedVariant(product, variantId);
  const matches = (item: CartItem) => sameVariant(item, product, variantId);
  const others = cart.filter((item) => !matches(item));
  if (variantId && !variantsOf(product).some((v) => v.id === variantId))
    return quantity === 0 ? others : cart;
  if (!Number.isFinite(quantity)) return cart;
  const safe = Math.max(0, Math.min(variant.stock, 99, Math.floor(quantity)));
  if (safe === 0) return others;
  const line: CartItem = {
    productId: product.id,
    quantity: safe,
    ...(product.variants?.length || variantId ? { variantId: variant.id } : {}),
  };
  const index = cart.findIndex(matches);
  if (index < 0) return [...others, line];
  const next = [...others];
  next.splice(Math.min(index, next.length), 0, line);
  return next;
}
export function cartTotal(cart: CartItem[], products: Product[]): number {
  return (
    cart.reduce((cents, item) => {
      const base = products.find((p) => p.id === item.productId);
      const p = base && cartProduct(base, item);
      return (
        cents +
        (p ? Math.round(p.price * 100) * Math.min(item.quantity, p.stock) : 0)
      );
    }, 0) / 100
  );
}

export const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
export const discount = (p: Product) =>
  p.originalPrice && p.originalPrice > p.price
    ? Math.round((1 - p.price / p.originalPrice) * 100)
    : 0;

export function isProduct(value: unknown): value is Product {
  if (!value || typeof value !== "object") return false;
  const p = value as Product;
  return (
    typeof p.id === "string" &&
    p.id.length > 0 &&
    typeof p.name === "string" &&
    p.name.length > 0 &&
    typeof p.brand === "string" &&
    CATEGORIES.includes(p.category) &&
    typeof p.price === "number" &&
    Number.isFinite(p.price) &&
    p.price >= 0 &&
    (p.originalPrice === undefined ||
      (Number.isFinite(p.originalPrice) && p.originalPrice >= p.price)) &&
    typeof p.rating === "number" &&
    p.rating >= 0 &&
    p.rating <= 5 &&
    Number.isInteger(p.reviewCount) &&
    p.reviewCount >= 0 &&
    typeof p.stock === "number" &&
    Number.isInteger(p.stock) &&
    p.stock >= 0 &&
    validImage(p.image) &&
    typeof p.description === "string" &&
    typeof p.color === "string" &&
    validSpecs(p.specs) &&
    (p.source === undefined ||
      p.source === "curio" ||
      p.source === "dummyjson") &&
    (p.gallery === undefined ||
      (Array.isArray(p.gallery) &&
        p.gallery.length > 0 &&
        p.gallery.every(
          (media) =>
            media &&
            validImage(media.src) &&
            typeof media.label === "string" &&
            (media.position === undefined ||
              typeof media.position === "string") &&
            (media.scale === undefined ||
              (Number.isFinite(media.scale) &&
                media.scale >= 1 &&
                media.scale <= 3)),
        ))) &&
    (p.variants === undefined ||
      (Array.isArray(p.variants) &&
        p.variants.length > 0 &&
        new Set(p.variants.map((v) => v?.id)).size === p.variants.length &&
        p.variants.every(
          (v) =>
            v &&
            typeof v.id === "string" &&
            !!v.id &&
            typeof v.label === "string" &&
            !!v.label &&
            Number.isFinite(v.price) &&
            v.price >= 0 &&
            Number.isInteger(v.stock) &&
            v.stock >= 0 &&
            (v.color === undefined || typeof v.color === "string") &&
            (v.specs === undefined || validSpecs(v.specs)),
        )))
  );
}
function validImage(value: unknown): value is string {
  return (
    typeof value === "string" &&
    (/^\/(?!\/)/.test(value) || /^https:\/\//.test(value))
  );
}
function validSpecs(value: unknown): value is Record<string, string> {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.values(value).every((v) => typeof v === "string")
  );
}
