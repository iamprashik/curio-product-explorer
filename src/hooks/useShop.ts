import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type SetStateAction,
} from "react";
import { useLocation, useMatch, useNavigate } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { CartItem, CatalogueSource, Filters, Product } from "../types";
import {
  DEFAULT_FILTERS,
  filtersToSearch,
  PAGE_SIZE,
  readFilters,
  updateCart,
} from "../lib/catalogue";
import {
  getCatalogue,
  getProduct,
  getProductPage,
  isProducts,
  pageOf,
  readCatalogueCache,
} from "../lib/api";
import {
  cartProduct,
  mergeProducts,
  productPath,
  sameVariant,
  selectedVariant,
} from "../lib/products";
import { isCart, isStringList, useStoredState } from "../lib/storage";
import { useOrders } from "./useOrders";
import { cartSignature, repeatOrder } from "../lib/checkout";
import type { DemoOrder } from "../lib/orders";

const EMPTY_IDS: string[] = [];
const EMPTY_CART: CartItem[] = [];
const EMPTY_PRODUCTS: Product[] = [];
const safeReturn = (value: unknown) =>
  typeof value === "string" && (value === "/" || value.startsWith("/?"))
    ? value
    : undefined;

export function useShop() {
  const location = useLocation();
  const navigate = useNavigate();
  const client = useQueryClient();
  const match = useMatch("/products/:productId");
  const detailId = match?.params.productId;
  const orderMatch = useMatch("/orders/:orderId");
  const orderId = orderMatch?.params.orderId;
  const isCheckout = location.pathname === "/checkout";
  const isOrdersPage = location.pathname === "/orders";
  const isCatalogue = location.pathname === "/";
  const commercePage = isCheckout || isOrdersPage || !!orderId;
  const orderStore = useOrders();
  const filters = useMemo(
    () => readFilters(location.search),
    [location.search],
  );
  const source: CatalogueSource =
    new URLSearchParams(location.search).get("source") === "dummyjson" ||
    detailId?.startsWith("dummy-")
      ? "dummyjson"
      : "curio";
  const [saved, setSaved] = useStoredState(
    "curio.saved.v1",
    EMPTY_IDS,
    isStringList,
  );
  const [cart, setCart] = useStoredState("curio.cart.v1", EMPTY_CART, isCart);
  const cartRef = useRef(cart);
  cartRef.current = cart;
  const [compare, setCompare] = useStoredState(
    "curio.compare.v1",
    EMPTY_IDS,
    isStringList,
  );
  const [known, setKnown] = useStoredState(
    "curio.known-products.v2",
    EMPTY_PRODUCTS,
    isProducts,
  );
  const [dialog, setDialog] = useState<
    "cart" | "compare" | "filters" | "about" | null
  >(null);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [toast, setToast] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const collectionRef = useRef<HTMLElement>(null);
  const catalogueQuery = useQuery({
    queryKey: ["catalogue", source],
    queryFn: ({ signal }) => getCatalogue(source, signal),
    initialData: () => readCatalogueCache(source),
    initialDataUpdatedAt: 0,
    staleTime: 60_000,
    retry: false,
  });
  const catalogue = catalogueQuery.data;
  const catalogueProducts = catalogue?.products ?? EMPTY_PRODUCTS;
  const fallbackProducts = useMemo(
    () => mergeProducts(known, catalogueProducts),
    [known, catalogueProducts],
  );
  const pageQuery = useQuery({
    queryKey: [
      "products",
      source,
      filtersToSearch(filters),
      catalogueQuery.dataUpdatedAt,
    ],
    queryFn: ({ signal }) =>
      getProductPage(source, filters, catalogue!, signal),
    enabled: !!catalogue && !filters.savedOnly && isCatalogue,
    staleTime: 30_000,
    retry: false,
  });
  const detailQuery = useQuery({
    queryKey: ["product", source, detailId],
    queryFn: ({ signal }) =>
      getProduct(detailId!, source, fallbackProducts, signal),
    enabled: !!detailId && !!catalogue,
    staleTime: 30_000,
    retry: false,
  });
  const allProducts = useMemo(
    () =>
      mergeProducts(fallbackProducts, [
        ...(pageQuery.data?.products ?? []),
        ...(detailQuery.data?.product ? [detailQuery.data.product] : []),
      ]),
    [fallbackProducts, pageQuery.data, detailQuery.data],
  );
  const products = filters.savedOnly ? allProducts : catalogueProducts;
  const result = filters.savedOnly
    ? pageOf(allProducts, filters, source, saved)
    : (pageQuery.data ?? pageOf(catalogueProducts, filters, source));
  const total = result.total;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = result.page;
  const pageProducts = result.products;
  const detail =
    detailQuery.data?.product ??
    (detailQuery.data ? undefined : allProducts.find((p) => p.id === detailId));
  const loading =
    (!catalogue && catalogueQuery.isPending) ||
    (!filters.savedOnly && isCatalogue && !!catalogue && pageQuery.isPending);
  const detailLoading =
    !!detailId &&
    !detail &&
    (catalogueQuery.isPending || (!!catalogue && detailQuery.isPending));
  const error =
    catalogueQuery.error?.message ??
    catalogue?.notice ??
    (!detailId ? pageQuery.data?.notice : detailQuery.data?.notice) ??
    detailQuery.error?.message ??
    "";
  const cached = !!catalogue && !!error;
  const updating =
    catalogueQuery.isFetching || (!detailId && pageQuery.isFetching);
  const returnTo =
    safeReturn((location.state as { from?: unknown } | null)?.from) ??
    (source === "dummyjson" ? "/?source=dummyjson" : "/");
  const linkState = {
    from: detailId ? returnTo : location.pathname + location.search,
  };

  useEffect(() => {
    const incoming = [
      ...catalogueProducts,
      ...(pageQuery.data?.products ?? []),
      ...(detailQuery.data?.product ? [detailQuery.data.product] : []),
    ];
    if (!incoming.length) return;
    setKnown((previous) => {
      const next = mergeProducts(previous, incoming);
      return JSON.stringify(previous) === JSON.stringify(next)
        ? previous
        : next;
    });
  }, [catalogueProducts, pageQuery.data, detailQuery.data, setKnown]);
  useEffect(() => {
    const legacy = new URLSearchParams(location.search).get("product");
    if (location.pathname === "/" && legacy)
      navigate(productPath(legacy, source), {
        replace: true,
        state: { from: "/" + filtersToSearch(filters) },
      });
  }, [location.pathname, location.search, navigate, source, filters]);
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (!dialog) searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [dialog]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (detailId || commercePage)
      window.scrollTo({ top: 0, behavior: "instant" });
    document.title = detail
      ? `${detail.name} · Curio`
      : isCheckout
        ? "Checkout · Curio"
        : commercePage
          ? "My Orders · Curio"
          : "Curio · Good finds, thoughtfully chosen";
  }, [detailId, detail, commercePage, isCheckout]);

  const setFilters = useCallback(
    (update: SetStateAction<Filters>) => {
      const next = typeof update === "function" ? update(filters) : update;
      const params = new URLSearchParams(filtersToSearch(next));
      if (source === "dummyjson") params.set("source", source);
      navigate("/" + (params.size ? "?" + params : ""), {
        replace: isCatalogue,
      });
    },
    [filters, source, navigate, isCatalogue],
  );
  const changeFilters = useCallback(
    (patch: Partial<Filters>) =>
      setFilters((f) => ({ ...f, ...patch, page: 1 })),
    [setFilters],
  );
  const reset = () =>
    setFilters((f) => ({
      ...DEFAULT_FILTERS,
      query: f.query,
      savedOnly: f.savedOnly,
    }));
  const explore = (patch: Partial<Filters> = {}) => {
    setFilters({ ...DEFAULT_FILTERS, ...patch });
    requestAnimationFrame(() =>
      collectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      }),
    );
  };
  const changeSource = (next: CatalogueSource) =>
    navigate(next === "curio" ? "/" : "/?source=dummyjson");
  const openProduct = (p: Product) =>
    navigate(productPath(p.id, p.source), { state: linkState });
  const back = () => {
    navigate(returnTo);
    requestAnimationFrame(() =>
      collectionRef.current?.scrollIntoView({ block: "start" }),
    );
  };
  const toggleSaved = (p: Product) => {
    setSaved((ids) =>
      ids.includes(p.id) ? ids.filter((id) => id !== p.id) : [...ids, p.id],
    );
    setToast(
      saved.includes(p.id)
        ? "Removed from your saved finds"
        : "Added to your saved finds",
    );
  };
  const compared = compare
    .filter((id) => allProducts.some((p) => p.id === id))
    .slice(0, 3);
  const toggleCompared = (p: Product) => {
    if (compared.includes(p.id))
      return setCompare(compared.filter((id) => id !== p.id));
    if (compared.length >= 3)
      return setToast("Compare up to 3 products. Remove one to add another.");
    setCompare([...compared, p.id]);
  };
  const addToCart = (p: Product, variantId?: string, amount = 1) => {
    const variant = selectedVariant(p, variantId);
    const quantity = cart
      .filter((item) => sameVariant(item, p, variant.id))
      .reduce((n, item) => n + item.quantity, 0);
    if (!variant.stock) return;
    if (quantity + amount > Math.min(variant.stock, 99))
      return setToast("You’ve reached the available quantity for this option.");
    setCart((current) =>
      updateCart(
        current,
        p,
        current
          .filter((item) => sameVariant(item, p, variant.id))
          .reduce((n, item) => n + item.quantity, 0) + amount,
        variant.id,
      ),
    );
    setToast(`${p.name} added to your bag`);
  };
  const cartCount = cart.reduce((n, item) => {
    const base = allProducts.find((p) => p.id === item.productId);
    const p = base && cartProduct(base, item);
    return n + (p ? Math.min(item.quantity, p.stock) : 0);
  }, 0);
  const savedCount = saved.filter((id) =>
    allProducts.some((p) => p.id === id),
  ).length;
  const comparisonProducts = compared.map((id) =>
    allProducts.find((p) => p.id === id)!,
  );
  const retry = async () => {
    await catalogueQuery.refetch();
    await client.invalidateQueries({ queryKey: ["products", source] });
    await client.invalidateQueries({ queryKey: ["product", source] });
  };
  const sourceSearch = source === "dummyjson" ? "?source=dummyjson" : "";
  const beginCheckout = () => {
    setDialog(null);
    navigate("/checkout" + sourceSearch);
  };
  const openOrders = () => {
    setDialog(null);
    navigate("/orders" + sourceSearch);
  };
  const refreshProducts = async (
    ids: string[],
    signal: AbortSignal,
  ): Promise<Product[]> => {
    const sources = [
      ...new Set(
        ids.map((id) => (id.startsWith("dummy-") ? "dummyjson" : "curio")),
      ),
    ] as CatalogueSource[];
    const responses = await Promise.all(
      sources.map(async (requested) => {
        const data = await getCatalogue(requested, signal);
        if (data.notice || data.source !== requested)
          throw new Error(
            "The collection could not be refreshed. Your bag is unchanged. Reconnect and try again.",
          );
        return data;
      }),
    );
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    for (const response of responses)
      client.setQueryData(["catalogue", response.requestedSource], response);
    const fresh = responses.flatMap((response) => response.products);
    setKnown((previous) =>
      mergeProducts(
        previous.filter(
          (p) =>
            !sources.includes(
              p.source ?? (p.id.startsWith("dummy-") ? "dummyjson" : "curio"),
            ),
        ),
        fresh,
      ),
    );
    return fresh;
  };
  const placeOrder = (order: DemoOrder, expectedCart: CartItem[]) => {
    let stored: unknown;
    try {
      stored = JSON.parse(localStorage.getItem("curio.cart.v1") ?? "[]");
    } catch {
      throw new Error(
        "Your bag could not be checked. Please allow site storage and try again.",
      );
    }
    if (
      !isCart(stored) ||
      cartSignature(stored) !== cartSignature(expectedCart) ||
      cartSignature(cartRef.current) !== cartSignature(expectedCart)
    )
      throw new Error(
        "Your bag changed in another view. Review the updated bag before placing your demo order.",
      );
    orderStore.add(order);
    setCart([]);
    try {
      localStorage.setItem("curio.cart.v1", "[]");
    } catch {
      setToast(
        "Your order was saved, but the bag could not be cleared from browser storage. Review it before ordering again.",
      );
    }
    setDialog(null);
    navigate(
      `/orders/${encodeURIComponent(order.id)}?placed=1${source === "dummyjson" ? "&source=dummyjson" : ""}`,
    );
  };
  const buyAgain = async (
    order: DemoOrder,
    signal: AbortSignal,
  ): Promise<string> => {
    const fresh = await refreshProducts(
      order.lines.map((line) => line.productId),
      signal,
    );
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    const result = repeatOrder(cartRef.current, order.lines, fresh);
    if (result.added) setCart(result.cart);
    return [
      result.added
        ? `Added ${result.added} ${result.added === 1 ? "item" : "items"} to your bag using current prices.`
        : "No items could be added.",
      ...result.messages,
    ].join(" ");
  };
  return {
    products,
    allProducts,
    loading,
    detailLoading,
    updating,
    error,
    cached,
    retry,
    filters,
    setFilters,
    saved,
    cart,
    setCart,
    compare,
    setCompare,
    detailId,
    detail,
    dialog,
    setDialog,
    view,
    setView,
    toast,
    setToast,
    searchRef,
    collectionRef,
    changeFilters,
    reset,
    explore,
    toggleSaved,
    compared,
    toggleCompared,
    addToCart,
    cartCount,
    savedCount,
    total,
    pageCount,
    currentPage,
    pageProducts,
    comparisonProducts,
    source,
    changeSource,
    openProduct,
    back,
    linkState,
    location,
    isCatalogue,
    commercePage,
    isCheckout,
    isOrdersPage,
    orderId,
    orders: orderStore.orders,
    orderError: orderStore.error,
    reloadOrders: orderStore.reload,
    beginCheckout,
    openOrders,
    refreshProducts,
    placeOrder,
    buyAgain,
  };
}
