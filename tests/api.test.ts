import { describe, expect, it, vi, beforeEach } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import catalogue from "../public/catalogue.json";
import { DEFAULT_FILTERS, isProduct, readFilters } from "../src/lib/catalogue";
import {
  getCatalogue,
  getProductPage,
  getProduct,
  pageOf,
} from "../src/lib/api";
import { createCatalogueService, mapRemoteProduct } from "../server/catalogue";
import { createApiHandler } from "../server/api";
import type { CatalogueResponse, CatalogueSource, Product } from "../src/types";

const products: Product[] = (catalogue as unknown[]).filter(isProduct);
const collection = {
  products,
  source: "curio" as const,
  requestedSource: "curio" as const,
};
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status });
const remote = {
  id: 101,
  title: "Demo Laptop",
  brand: "Sample",
  category: "laptops",
  price: 1000,
  discountPercentage: 10,
  rating: 4.7,
  stock: 3,
  thumbnail: "https://cdn.example.com/laptop.jpg",
  images: [
    "https://cdn.example.com/laptop.jpg",
    "https://cdn.example.com/laptop-side.jpg",
  ],
  description: "A demo laptop for testing.",
  warrantyInformation: "One-year demo warranty",
  reviews: [{ rating: 5, comment: "Sample review" }],
};
beforeEach(() => localStorage.clear());
async function request(
  path: string,
  method = "GET",
  service: (source: CatalogueSource) => Promise<CatalogueResponse> = async () =>
    collection,
) {
  let status = 0;
  let body = "";
  const headers: Record<string, string> = {};
  const next = vi.fn();
  const req = { url: path, method } as IncomingMessage;
  const res = {
    set statusCode(value: number) {
      status = value;
    },
    setHeader(key: string, value: string) {
      headers[key] = value;
    },
    end(value: string) {
      body = value;
    },
  } as unknown as ServerResponse;
  await createApiHandler(service)(req, res, next);
  return { status, body: body ? JSON.parse(body) : null, headers, next };
}
describe("local catalogue API", () => {
  it("preserves cached external product details during a provider outage", async () => {
    const result = await request(
      "/api/products/dummy-101?source=dummyjson",
      "GET",
      async () => ({
        ...collection,
        requestedSource: "dummyjson",
        notice: "The external demo collection is temporarily unavailable.",
      }),
    );
    expect(result.status).toBe(503);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(json(result.body, result.status)),
    );
    const cached = mapRemoteProduct(remote)!;
    expect(
      (await getProduct(cached.id, "dummyjson", [cached])).product?.id,
    ).toBe("dummy-101");
  });
  it("serves validated collection data and combined paginated filters", async () => {
    const catalogueResponse = await request("/api/catalogue");
    expect(catalogueResponse.status).toBe(200);
    expect(catalogueResponse.body.products).toHaveLength(18);
    expect(catalogueResponse.headers["Content-Type"]).toContain(
      "application/json",
    );
    const result = await request(
      "/api/products?category=Audio&q=headphones&max=200&rating=4.5&stock=1",
    );
    expect(result.body.products.map((p: Product) => p.id)).toEqual([
      "aural-studio",
    ]);
    const second = await request("/api/products?page=2&sort=price-asc");
    expect(second.body.page).toBe(2);
    expect(second.body.total).toBe(18);
    expect(second.body.products).toHaveLength(9);
    expect(second.body.products[0].id).toBe("aural-pro");
    const pastEnd = await request("/api/products?page=1000&category=Laptops");
    expect(pastEnd.body.page).toBe(1);
    expect(pastEnd.body.products).toHaveLength(4);
  });
  it("serves product details and distinguishes unknown products and routes", async () => {
    expect(
      (await request("/api/products/aural-studio")).body.product.variants,
    ).toHaveLength(2);
    expect((await request("/api/products/missing")).status).toBe(404);
    expect((await request("/api/unknown")).status).toBe(404);
    expect((await request("/api/products/%E0%A4%A")).status).toBe(400);
    expect((await request("/api/products", "POST")).status).toBe(405);
    expect(
      (await request("/products/aural-studio")).next,
    ).toHaveBeenCalledOnce();
  });
  it("returns a recoverable server error when the packaged catalogue cannot load", async () => {
    const result = await request("/api/catalogue", "GET", async () => {
      throw new Error("Missing catalogue");
    });
    expect(result.status).toBe(503);
    expect(result.body.error).toContain("Please try again");
  });
});
describe("external demo adapter", () => {
  it("maps provider data, galleries and discount prices without inventing options", () => {
    const product = mapRemoteProduct(remote)!;
    expect(isProduct(product)).toBe(true);
    expect(product.id).toBe("dummy-101");
    expect(product.category).toBe("Laptops");
    expect(product.price).toBe(900);
    expect(product.originalPrice).toBe(1000);
    expect(product.gallery).toHaveLength(2);
    expect(product.reviewCount).toBe(1);
    expect(product.variants).toBeUndefined();
    expect(mapRemoteProduct({ ...remote, price: NaN })).toBeNull();
    expect(mapRemoteProduct({ ...remote, category: undefined })).toBeNull();
    expect(
      mapRemoteProduct({ ...remote, thumbnail: "javascript:bad" }),
    ).toBeNull();
  });
  it("deduplicates parallel requests and caches a successful external catalogue", async () => {
    const remoteFetch = vi.fn().mockResolvedValue(json({ products: [remote] }));
    // Each fetch needs a fresh response because its JSON body is consumed once.
    remoteFetch.mockImplementation(async () => json({ products: [remote] }));
    const service = createCatalogueService(async () => products, remoteFetch);
    const [a, b] = await Promise.all([
      service("dummyjson"),
      service("dummyjson"),
    ]);
    expect(a.source).toBe("dummyjson");
    expect(a.products).toHaveLength(1);
    expect(b.products).toEqual(a.products);
    await service("dummyjson");
    expect(remoteFetch).toHaveBeenCalledTimes(4);
    expect(
      remoteFetch.mock.calls.every(([url]) =>
        String(url).startsWith("https://dummyjson.com/products/category/"),
      ),
    ).toBe(true);
  });
  it("falls back with an explicit notice when the external provider fails", async () => {
    const service = createCatalogueService(
      async () => products,
      vi.fn().mockResolvedValue(json({ error: "Unavailable" }, 403)),
    );
    const result = await service("dummyjson");
    expect(result.source).toBe("curio");
    expect(result.requestedSource).toBe("dummyjson");
    expect(result.products).toHaveLength(18);
    expect(result.notice).toContain("external demo collection");
  });
});
describe("frontend API recovery", () => {
  it("rejects malformed API data and recovers from the packaged catalogue", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(json({ products: [{ id: "bad" }] }))
        .mockResolvedValueOnce(json(products)),
    );
    const result = await getCatalogue("curio");
    expect(result.products).toHaveLength(18);
    expect(result.notice).toContain("packaged Curio");
  });
  it("retains a successful collection and uses it after a later request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(collection)));
    await getCatalogue("curio");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Offline")));
    expect((await getCatalogue("curio")).notice).toContain(
      "last saved collection",
    );
  });
  it("applies the current filters when a page request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Offline")));
    const filters = readFilters("?category=Audio&q=headphones&sort=price-desc");
    const result = await getProductPage("curio", filters, collection);
    expect(result.total).toBe(3);
    expect(result.products[0].id).toBe("aural-pro");
    expect(result.notice).toContain("couldn’t be refreshed");
  });
  it("uses saved details for connection failures but honors a product 404", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Offline")));
    expect(
      (await getProduct("aural-studio", "curio", products)).product?.id,
    ).toBe("aural-studio");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(json({ error: "Missing" }, 404)),
    );
    expect(
      (await getProduct("aural-studio", "curio", products)).product,
    ).toBeNull();
  });
  it("does not turn aborted requests into fallback results", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new DOMException("Aborted", "AbortError"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getCatalogue("curio", controller.signal)).rejects.toThrow(
      "Aborted",
    );
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it("paginates empty results without invalid page numbers", () => {
    const result = pageOf(
      products,
      { ...DEFAULT_FILTERS, query: "nonexistent", page: 100 },
      "curio",
    );
    expect(result.page).toBe(1);
    expect(result.total).toBe(0);
    expect(result.products).toEqual([]);
  });
});
