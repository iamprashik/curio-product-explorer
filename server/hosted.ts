import type { IncomingMessage, ServerResponse } from "node:http";
import type { Product } from "../src/types.ts";
import { createApiHandler } from "./api.ts";
import { createCatalogueService } from "./catalogue.ts";

// Vercel adds rewrite parameters to query. The local Vite API does not use this adapter.
export type HostedRequest = IncomingMessage & {
  query?: Record<string, string | string[] | undefined>;
};

export function hostedApiUrl(req: HostedRequest): string {
  const url = new URL(req.url ?? "/", "http://localhost");
  // Depending on routing, Vercel can expose the original URL or the function URL.
  // Original API URLs are already understood by the shared API handler.
  if (url.pathname !== "/api" && url.pathname !== "/api/index") {
    return url.pathname + url.search;
  }
  const params = new URLSearchParams(url.search);
  for (const [key, value] of Object.entries(req.query ?? {})) {
    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first === "string") params.set(key, first);
  }
  const route = params.get("__curio_route");
  const id = params.get("__curio_id");
  params.delete("__curio_route");
  params.delete("__curio_id");
  const pathname =
    route === "catalogue"
      ? "/api/catalogue"
      : route === "products"
        ? "/api/products"
        : route === "product" && id
          ? "/api/products/" + encodeURIComponent(id)
          : "/api/not-found";
  return pathname + (params.size ? "?" + params : "");
}

export function createHostedHandler(
  readCatalogue: () => Promise<Product[]>,
  remoteFetch: typeof fetch = fetch,
) {
  const api = createApiHandler(
    createCatalogueService(readCatalogue, remoteFetch),
  );
  return async function handler(
    req: HostedRequest,
    res: ServerResponse,
  ): Promise<void> {
    const original = req.url;
    try {
      req.url = hostedApiUrl(req);
    } catch {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: "Invalid request URL." }));
      return;
    }
    try {
      await api(req, res, () => {
        res.statusCode = 404;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ error: "API route not found." }));
      });
    } finally {
      req.url = original;
    }
  };
}
