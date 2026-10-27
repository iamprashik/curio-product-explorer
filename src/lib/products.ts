import type {
  CartItem,
  CatalogueSource,
  Product,
  ProductVariant,
} from "../types.ts";

export function variantsOf(product: Product): ProductVariant[] {
  return product.variants?.length
    ? product.variants
    : [
        {
          id: "standard",
          label: "Standard",
          price: product.price,
          stock: product.stock,
          color: product.color,
        },
      ];
}
export function selectedVariant(product: Product, id?: string): ProductVariant {
  const variants = variantsOf(product);
  return variants.find((v) => v.id === id) ?? variants[0];
}
export function variantProduct(product: Product, variantId?: string): Product {
  const variant = selectedVariant(product, variantId);
  return {
    ...product,
    price: variant.price,
    stock: variant.stock,
    originalPrice: product.originalPrice
      ? product.originalPrice + variant.price - product.price
      : undefined,
    specs: { ...product.specs, ...variant.specs },
    color: variant.color ?? product.color,
  };
}
export const cartKey = (item: CartItem) =>
  `${item.productId}:${item.variantId ?? "standard"}`;
export function sameVariant(
  item: CartItem,
  product: Product,
  variantId?: string,
): boolean {
  return (
    item.productId === product.id &&
    (item.variantId ?? variantsOf(product)[0].id) ===
      (variantId ?? variantsOf(product)[0].id)
  );
}
export function cartProduct(
  product: Product,
  item: CartItem,
): Product | undefined {
  if (
    item.variantId &&
    !variantsOf(product).some((v) => v.id === item.variantId)
  )
    return undefined;
  return variantProduct(product, item.variantId);
}
export function productPath(
  id: string,
  source: CatalogueSource = "curio",
  variantId?: string,
): string {
  const params = new URLSearchParams();
  if (source === "dummyjson" || id.startsWith("dummy-"))
    params.set("source", "dummyjson");
  if (variantId) params.set("variant", variantId);
  return `/products/${encodeURIComponent(id)}${params.size ? "?" + params : ""}`;
}
export function mergeProducts(
  previous: Product[],
  incoming: Product[],
): Product[] {
  const map = new Map(previous.map((p) => [p.id, p]));
  incoming.forEach((p) => map.set(p.id, p));
  return [...map.values()];
}
