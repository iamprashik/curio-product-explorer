export const CATEGORIES = [
  "Audio",
  "Laptops",
  "Cameras",
  "Wearables",
  "Accessories",
] as const;
export type Category = (typeof CATEGORIES)[number];
export interface Product {
  id: string;
  name: string;
  brand: string;
  category: Category;
  price: number;
  originalPrice?: number;
  rating: number;
  reviewCount: number;
  image: string;
  description: string;
  stock: number;
  badge?: "Bestseller" | "New arrival" | "Great value";
  color: string;
  specs: Record<string, string>;
  gallery?: ProductMedia[];
  variants?: ProductVariant[];
  source?: CatalogueSource;
}
export type CatalogueSource = "curio" | "dummyjson";
export interface ProductMedia {
  src: string;
  label: string;
  position?: string;
  scale?: number;
}
export interface ProductVariant {
  id: string;
  label: string;
  price: number;
  stock: number;
  color?: string;
  specs?: Record<string, string>;
}
export interface CatalogueResponse {
  products: Product[];
  source: CatalogueSource;
  requestedSource: CatalogueSource;
  notice?: string;
}
export interface ProductsResponse {
  products: Product[];
  total: number;
  page: number;
  pageSize: number;
  source: CatalogueSource;
  notice?: string;
}
export type Sort = "featured" | "price-asc" | "price-desc" | "rating" | "name";
export interface Filters {
  query: string;
  category: Category | "All";
  brands: string[];
  minPrice: number;
  maxPrice: number;
  minRating: number;
  dealsOnly: boolean;
  inStock: boolean;
  savedOnly: boolean;
  sort: Sort;
  page: number;
}
export interface CartItem {
  productId: string;
  quantity: number;
  variantId?: string;
}
