import type {
  CatalogueResponse,
  CatalogueSource,
  Product,
} from "../src/types.ts";
import { isProduct } from "../src/lib/catalogue.ts";

interface RemoteProduct {
  id: number;
  title: string;
  brand?: string;
  category: string;
  price: number;
  discountPercentage?: number;
  rating: number;
  stock: number;
  thumbnail: string;
  images?: string[];
  description: string;
  weight?: number;
  dimensions?: { width: number; height: number; depth: number };
  warrantyInformation?: string;
  reviews?: { rating: number; comment: string }[];
}
export function mapRemoteProduct(raw: unknown): Product | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as RemoteProduct;
  if (
    !Number.isInteger(p.id) ||
    typeof p.title !== "string" ||
    typeof p.category !== "string" ||
    typeof p.price !== "number" ||
    !Number.isFinite(p.price) ||
    p.price < 0 ||
    typeof p.thumbnail !== "string" ||
    !/^https:\/\//.test(p.thumbnail) ||
    !Number.isFinite(p.rating) ||
    !Number.isInteger(p.stock) ||
    p.stock < 0 ||
    typeof p.description !== "string"
  )
    return null;
  const category =
    p.category === "laptops"
      ? "Laptops"
      : p.category === "mobile-accessories" &&
          /headphone|airpod|speaker|earbud/i.test(p.title)
        ? "Audio"
        : "Accessories";
  const images = [
    ...new Set([
      p.thumbnail,
      ...(Array.isArray(p.images)
        ? p.images.filter((x) => typeof x === "string" && /^https:\/\//.test(x))
        : []),
    ]),
  ];
  const specs: Record<string, string> = {};
  if (typeof p.warrantyInformation === "string")
    specs.Warranty = p.warrantyInformation;
  specs.Collection = p.category.replaceAll("-", " ");
  if (!Object.keys(specs).length)
    specs.Collection = p.category.replaceAll("-", " ");
  const hasDiscount =
    typeof p.discountPercentage === "number" &&
    p.discountPercentage > 0 &&
    p.discountPercentage < 100;
  const price = hasDiscount
    ? Math.round(p.price * (1 - p.discountPercentage! / 100) * 100) / 100
    : p.price;
  const originalPrice = hasDiscount ? p.price : undefined;
  const product: Product = {
    id: `dummy-${p.id}`,
    name: p.title,
    brand: typeof p.brand === "string" && p.brand ? p.brand : "Independent",
    category,
    price,
    originalPrice,
    rating: Math.min(5, Math.max(0, p.rating)),
    stock: p.stock,
    reviewCount: Array.isArray(p.reviews) ? p.reviews.length : 0,
    image: images[0],
    gallery: images.map((src, i) => ({
      src,
      label: i === 0 ? "Main photo" : `Photo ${i + 1}`,
    })),
    description: p.description,
    color: "#74717c",
    source: "dummyjson",
    specs,
  };
  return isProduct(product) ? product : null;
}
export function createCatalogueService(
  readCurio: () => Promise<Product[]>,
  remoteFetch: typeof fetch = fetch,
) {
  let remoteCache: { products: Product[]; until: number } | undefined;
  let pending: Promise<Product[]> | undefined;
  async function remote(): Promise<Product[]> {
    if (remoteCache && remoteCache.until > Date.now())
      return remoteCache.products;
    if (!pending)
      pending = (async () => {
        const categories = [
          "mobile-accessories",
          "laptops",
          "smartphones",
          "tablets",
        ];
        const lists = await Promise.all(
          categories.map(async (category) => {
            const response = await remoteFetch(
              `https://dummyjson.com/products/category/${category}?limit=0`,
              { signal: AbortSignal.timeout(7000) },
            );
            if (!response.ok)
              throw new Error(`Demo provider returned ${response.status}`);
            const body: unknown = await response.json();
            if (
              !body ||
              typeof body !== "object" ||
              !Array.isArray((body as { products: unknown }).products)
            )
              throw new Error("Invalid demo response");
            return (body as { products: unknown[] }).products
              .map(mapRemoteProduct)
              .filter((p): p is Product => p !== null);
          }),
        );
        const products = [
          ...new Map(lists.flat().map((p) => [p.id, p])).values(),
        ];
        if (!products.length) throw new Error("Empty demo collection");
        remoteCache = { products, until: Date.now() + 60_000 };
        return products;
      })().finally(() => {
        pending = undefined;
      });
    return pending;
  }
  return async (
    requestedSource: CatalogueSource,
  ): Promise<CatalogueResponse> => {
    if (requestedSource === "curio")
      return { products: await readCurio(), source: "curio", requestedSource };
    try {
      return { products: await remote(), source: "dummyjson", requestedSource };
    } catch {
      return {
        products: await readCurio(),
        source: "curio",
        requestedSource,
        notice:
          "The external demo collection is temporarily unavailable. Curio’s collection is available below.",
      };
    }
  };
}
