import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "../src/App";
import catalogue from "../public/catalogue.json";
import { isProduct, readFilters } from "../src/lib/catalogue";
import { pageOf } from "../src/lib/api";
import { checkoutQuote, DEMO_DETAILS } from "../src/lib/checkout";
import { makeOrder, ORDERS_KEY } from "../src/lib/orders";
import type { Product } from "../src/types";

const products = (catalogue as unknown[]).filter(isProduct);
const storedCart = [
  { productId: "aural-studio", variantId: "sand", quantity: 1 },
];
const collection = (items = products) => ({
  products: items,
  source: "curio",
  requestedSource: "curio",
});
const json = (body: unknown) => new Response(JSON.stringify(body));
const api = (url: string) => {
  const u = new URL(url, "http://localhost");
  if (u.pathname === "/api/catalogue")
    return Promise.resolve(json(collection()));
  if (u.pathname === "/catalogue.json") return Promise.resolve(json(products));
  if (u.pathname === "/api/products")
    return Promise.resolve(
      json(pageOf(products, readFilters(u.search), "curio")),
    );
  return Promise.resolve(
    json({
      product: products.find((p) => p.id === u.pathname.split("/").at(-1)),
      source: "curio",
    }),
  );
};
function mount(path = "/checkout") {
  window.history.replaceState(null, "", path);
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
async function ready() {
  mount();
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Place demo order" }),
    ).toBeEnabled(),
  );
}
async function fill() {
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Use demo details" }));
}
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem("curio.cart.v1", JSON.stringify(storedCart));
  vi.stubGlobal("fetch", vi.fn(api));
});

describe("checkout and saved-order interactions", () => {
  it("validates fields and focuses the first invalid input", async () => {
    const user = userEvent.setup();
    await ready();
    await user.click(screen.getByRole("button", { name: "Place demo order" }));
    expect(screen.getByLabelText("Full name", { exact: true })).toHaveFocus();
    expect(
      screen.getByLabelText("Email address", { exact: true }),
    ).toHaveAttribute("aria-invalid", "true");
    expect(localStorage.getItem(ORDERS_KEY)).toBeNull();
    await fill();
    expect(
      screen.getByLabelText("Email address", { exact: true }),
    ).toHaveAttribute("aria-invalid", "false");
  });
  it("applies a code using Enter without submitting the checkout form", async () => {
    const user = userEvent.setup();
    await ready();
    await user.type(
      screen.getByLabelText("Have a demo discount code?"),
      "curio10{Enter}",
    );
    expect(screen.getByText("−$15.90", { exact: true })).toBeInTheDocument();
    expect(screen.getByLabelText("Full name", { exact: true })).toHaveAttribute(
      "aria-invalid",
      "false",
    );
    expect(localStorage.getItem(ORDERS_KEY)).toBeNull();
    await user.click(screen.getByRole("radio", { name: /Express delivery/ }));
    expect(screen.getByText("$158.09", { exact: true })).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Remove discount code" }),
    );
    expect(screen.getByText("$173.99", { exact: true })).toBeInTheDocument();
  });
  it("saves the selected option, discount and delivery before clearing the bag", async () => {
    const user = userEvent.setup();
    await ready();
    await fill();
    await user.type(
      screen.getByLabelText("Have a demo discount code?"),
      "CURIO10",
    );
    await user.click(screen.getByRole("button", { name: "Apply code" }));
    await user.click(screen.getByRole("button", { name: "Place demo order" }));
    await screen.findByRole("heading", { name: "That’s a wrap.", level: 1 });
    const saved = JSON.parse(localStorage.getItem(ORDERS_KEY)!);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      totalCents: 14310,
      discountCents: 1590,
      deliveryCents: 0,
      customer: DEMO_DETAILS,
    });
    expect(saved[0].lines[0]).toMatchObject({
      variantId: "sand",
      quantity: 1,
      unitPriceCents: 15900,
    });
    expect(JSON.parse(localStorage.getItem("curio.cart.v1")!)).toEqual([]);
    expect(sessionStorage.getItem("curio.checkout-draft.v3")).toBeNull();
    expect(window.location.pathname).toMatch(/^\/orders\//);
    await user.click(screen.getByRole("button", { name: "All your orders" }));
    expect(
      await screen.findByRole("heading", { name: "Your little collection." }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "View order" }),
    ).toBeInTheDocument();
  });
  it("keeps the bag and form intact when the order cannot be saved", async () => {
    const user = userEvent.setup();
    await ready();
    await fill();
    const set = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key,
      value,
    ) {
      if (key === ORDERS_KEY)
        throw new DOMException("Full", "QuotaExceededError");
      return set.call(this, key, value);
    });
    await user.click(screen.getByRole("button", { name: "Place demo order" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your bag is unchanged",
    );
    expect(JSON.parse(localStorage.getItem("curio.cart.v1")!)).toEqual(
      storedCart,
    );
    expect(screen.getByLabelText("Full name", { exact: true })).toHaveValue(
      "Alex Taylor",
    );
    expect(window.location.pathname).toBe("/checkout");
  });
  it("asks for another review when a product price changes during checkout", async () => {
    const user = userEvent.setup();
    await ready();
    await fill();
    const changed: Product[] = products.map((p) =>
      p.id === "aural-studio"
        ? {
            ...p,
            variants: p.variants!.map((v) =>
              v.id === "sand" ? { ...v, price: 169 } : v,
            ),
          }
        : p,
    );
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        url.startsWith("/api/catalogue")
          ? Promise.resolve(json(collection(changed)))
          : api(url),
      ),
    );
    await user.click(screen.getByRole("button", { name: "Place demo order" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Prices or product details have changed",
    );
    expect(localStorage.getItem(ORDERS_KEY)).toBeNull();
    expect(screen.getAllByText("$169", { exact: true }).length).toBeGreaterThan(
      0,
    );
    await user.click(screen.getByRole("button", { name: "Place demo order" }));
    await screen.findByRole("heading", { name: "That’s a wrap.", level: 1 });
    expect(
      JSON.parse(localStorage.getItem(ORDERS_KEY)!)[0].lines[0].unitPriceCents,
    ).toBe(16900);
  });
  it("blocks an option that sells out during the collection refresh", async () => {
    const user = userEvent.setup();
    await ready();
    await fill();
    const changed = products.map((p) =>
      p.id === "aural-studio"
        ? {
            ...p,
            variants: p.variants!.map((v) =>
              v.id === "sand" ? { ...v, stock: 0 } : v,
            ),
          }
        : p,
    );
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        url.startsWith("/api/catalogue")
          ? Promise.resolve(json(collection(changed)))
          : api(url),
      ),
    );
    await user.click(screen.getByRole("button", { name: "Place demo order" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("sold out"),
    );
    expect(
      screen.getByRole("button", { name: "Place demo order" }),
    ).toBeDisabled();
    expect(localStorage.getItem(ORDERS_KEY)).toBeNull();
  });
  it("detects a bag changed in another tab while the quote is loading", async () => {
    const user = userEvent.setup();
    await ready();
    await fill();
    let resolve!: (value: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((done) => {
            resolve = done;
          }),
      ),
    );
    await user.click(screen.getByRole("button", { name: "Place demo order" }));
    await act(async () => {
      localStorage.setItem(
        "curio.cart.v1",
        JSON.stringify([{ ...storedCart[0], quantity: 2 }]),
      );
      fireEvent(
        window,
        new StorageEvent("storage", {
          key: "curio.cart.v1",
          newValue: localStorage.getItem("curio.cart.v1"),
        }),
      );
      resolve(json(collection()));
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your bag changed",
    );
    expect(JSON.parse(localStorage.getItem("curio.cart.v1")!)[0].quantity).toBe(
      2,
    );
    expect(localStorage.getItem(ORDERS_KEY)).toBeNull();
  });
  it("restores a saved receipt and buys again using current availability", async () => {
    const order = makeOrder(checkoutQuote(storedCart, products), DEMO_DETAILS);
    localStorage.setItem(ORDERS_KEY, JSON.stringify([order]));
    localStorage.setItem("curio.cart.v1", "[]");
    const user = userEvent.setup();
    mount("/orders/" + order.id);
    await screen.findByRole("heading", {
      name: "Your order, at a glance.",
      level: 1,
    });
    await user.click(screen.getByRole("button", { name: "Buy again" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Added 1 item"),
    );
    expect(JSON.parse(localStorage.getItem("curio.cart.v1")!)).toEqual(
      storedCart,
    );
    expect(JSON.parse(localStorage.getItem(ORDERS_KEY)!)[0].totalCents).toBe(
      15900,
    );
  });
  it("receives saved orders from another tab", async () => {
    localStorage.setItem("curio.cart.v1", "[]");
    mount("/orders");
    expect(
      screen.getByText("Your good finds will live here."),
    ).toBeInTheDocument();
    const order = makeOrder(checkoutQuote(storedCart, products), DEMO_DETAILS);
    await act(async () => {
      localStorage.setItem(ORDERS_KEY, JSON.stringify([order]));
      fireEvent(
        window,
        new StorageEvent("storage", {
          key: ORDERS_KEY,
          newValue: localStorage.getItem(ORDERS_KEY),
        }),
      );
    });
    expect(
      screen.getByRole("heading", { name: order.reference }),
    ).toBeInTheDocument();
  });
  it("handles an empty checkout and a missing saved order", async () => {
    localStorage.setItem("curio.cart.v1", "[]");
    const view = mount();
    expect(
      screen.getByRole("heading", {
        name: "A good order starts with a good find.",
      }),
    ).toBeInTheDocument();
    view.unmount();
    mount("/orders/missing");
    expect(
      screen.getByRole("heading", {
        name: "This order isn’t in this browser.",
      }),
    ).toBeInTheDocument();
  });
});
