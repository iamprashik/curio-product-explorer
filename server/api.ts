import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { createCatalogueService } from "./catalogue.ts";
import { isProducts, pageOf } from "../src/lib/api.ts";
import { readFilters } from "../src/lib/catalogue.ts";
import type { CatalogueResponse, CatalogueSource } from "../src/types.ts";

export function createApiHandler(
  collection: (source: CatalogueSource) => Promise<CatalogueResponse>,
) {
  return async (
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void,
  ) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (!url.pathname.startsWith("/api/")) return next();
    const json = (status: number, body: unknown) => {
      res.statusCode = status;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.end(JSON.stringify(body));
    };
    if (req.method !== "GET")
      return json(405, { error: "Only GET requests are supported." });
    const source =
      url.searchParams.get("source") === "dummyjson" ? "dummyjson" : "curio";
    const validRoute =
      url.pathname === "/api/catalogue" ||
      url.pathname === "/api/products" ||
      /^\/api\/products\/[^/]+$/.test(url.pathname);
    if (!validRoute) return json(404, { error: "API route not found." });
    try {
      const data = await collection(source);
      if (url.pathname === "/api/catalogue") return json(200, data);
      if (url.pathname === "/api/products") {
        const filters = { ...readFilters(url.search), savedOnly: false };
        return json(200, {
          ...pageOf(data.products, filters, data.source),
          notice: data.notice,
        });
      }
      let id: string;
      try {
        id = decodeURIComponent(url.pathname.split("/").at(-1)!);
      } catch {
        return json(400, { error: "Invalid product id." });
      }
      const product = data.products.find((p) => p.id === id);
      if (!product && data.source !== data.requestedSource)
        return json(503, {
          error:
            data.notice ??
            "The external product collection is temporarily unavailable.",
        });
      return product
        ? json(200, { product, source: data.source, notice: data.notice })
        : json(404, { error: "This product is not in the collection." });
    } catch {
      return json(503, {
        error: "The catalogue is unavailable. Please try again.",
      });
    }
  };
}
export function catalogueApi(root: string): Plugin {
  const readCurio = async () => {
    const value: unknown = JSON.parse(
      await readFile(resolve(root, "public/catalogue.json"), "utf8"),
    );
    if (!isProducts(value) || !value.length)
      throw new Error("Invalid packaged catalogue");
    return value;
  };
  const handler = createApiHandler(createCatalogueService(readCurio));
  return {
    name: "curio-local-catalogue-api",
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}
