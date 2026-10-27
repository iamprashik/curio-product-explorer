import { describe, expect, it } from "vitest";
import type { ServerResponse } from "node:http";
import handler from "../api/index";
import { hostedApiUrl, type HostedRequest } from "../server/hosted";

async function request(
  url: string,
  query?: HostedRequest["query"],
  method = "GET",
) {
  let status = 200;
  let body = "";
  const headers: Record<string, string> = {};
  const req = { url, query, method } as HostedRequest;
  const res = {
    set statusCode(value: number) {
      status = value;
    },
    setHeader(name: string, value: string) {
      headers[name] = value;
    },
    end(value: string) {
      body = value;
    },
  } as unknown as ServerResponse;
  await handler(req, res);
  return { status, body: JSON.parse(body), headers, url: req.url };
}
describe("hosted catalogue function", () => {
  it("serves the bundled catalogue at the original API URL", async () => {
    const result = await request("/api/catalogue?source=curio");
    expect(result.status).toBe(200);
    expect(result.body.products).toHaveLength(18);
    expect(result.body.source).toBe("curio");
    expect(result.headers["Content-Type"]).toContain("application/json");
    expect(result.url).toBe("/api/catalogue?source=curio");
  });
  it("serves catalogue requests when Vercel supplies rewrite query parameters", async () => {
    const result = await request("/api", {
      __curio_route: "catalogue",
      source: "curio",
    });
    expect(result.status).toBe(200);
    expect(result.body.products).toHaveLength(18);
  });
  it("preserves combined filters and pagination through the rewrite", async () => {
    const result = await request("/api?__curio_route=products", {
      category: "Audio",
      q: "headphones",
      max: "200",
      rating: "4.5",
      stock: "1",
    });
    expect(result.body.products.map((p: { id: string }) => p.id)).toEqual([
      "aural-studio",
    ]);
    const second = await request("/api/index", {
      __curio_route: "products",
      page: "2",
      sort: "price-asc",
    });
    expect(second.body.page).toBe(2);
    expect(second.body.total).toBe(18);
    expect(second.body.products).toHaveLength(9);
  });
  it("resolves a product and its options through the dynamic rewrite", async () => {
    const result = await request("/api", {
      __curio_route: "product",
      __curio_id: "aural-studio",
    });
    expect(result.body.product.variants).toHaveLength(2);
    expect(result.body.product.variants[1]).toMatchObject({
      id: "sand",
      price: 159,
      stock: 8,
    });
    expect(
      (
        await request("/api", {
          __curio_route: "product",
          __curio_id: "missing",
        })
      ).status,
    ).toBe(404);
  });
  it("rejects unsupported methods and unknown routes as JSON", async () => {
    expect(
      (await request("/api", { __curio_route: "catalogue" }, "POST")).status,
    ).toBe(405);
    expect((await request("/api", { __curio_route: "missing" })).status).toBe(
      404,
    );
    expect((await request("/api/unknown")).status).toBe(404);
    expect((await request("/other-path")).status).toBe(404);
  });
  it("keeps query values out of the product path and removes internal route parameters", () => {
    const url = hostedApiUrl({
      url: "/api?__curio_route=product&__curio_id=camera%2Ftest&source=curio",
      method: "GET",
    } as HostedRequest);
    expect(url).toBe("/api/products/camera%2Ftest?source=curio");
    expect(
      hostedApiUrl({
        url: "/api",
        query: { __curio_route: ["products"], q: ["headphones", "ignored"] },
      } as unknown as HostedRequest),
    ).toBe("/api/products?q=headphones");
  });
});
