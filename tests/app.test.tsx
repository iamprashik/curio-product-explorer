import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "../src/App";
import catalogue from "../public/catalogue.json";
import { isProduct, readFilters } from "../src/lib/catalogue";
import { pageOf } from "../src/lib/api";
import type { CatalogueResponse, Product } from "../src/types";

const products: Product[] = (catalogue as unknown[]).filter(isProduct);
const data: CatalogueResponse = {
  products,
  source: "curio",
  requestedSource: "curio",
};
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status });
function apiFetch(url: string) {
  const request = new URL(url, "http://localhost");
  if (request.pathname === "/catalogue.json")
    return Promise.resolve(json(products));
  if (request.pathname === "/api/catalogue")
    return Promise.resolve(
      json({
        ...data,
        requestedSource: request.searchParams.get("source") ?? "curio",
      }),
    );
  if (request.pathname === "/api/products")
    return Promise.resolve(
      json(pageOf(products, readFilters(request.search), "curio")),
    );
  const product = products.find(
    (p) => p.id === decodeURIComponent(request.pathname.split("/").at(-1)!),
  );
  return Promise.resolve(
    json(
      product ? { product, source: "curio" } : { error: "Missing" },
      product ? 200 : 404,
    ),
  );
}
function mount() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>,
  );
}
const load = async () => {
  mount();
  await screen.findByRole("link", { name: "View Studio Wireless Headphones" });
};
beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/");
  vi.stubGlobal("fetch", vi.fn(apiFetch));
});

describe("catalogue and shopping workflows", () => {
  it("combines filters and sorting and sends them to the API and URL", async () => {
    const user = userEvent.setup();
    await load();
    await user.click(screen.getByRole("button", { name: "Audio" }));
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(6));
    await user.type(
      screen.getByRole("combobox", { name: "Search products" }),
      "headphones",
    );
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(3));
    await user.selectOptions(screen.getByLabelText("Sort by:"), "price-desc");
    await waitFor(() =>
      expect(
        within(screen.getAllByRole("article")[0]).getByRole("heading"),
      ).toHaveTextContent("Studio Pro Headphones"),
    );
    expect(window.location.search).toContain("q=headphones");
    expect(window.location.search).toContain("category=Audio");
    expect(window.location.search).toContain("sort=price-desc");
    expect(
      vi
        .mocked(fetch)
        .mock.calls.some(
          ([url]) =>
            String(url).includes("/api/products?") &&
            String(url).includes("sort=price-desc"),
        ),
    ).toBe(true);
  });
  it("saves a product and shows it in the saved collection", async () => {
    const user = userEvent.setup();
    await load();
    await user.click(
      screen.getByRole("button", { name: "Save Studio Wireless Headphones" }),
    );
    expect(JSON.parse(localStorage.getItem("curio.saved.v1")!)).toContain(
      "aural-studio",
    );
    await user.click(
      screen.getByRole("button", { name: "Saved products (1)" }),
    );
    expect(
      screen.getByRole("heading", { name: /Your saved finds/ }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(1);
  });
  it("changes bag quantity and continues to checkout", async () => {
    const user = userEvent.setup();
    await load();
    await user.click(
      screen.getByRole("button", {
        name: "Add Studio Wireless Headphones to bag",
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Open shopping bag (1 items)" }),
    );
    const bag = screen.getByRole("dialog", { name: "Your shopping bag" });
    await user.click(
      within(bag).getByRole("button", {
        name: "Increase quantity of Studio Wireless Headphones, Original finish",
      }),
    );
    expect(
      within(bag).getByLabelText(
        "Quantity of Studio Wireless Headphones, Original finish",
      ),
    ).toHaveTextContent("2");
    expect(JSON.parse(localStorage.getItem("curio.cart.v1")!)[0].quantity).toBe(
      2,
    );
    expect(within(bag).getAllByText("$298")).toHaveLength(2);
    await user.click(
      within(bag).getByRole("button", { name: "Continue to checkout" }),
    );
    expect(
      await screen.findByRole("heading", { name: /Make them yours/ }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/checkout");
    expect(JSON.parse(localStorage.getItem("curio.cart.v1")!)[0].quantity).toBe(
      2,
    );
  });
  it("restores a bag from the first version", async () => {
    localStorage.setItem(
      "curio.cart.v1",
      JSON.stringify([{ productId: "aural-studio", quantity: 2 }]),
    );
    await load();
    expect(
      screen.getByRole("button", { name: "Open shopping bag (2 items)" }),
    ).toBeInTheDocument();
  });
  it("limits comparison to three products and shows their specifications", async () => {
    const user = userEvent.setup();
    await load();
    const names = [
      "Studio Wireless Headphones",
      "Air 13 Laptop",
      "Travel Mirrorless Camera",
    ];
    for (const name of names)
      await user.click(
        screen.getByRole("button", { name: `Add ${name} to comparison` }),
      );
    await user.click(
      screen.getByRole("button", { name: "Add Daylight Watch to comparison" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Compare up to 3 products",
    );
    expect(JSON.parse(localStorage.getItem("curio.compare.v1")!)).toHaveLength(
      3,
    );
    await user.click(screen.getByRole("button", { name: "Compare (3)" }));
    const comparison = screen.getByRole("dialog", {
      name: "Find your perfect fit",
    });
    expect(within(comparison).getByRole("table")).toBeInTheDocument();
    for (const name of names)
      expect(within(comparison).getByText(name)).toBeInTheDocument();
    expect(within(comparison).getByText("30-hour battery")).toBeInTheDocument();
  });
  it("recovers from an empty search", async () => {
    const user = userEvent.setup();
    await load();
    await user.type(
      screen.getByRole("combobox", { name: "Search products" }),
      "nonexistentfind",
    );
    await screen.findByText("No finds just yet.");
    await user.click(
      screen.getByRole("button", { name: "Reset search & filters" }),
    );
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(9));
    expect(
      screen.getByRole("combobox", { name: "Search products" }),
    ).toHaveValue("");
  });
  it("retries a catalogue connection after all fallbacks fail", async () => {
    let offline = true;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        offline ? Promise.reject(new Error("Connection lost")) : apiFetch(url),
      ),
    );
    const user = userEvent.setup();
    mount();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Connection lost",
    );
    offline = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByRole("link", {
      name: "View Studio Wireless Headphones",
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("uses a validated legacy catalogue when the connection is unavailable", async () => {
    localStorage.setItem("curio.catalogue.v1", JSON.stringify(products));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Offline")));
    await load();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "last saved collection",
    );
    expect(screen.getAllByRole("article")).toHaveLength(9);
  });
});

describe("product pages, options and search", () => {
  it("keeps an earlier collection’s bag and saved products after changing sources", async () => {
    const external: Product = {
      ...products[1],
      id: "dummy-101",
      name: "External Demo Laptop",
      source: "dummyjson",
      variants: undefined,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        const request = new URL(url, "http://localhost");
        if (request.searchParams.get("source") !== "dummyjson")
          return apiFetch(url);
        if (request.pathname === "/api/catalogue")
          return Promise.resolve(
            json({
              products: [external],
              source: "dummyjson",
              requestedSource: "dummyjson",
            }),
          );
        return Promise.resolve(
          json(pageOf([external], readFilters(request.search), "dummyjson")),
        );
      }),
    );
    const user = userEvent.setup();
    await load();
    await user.click(
      screen.getByRole("button", {
        name: "Add Studio Wireless Headphones to bag",
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Save Studio Wireless Headphones" }),
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Catalogue source" }),
      "dummyjson",
    );
    await screen.findByRole("link", { name: "View External Demo Laptop" });
    await user.click(
      screen.getByRole("button", { name: "Open shopping bag (1 items)" }),
    );
    expect(
      within(
        screen.getByRole("dialog", { name: "Your shopping bag" }),
      ).getByText("Studio Wireless Headphones"),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Close Your shopping bag" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Saved products (1)" }),
    );
    expect(
      screen.getByRole("link", { name: "View Studio Wireless Headphones" }),
    ).toBeInTheDocument();
  });
  it("shows and removes an unavailable stored option without charging for it", async () => {
    localStorage.setItem(
      "curio.cart.v1",
      JSON.stringify([
        { productId: "aural-studio", variantId: "removed-option", quantity: 2 },
      ]),
    );
    const user = userEvent.setup();
    await load();
    await user.click(
      screen.getByRole("button", { name: "Open shopping bag (0 items)" }),
    );
    const bag = screen.getByRole("dialog", { name: "Your shopping bag" });
    expect(
      within(bag).getByText(/aren’t included in your total/),
    ).toBeInTheDocument();
    expect(
      within(bag).queryByRole("button", { name: "Complete demo order" }),
    ).not.toBeInTheDocument();
    await user.click(
      within(bag).getByRole("button", {
        name: "Remove unavailable Studio Wireless Headphones, item 1",
      }),
    );
    expect(JSON.parse(localStorage.getItem("curio.cart.v1")!)).toEqual([]);
  });
  it("returns from a product page to the same filters and sort", async () => {
    const user = userEvent.setup();
    await load();
    await user.click(screen.getByRole("button", { name: "Audio" }));
    await user.selectOptions(screen.getByLabelText("Sort by:"), "price-desc");
    await screen.findByRole("link", {
      name: "View Studio Wireless Headphones",
    });
    await user.click(
      screen.getByRole("link", { name: "View Studio Wireless Headphones" }),
    );
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Studio Wireless Headphones",
      }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/products/aural-studio");
    await user.click(screen.getByRole("button", { name: "Back to results" }));
    await screen.findByRole("link", {
      name: "View Studio Wireless Headphones",
    });
    expect(window.location.search).toContain("category=Audio");
    expect(window.location.search).toContain("sort=price-desc");
  });
  it("selects an option from a deep link and keeps its price separate in the bag", async () => {
    window.history.replaceState(
      null,
      "",
      "/products/aural-studio?variant=sand",
    );
    const user = userEvent.setup();
    mount();
    await screen.findByRole("heading", {
      level: 1,
      name: "Studio Wireless Headphones",
    });
    expect(screen.getByRole("radio", { name: /Sand finish/ })).toBeChecked();
    await user.click(
      screen.getByRole("button", { name: "Increase product quantity" }),
    );
    await user.click(screen.getByRole("button", { name: "Add to bag · $318" }));
    await user.click(screen.getByRole("radio", { name: /Original finish/ }));
    await user.click(screen.getByRole("button", { name: "Add to bag · $149" }));
    await user.click(
      screen.getByRole("button", { name: "Open shopping bag (3 items)" }),
    );
    const bag = screen.getByRole("dialog", { name: "Your shopping bag" });
    expect(within(bag).getAllByText("$467")).toHaveLength(2);
    expect(
      within(bag).getByLabelText(
        "Quantity of Studio Wireless Headphones, Sand finish",
      ),
    ).toHaveTextContent("2");
    expect(
      within(bag).getByLabelText(
        "Quantity of Studio Wireless Headphones, Original finish",
      ),
    ).toHaveTextContent("1");
    await user.click(
      within(bag).getByRole("button", {
        name: "Increase quantity of Studio Wireless Headphones, Sand finish",
      }),
    );
    expect(within(bag).getAllByText("$626")).toHaveLength(2);
    expect(JSON.parse(localStorage.getItem("curio.cart.v1")!)).toEqual([
      { productId: "aural-studio", variantId: "sand", quantity: 3 },
      { productId: "aural-studio", variantId: "original", quantity: 1 },
    ]);
  });
  it("caps purchases at the selected option stock and prevents a sold-out option purchase", async () => {
    window.history.replaceState(
      null,
      "",
      "/products/forma-air?variant=more-storage",
    );
    const user = userEvent.setup();
    mount();
    await screen.findByRole("heading", { name: "Air 13 Laptop", level: 1 });
    for (let n = 0; n < 5; n++)
      await user.click(
        screen.getByRole("button", { name: "Increase product quantity" }),
      );
    expect(screen.getByLabelText("Product quantity")).toHaveTextContent("4");
    expect(
      screen.getByRole("button", { name: "Increase product quantity" }),
    ).toBeDisabled();
    await user.click(
      screen.getByRole("button", { name: "Add to bag · $4,196" }),
    );
    expect(
      screen.getByRole("button", { name: "All available items in bag" }),
    ).toBeDisabled();
  });
  it("shows a sold-out product without an active purchase button", async () => {
    window.history.replaceState(null, "", "/products/moment-film");
    mount();
    await screen.findByRole("heading", {
      name: "Retro Mirrorless Camera",
      level: 1,
    });
    expect(screen.getByRole("button", { name: "Sold out" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Increase product quantity" }),
    ).toBeDisabled();
  });
  it("opens a gallery crop and closes the enlarged dialog with Escape", async () => {
    window.history.replaceState(null, "", "/products/aural-studio");
    const user = userEvent.setup();
    mount();
    await screen.findByRole("heading", {
      level: 1,
      name: "Studio Wireless Headphones",
    });
    await user.click(screen.getByRole("button", { name: "Show Detail crop" }));
    await user.click(
      screen.getByRole("button", { name: "Enlarge Detail crop" }),
    );
    const gallery = screen.getByRole("dialog", {
      name: "Studio Wireless Headphones — closer look",
    });
    expect(
      within(gallery).getByRole("img", {
        name: "Studio Wireless Headphones — Detail crop",
      }),
    ).toBeInTheDocument();
    fireEvent(
      gallery,
      new Event("cancel", { bubbles: true, cancelable: true }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });
  it("migrates a legacy product bookmark and handles unknown products", async () => {
    window.history.replaceState(null, "", "/?product=aural-studio");
    mount();
    await screen.findByRole("heading", {
      name: "Studio Wireless Headphones",
      level: 1,
    });
    expect(window.location.pathname).toBe("/products/aural-studio");
    expect(window.location.search).not.toContain("product=");
  });
  it("offers a route back when a product does not exist", async () => {
    window.history.replaceState(null, "", "/products/missing");
    mount();
    expect(
      await screen.findByRole("heading", {
        name: "This find isn’t available.",
      }),
    ).toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Back to the collection" }));
    await screen.findByRole("link", {
      name: "View Studio Wireless Headphones",
    });
  });
  it("selects a search suggestion using the keyboard and records a recent search", async () => {
    const user = userEvent.setup();
    await load();
    const input = screen.getByRole("combobox", { name: "Search products" });
    await user.type(input, "studio");
    expect(
      screen.getByRole("listbox", { name: "Search suggestions" }),
    ).toBeInTheDocument();
    await user.keyboard("{ArrowDown}{Enter}");
    await screen.findByRole("heading", {
      name: "Studio Wireless Headphones",
      level: 1,
    });
    expect(window.location.pathname).toBe("/products/aural-studio");
    expect(
      JSON.parse(localStorage.getItem("curio.recent-searches.v2")!),
    ).toContain("Studio Wireless Headphones");
    await user.click(input);
    expect(
      screen.getByRole("option", {
        name: /Studio Wireless Headphones.*Search again/,
      }),
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
  it("keeps a product page open while typing and submits a catalogue search with Enter", async () => {
    window.history.replaceState(null, "", "/products/aural-studio");
    const user = userEvent.setup();
    mount();
    await screen.findByRole("heading", {
      name: "Studio Wireless Headphones",
      level: 1,
    });
    const input = screen.getByRole("combobox", { name: "Search products" });
    await user.type(input, "laptop");
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(window.location.pathname).toBe("/products/aural-studio");
    await user.keyboard("{Enter}");
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(4));
    expect(window.location.search).toContain("q=laptop");
  });
  it("keeps the curated collection usable when the external provider falls back", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        url.startsWith("/api/catalogue?source=dummyjson")
          ? Promise.resolve(
              json({
                ...data,
                requestedSource: "dummyjson",
                notice:
                  "The external demo collection is temporarily unavailable. Curio’s collection is available below.",
              }),
            )
          : apiFetch(url),
      ),
    );
    const user = userEvent.setup();
    await load();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Catalogue source" }),
      "dummyjson",
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "external demo collection",
    );
    await screen.findByRole("link", {
      name: "View Studio Wireless Headphones",
    });
    expect(window.location.search).toContain("source=dummyjson");
    expect(screen.getAllByRole("article")).toHaveLength(9);
  });
});
