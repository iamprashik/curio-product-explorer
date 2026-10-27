import type {
  CatalogueResponse,
  CatalogueSource,
  Filters,
  Product,
  ProductsResponse,
} from "../types.ts";
import {
  filterProducts,
  filtersToSearch,
  isProduct,
  PAGE_SIZE,
} from "./catalogue.ts";

export const isProducts = (value: unknown): value is Product[] =>
  Array.isArray(value) &&
  value.every(isProduct) &&
  new Set(value.map((p) => p.id)).size === value.length;
export function pageOf(
  products: Product[],
  filters: Filters,
  source: CatalogueSource,
  saved: string[] = [],
): ProductsResponse {
  const matches = filterProducts(products, filters, saved);
  const page = Math.min(
    filters.page,
    Math.max(1, Math.ceil(matches.length / PAGE_SIZE)),
  );
  return {
    products: matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    total: matches.length,
    page,
    pageSize: PAGE_SIZE,
    source,
  };
}
const cacheKey = (source: CatalogueSource) => `curio.catalogue.${source}.v2`;
export function readCatalogueCache(
  source: CatalogueSource,
): CatalogueResponse | undefined {
  try {
    const data: unknown = JSON.parse(
      localStorage.getItem(cacheKey(source)) ?? "null",
    );
    if (validCatalogue(data)) return data;
    if (source === "curio") {
      const legacy: unknown = JSON.parse(
        localStorage.getItem("curio.catalogue.v1") ?? "null",
      );
      if (isProducts(legacy) && legacy.length)
        return { products: legacy, source, requestedSource: source };
    }
  } catch {
    /* Cache is optional. */
  }
}
function validCatalogue(value: unknown): value is CatalogueResponse {
  if (!value || typeof value !== "object") return false;
  const data = value as CatalogueResponse;
  return (
    isProducts(data.products) &&
    data.products.length > 0 &&
    ["curio", "dummyjson"].includes(data.source) &&
    ["curio", "dummyjson"].includes(data.requestedSource) &&
    (data.notice === undefined || typeof data.notice === "string")
  );
}
function saveCatalogue(data: CatalogueResponse) {
  try {
    localStorage.setItem(cacheKey(data.requestedSource), JSON.stringify(data));
  } catch {
    /* Still usable when storage is disabled. */
  }
}
async function jsonRequest(
  url: string,
  signal?: AbortSignal,
): Promise<unknown> {
  const response = await fetch(url, { signal });
  if (!response.ok)
    throw new Error("The collection could not be loaded. Please try again.");
  return response.json();
}
export async function getCatalogue(
  source: CatalogueSource,
  signal?: AbortSignal,
): Promise<CatalogueResponse> {
  try {
    const data = await jsonRequest(`/api/catalogue?source=${source}`, signal);
    if (!validCatalogue(data))
      throw new Error("The catalogue returned unexpected data.");
    saveCatalogue(data);
    return data;
  } catch (error) {
    if (signal?.aborted) throw error;
    const cached = readCatalogueCache(source);
    if (cached)
      return {
        ...cached,
        notice:
          "You’re viewing your last saved collection. Reconnect to refresh it.",
      };
    try {
      const data = await jsonRequest("/catalogue.json", signal);
      if (!isProducts(data) || !data.length) throw error;
      return {
        products: data,
        source: "curio",
        requestedSource: source,
        notice:
          "The catalogue connection is unavailable. Showing the packaged Curio collection.",
      };
    } catch {
      if (signal?.aborted) throw error;
      throw error instanceof Error
        ? error
        : new Error("The collection could not be loaded. Please try again.");
    }
  }
}
export async function getProductPage(
  source: CatalogueSource,
  filters: Filters,
  catalogue: CatalogueResponse,
  signal?: AbortSignal,
): Promise<ProductsResponse> {
  const params = new URLSearchParams(filtersToSearch(filters));
  params.set("source", source);
  try {
    const value = await jsonRequest(`/api/products?${params}`, signal);
    if (!value || typeof value !== "object")
      throw new Error("Invalid product results.");
    const data = value as ProductsResponse;
    if (
      !isProducts(data.products) ||
      !Number.isInteger(data.total) ||
      data.total < 0 ||
      !Number.isInteger(data.page) ||
      data.page < 1 ||
      data.pageSize !== PAGE_SIZE ||
      !["curio", "dummyjson"].includes(data.source) ||
      (data.notice !== undefined && typeof data.notice !== "string")
    )
      throw new Error("Invalid product results.");
    return data;
  } catch (error) {
    if (signal?.aborted) throw error;
    return {
      ...pageOf(catalogue.products, filters, catalogue.source),
      notice:
        "The latest results couldn’t be refreshed. Showing results from the saved collection.",
    };
  }
}
export async function getProduct(
  id: string,
  source: CatalogueSource,
  fallback: Product[],
  signal?: AbortSignal,
): Promise<{ product: Product | null; notice?: string }> {
  try {
    const response = await fetch(
      `/api/products/${encodeURIComponent(id)}?source=${source}`,
      { signal },
    );
    if (response.status === 404) return { product: null };
    if (!response.ok)
      throw new Error("Product details could not be refreshed.");
    const value: unknown = await response.json();
    if (
      !value ||
      typeof value !== "object" ||
      !isProduct((value as { product: unknown }).product)
    )
      throw new Error("Invalid product details.");
    const data = value as { product: Product; notice?: string };
    if (
      data.product.id !== id ||
      (data.notice !== undefined && typeof data.notice !== "string")
    )
      throw new Error("Unexpected product details.");
    return data;
  } catch (error) {
    if (signal?.aborted) throw error;
    const product = fallback.find((p) => p.id === id);
    if (product)
      return {
        product,
        notice:
          "These are your saved product details. Reconnect to refresh them.",
      };
    throw error;
  }
}
