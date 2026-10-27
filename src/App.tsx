import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Heart,
  Laptop,
  LayoutGrid,
  List,
  LoaderCircle,
  Mouse,
  Search,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Watch,
  X,
  Scale,
  PackageCheck,
} from "lucide-react";
import { CATEGORIES, type Filters } from "./types";
import {
  activeFilterCount,
  DEFAULT_FILTERS,
  money,
  PAGE_SIZE,
  updateCart,
} from "./lib/catalogue";
import { useShop } from "./hooks/useShop";
import { cartKey } from "./lib/products";
import { SearchBox } from "./components/SearchBox";
import { ProductPage } from "./components/ProductPage";
import { ProductCard } from "./components/ProductCard";
import { FilterPanel } from "./components/FilterPanel";
import { CompareDialog } from "./components/CompareDialog";
import { CartDrawer } from "./components/CartDrawer";
import { Dialog } from "./components/Dialog";
import { CheckoutPage } from "./components/CheckoutPage";
import { OrdersPage, OrderDetailsPage } from "./components/OrdersPage";

const categoryIcons = {
  Audio: AudioLines,
  Laptops: Laptop,
  Cameras: Camera,
  Wearables: Watch,
  Accessories: Mouse,
};

export default function App() {
  const shop = useShop();
  const {
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
  } = shop;
  const chips = [
    ...(filters.query
      ? [
          {
            text: `“${filters.query}”`,
            clear: () => changeFilters({ query: "" }),
          },
        ]
      : []),
    ...(filters.category !== "All"
      ? [
          {
            text: filters.category,
            clear: () => changeFilters({ category: "All" }),
          },
        ]
      : []),
    ...filters.brands.map((brand) => ({
      text: brand,
      clear: () =>
        changeFilters({ brands: filters.brands.filter((b) => b !== brand) }),
    })),
    ...(filters.minPrice || filters.maxPrice !== DEFAULT_FILTERS.maxPrice
      ? [
          {
            text: `${money(filters.minPrice)}–${money(filters.maxPrice)}`,
            clear: () =>
              changeFilters({
                minPrice: 0,
                maxPrice: DEFAULT_FILTERS.maxPrice,
              }),
          },
        ]
      : []),
    ...(filters.minRating
      ? [
          {
            text: `${filters.minRating}+ stars`,
            clear: () => changeFilters({ minRating: 0 }),
          },
        ]
      : []),
    ...(filters.dealsOnly
      ? [{ text: "On sale", clear: () => changeFilters({ dealsOnly: false }) }]
      : []),
    ...(filters.inStock
      ? [{ text: "In stock", clear: () => changeFilters({ inStock: false }) }]
      : []),
  ];

  return (
    <>
      <a
        className="skip-link"
        href={
          shop.commercePage
            ? "#commerce-content"
            : detailId
              ? "#product-content"
              : "#collection"
        }
      >
        {shop.commercePage ? "Skip to page content" : "Skip to products"}
      </a>
      <div className="announcement">
        <span>A LITTLE CURIOUS? YOU’RE IN THE RIGHT PLACE.</span>
        <span>
          Good finds. Thoughtful choices. <Sparkles size={12} />
        </span>
      </div>
      <header className="site-header">
        <div className="header-inner">
          <button
            className="wordmark"
            onClick={() => explore()}
            aria-label="Curio home"
          >
            <span className="brand-symbol">✳</span>curio
            <span className="brand-period">.</span>
          </button>
          <nav className="main-nav" aria-label="Main navigation">
            <button
              className={
                shop.isCatalogue &&
                !filters.savedOnly &&
                !filters.dealsOnly &&
                !filters.minRating
                  ? "active"
                  : ""
              }
              onClick={() => explore()}
            >
              Explore
            </button>
            <button
              className={shop.isCatalogue && filters.dealsOnly ? "active" : ""}
              onClick={() => explore({ dealsOnly: true })}
            >
              Good deals
            </button>
            <button
              className={shop.isCatalogue && filters.minRating ? "active" : ""}
              onClick={() => explore({ minRating: 4.5, sort: "rating" })}
            >
              Top rated
            </button>
            <button
              className={shop.isOrdersPage || shop.orderId ? "active" : ""}
              aria-current={
                shop.isOrdersPage || shop.orderId ? "page" : undefined
              }
              onClick={shop.openOrders}
            >
              My Orders
            </button>
          </nav>
          <SearchBox
            key={source}
            query={filters.query}
            products={products}
            inputRef={searchRef}
            live={shop.isCatalogue}
            change={(query) => changeFilters({ query })}
            submit={(query) => {
              changeFilters({ query });
              requestAnimationFrame(() =>
                collectionRef.current?.scrollIntoView({ behavior: "smooth" }),
              );
            }}
            openProduct={openProduct}
            category={(category) => explore({ category })}
          />
          <div className="header-actions">
            <button
              className="header-icon mobile-orders-icon"
              aria-label="Open My Orders"
              onClick={shop.openOrders}
            >
              <PackageCheck size={20} />
            </button>
            <button
              className={`header-icon ${filters.savedOnly ? "selected" : ""}`}
              aria-label={`Saved products (${savedCount})`}
              aria-pressed={filters.savedOnly}
              onClick={() => explore({ savedOnly: !filters.savedOnly })}
            >
              <Heart
                size={20}
                fill={filters.savedOnly ? "currentColor" : "none"}
              />
              {savedCount > 0 && (
                <span className="small-count">{savedCount}</span>
              )}
            </button>
            <span className="header-divider" />
            <button
              className="bag-button"
              aria-label={`Open shopping bag (${cartCount} items)`}
              onClick={() => setDialog("cart")}
            >
              <ShoppingBag size={19} />
              <span>Bag</span>
              <span className="bag-number">{cartCount}</span>
            </button>
          </div>
        </div>
      </header>
      {shop.isCheckout ? (
        <CheckoutPage
          cart={cart}
          products={allProducts}
          loading={loading}
          refreshProducts={shop.refreshProducts}
          placeOrder={shop.placeOrder}
          editBag={() => setDialog("cart")}
          continueShopping={() => explore()}
        />
      ) : shop.isOrdersPage ? (
        <OrdersPage
          orders={shop.orders}
          error={shop.orderError}
          reload={shop.reloadOrders}
          continueShopping={() => explore()}
        />
      ) : shop.orderId ? (
        <OrderDetailsPage
          key={shop.orderId}
          order={shop.orders.find((order) => order.id === shop.orderId)}
          openOrders={shop.openOrders}
          continueShopping={() => explore()}
          buyAgain={shop.buyAgain}
          openBag={() => setDialog("cart")}
        />
      ) : detailId ? (
        <>
          {error && (
            <div className="page-shell">
              <div className="catalogue-error cached" role="alert">
                <CircleAlert size={19} />
                <span>{error}</span>
                <button onClick={retry} disabled={updating}>
                  Try again
                </button>
              </div>
            </div>
          )}
          {detail ? (
            <ProductPage
              key={detail.id}
              product={detail}
              products={products}
              cart={cart}
              saved={saved}
              compared={compared}
              toggleSaved={toggleSaved}
              toggleCompared={toggleCompared}
              add={addToCart}
              back={back}
              linkState={linkState}
            />
          ) : (
            <main className="page-shell product-page" id="product-content">
              <div className="product-unavailable" aria-busy={detailLoading}>
                {detailLoading ? (
                  <>
                    <LoaderCircle className="spin" size={30} />
                    <h1>Finding your good find…</h1>
                  </>
                ) : (
                  <>
                    <Search size={32} />
                    <h1>This find isn’t available.</h1>
                    <p>
                      It may have moved, or the collection could not be reached.
                    </p>
                    <button className="primary-button" onClick={back}>
                      Back to the collection <ArrowRight size={16} />
                    </button>
                  </>
                )}
              </div>
            </main>
          )}
        </>
      ) : (
        <main className="page-shell">
          <div className="breadcrumb">
            <span>Home</span>
            <ChevronRight size={12} />
            <span>Explore the collection</span>
          </div>
          {!filters.savedOnly && source === "curio" && (
            <section className="hero-row" aria-label="Featured collections">
              <div className="main-hero">
                <div className="hero-copy">
                  <span className="eyebrow">
                    <span className="mini-star">✳</span> GOOD FINDS START HERE
                  </span>
                  <h1>
                    Your next upgrade.
                    <br />
                    <span>A little more you.</span>
                  </h1>
                  <p>
                    Thoughtfully selected tech for the way you live.
                    <br className="desktop-break" /> Explore, compare, and find
                    your favourite.
                  </p>
                  <button className="hero-button" onClick={() => explore()}>
                    Explore the collection <ArrowUpRight size={17} />
                  </button>
                </div>
                <div className="hero-art">
                  <img
                    src="/products/headphones-yellow.jpg"
                    alt="Black over-ear headphones on a golden background"
                    fetchPriority="high"
                    width="720"
                    height="480"
                  />
                  <span className="hero-photo-note">
                    Aural Studio <span>YOUR EVERYDAY SOUNDTRACK</span>
                  </span>
                  <button
                    className="hero-round-button"
                    aria-label="Discover the featured headphones"
                    disabled={!products.some((p) => p.id === "aural-studio")}
                    onClick={() =>
                      openProduct(
                        products.find((p) => p.id === "aural-studio")!,
                      )
                    }
                  >
                    <ArrowUpRight size={24} />
                  </button>
                </div>
              </div>
              <div className="side-hero">
                <span className="eyebrow">BETTER TOGETHER</span>
                <div className="compare-art">
                  <span>
                    <AudioLines size={28} />
                  </span>
                  <i>vs.</i>
                  <span>
                    <AudioLines size={28} />
                  </span>
                  <Sparkles className="floating-spark" size={22} />
                </div>
                <h2>
                  A good choice
                  <br />
                  starts with a little
                  <br />
                  comparison.
                </h2>
                <button
                  className="text-link"
                  onClick={() => {
                    explore();
                    setToast(
                      "Tap Compare on up to 3 products, then open the comparison below.",
                    );
                  }}
                >
                  Find your perfect fit <ArrowRight size={16} />
                </button>
              </div>
            </section>
          )}

          <section
            id="collection"
            ref={collectionRef}
            className="collection"
            aria-labelledby="collection-heading"
            tabIndex={-1}
          >
            <div className="collection-heading">
              <div>
                <span className="eyebrow">
                  {filters.savedOnly
                    ? "KEPT CLOSE, FOR LATER"
                    : "CURATED FOR YOUR EVERYDAY"}
                </span>
                <h2 id="collection-heading">
                  {filters.savedOnly
                    ? "Your saved finds"
                    : "Explore the collection"}
                  <span className="heading-star">✳</span>
                </h2>
              </div>
              <div className="collection-intro">
                <p>
                  {filters.savedOnly
                    ? "The things that caught your eye."
                    : "Less searching. More finding."}
                </p>
                {!filters.savedOnly && (
                  <label className="source-control">
                    Collection
                    <select
                      aria-label="Catalogue source"
                      value={source}
                      onChange={(event) =>
                        changeSource(event.target.value as typeof source)
                      }
                    >
                      <option value="curio">Curated picks</option>
                      <option value="dummyjson">External demo catalogue</option>
                    </select>
                  </label>
                )}
              </div>
            </div>
            <div
              className="category-tabs"
              role="group"
              aria-label="Quick category filter"
            >
              <button
                className={filters.category === "All" ? "active" : ""}
                aria-pressed={filters.category === "All"}
                onClick={() => changeFilters({ category: "All" })}
              >
                <LayoutGrid size={15} />
                All products<span>{products.length}</span>
              </button>
              {CATEGORIES.map((category) => {
                const Icon = categoryIcons[category];
                return (
                  <button
                    className={filters.category === category ? "active" : ""}
                    aria-pressed={filters.category === category}
                    onClick={() => changeFilters({ category })}
                    key={category}
                  >
                    <Icon size={16} />
                    {category}
                  </button>
                );
              })}
            </div>
            {error && (
              <div
                className={`catalogue-error ${cached ? "cached" : ""}`}
                role="alert"
              >
                <CircleAlert size={19} />
                <span>{error}</span>
                <button onClick={retry} disabled={updating}>
                  Try again
                </button>
              </div>
            )}
            <div className="catalogue-layout">
              <aside className="desktop-filters" aria-label="Product filters">
                <FilterPanel
                  products={products}
                  filters={filters}
                  change={changeFilters}
                  reset={reset}
                />
              </aside>
              <div className="results-area">
                <div className="results-toolbar">
                  <span className="results-count" aria-live="polite">
                    {loading ? (
                      "Finding your next favourites…"
                    ) : (
                      <>
                        <strong>{total}</strong>{" "}
                        {total === 1 ? "product" : "products"}
                        {filters.query ? " found" : " to explore"}
                      </>
                    )}
                  </span>
                  <button
                    className="mobile-filter-button"
                    onClick={() => setDialog("filters")}
                  >
                    <SlidersHorizontal size={16} />
                    Filters
                    {activeFilterCount(filters) > 0 && (
                      <span>{activeFilterCount(filters)}</span>
                    )}
                  </button>
                  <div className="sort-control">
                    <label htmlFor="sort-products">Sort by:</label>
                    <select
                      id="sort-products"
                      value={filters.sort}
                      onChange={(e) =>
                        changeFilters({
                          sort: e.target.value as Filters["sort"],
                        })
                      }
                    >
                      <option value="featured">Featured</option>
                      <option value="price-asc">Price: low to high</option>
                      <option value="price-desc">Price: high to low</option>
                      <option value="rating">Highest rated</option>
                      <option value="name">Name: A–Z</option>
                    </select>
                  </div>
                  <div
                    className="view-controls"
                    role="group"
                    aria-label="Product layout"
                  >
                    <button
                      className={view === "grid" ? "active" : ""}
                      onClick={() => setView("grid")}
                      aria-label="Grid view"
                      aria-pressed={view === "grid"}
                    >
                      <LayoutGrid size={17} />
                    </button>
                    <button
                      className={view === "list" ? "active" : ""}
                      onClick={() => setView("list")}
                      aria-label="List view"
                      aria-pressed={view === "list"}
                    >
                      <List size={19} />
                    </button>
                  </div>
                </div>
                {chips.length > 0 && (
                  <div className="active-filters">
                    {chips.map((chip) => (
                      <button
                        className="filter-chip"
                        key={chip.text}
                        onClick={chip.clear}
                      >
                        {chip.text}
                        <X size={12} />
                      </button>
                    ))}
                    <button
                      className="text-button"
                      onClick={() =>
                        setFilters((f) => ({
                          ...DEFAULT_FILTERS,
                          savedOnly: f.savedOnly,
                        }))
                      }
                    >
                      Clear all
                    </button>
                  </div>
                )}
                {loading ? (
                  <div
                    className="product-grid"
                    aria-label="Loading products"
                    aria-busy="true"
                  >
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div className="skeleton-card" key={i}>
                        <div />
                        <span />
                        <span />
                        <span />
                      </div>
                    ))}
                  </div>
                ) : !pageProducts.length ? (
                  <div className="empty-results">
                    <span>
                      {filters.savedOnly ? (
                        <Heart size={32} />
                      ) : (
                        <Search size={32} />
                      )}
                    </span>
                    <h3>
                      {filters.savedOnly && !savedCount
                        ? "Save a little inspiration."
                        : "No finds just yet."}
                    </h3>
                    <p>
                      {filters.savedOnly && !savedCount
                        ? "Tap the heart on a product to keep it here for later."
                        : "Try a different search or give your filters a little more room."}
                    </p>
                    <button
                      className="primary-button"
                      onClick={() => explore()}
                    >
                      {filters.savedOnly && !savedCount
                        ? "Explore the collection"
                        : "Reset search & filters"}
                      <ArrowRight size={16} />
                    </button>
                  </div>
                ) : (
                  <div
                    className={`product-grid ${view === "list" ? "list-view" : ""}`}
                  >
                    {pageProducts.map((p) => (
                      <ProductCard
                        key={p.id}
                        product={p}
                        saved={saved.includes(p.id)}
                        compared={compared.includes(p.id)}
                        toggleSaved={() => toggleSaved(p)}
                        toggleCompared={() => toggleCompared(p)}
                        linkState={linkState}
                        add={() => addToCart(p)}
                      />
                    ))}
                  </div>
                )}
                {!loading && total > 0 && (
                  <div className="pagination">
                    <span>
                      Showing {(currentPage - 1) * PAGE_SIZE + 1}–
                      {Math.min(currentPage * PAGE_SIZE, total)} of {total}{" "}
                      finds
                    </span>
                    <nav aria-label="Product pages">
                      <button
                        className="page-arrow"
                        aria-label="Previous page"
                        disabled={currentPage === 1}
                        onClick={() => {
                          setFilters((f) => ({ ...f, page: currentPage - 1 }));
                          collectionRef.current?.scrollIntoView({
                            behavior: "smooth",
                          });
                        }}
                      >
                        <ChevronLeft size={16} />
                      </button>
                      {Array.from({ length: pageCount }).map((_, i) => (
                        <button
                          key={i}
                          className={currentPage === i + 1 ? "active" : ""}
                          aria-current={
                            currentPage === i + 1 ? "page" : undefined
                          }
                          aria-label={`Page ${i + 1}`}
                          onClick={() => {
                            setFilters((f) => ({ ...f, page: i + 1 }));
                            collectionRef.current?.scrollIntoView({
                              behavior: "smooth",
                            });
                          }}
                        >
                          {i + 1}
                        </button>
                      ))}
                      <button
                        className="page-arrow"
                        aria-label="Next page"
                        disabled={currentPage === pageCount}
                        onClick={() => {
                          setFilters((f) => ({ ...f, page: currentPage + 1 }));
                          collectionRef.current?.scrollIntoView({
                            behavior: "smooth",
                          });
                        }}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </nav>
                  </div>
                )}
              </div>
            </div>
          </section>
          <section className="values-row" aria-label="Shopping tools">
            <div>
              <span>
                <Sparkles size={20} />
              </span>
              <div>
                <h3>Thoughtfully selected</h3>
                <p>Good tech for real, everyday life.</p>
              </div>
            </div>
            <div>
              <span>
                <Scale size={20} />
              </span>
              <div>
                <h3>A clearer comparison</h3>
                <p>The details, all in one place.</p>
              </div>
            </div>
            <div>
              <span>
                <Heart size={20} />
              </span>
              <div>
                <h3>Keep your favourites close</h3>
                <p>Save a find. Come back anytime.</p>
              </div>
            </div>
            <div>
              <span>
                <ShieldCheck size={20} />
              </span>
              <div>
                <h3>Try the whole experience</h3>
                <p>Explore a complete demo store.</p>
              </div>
            </div>
          </section>
        </main>
      )}
      <footer className="site-footer">
        <div className="footer-inner">
          <div>
            <button
              className="wordmark"
              onClick={() => explore()}
              aria-label="Curio home"
            >
              <span className="brand-symbol">✳</span>curio
              <span className="brand-period">.</span>
            </button>
            <span className="footer-tagline">
              Stay curious. Find something good.
            </span>
          </div>
          <div className="footer-right">
            <span>Portfolio demo · Sample products & prices · USD</span>
            <button onClick={() => setDialog("about")}>
              About this project <ArrowUpRight size={12} />
            </button>
          </div>
        </div>
      </footer>

      {compared.length > 0 && !shop.commercePage && (
        <div className="comparison-tray">
          <div className="tray-intro">
            <Scale size={20} />
            <div>
              <strong>A little side by side?</strong>
              <span>{compared.length} of 3 products selected</span>
            </div>
          </div>
          <div className="tray-products">
            {comparisonProducts.map((p) => (
              <div key={p.id}>
                <img src={p.image} alt={p.name} />
                <span>{p.name}</span>
                <button
                  onClick={() =>
                    setCompare(compared.filter((id) => id !== p.id))
                  }
                  aria-label={`Remove ${p.name} from comparison`}
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
          <div className="tray-actions">
            <button className="text-button" onClick={() => setCompare([])}>
              Clear
            </button>
            <button
              className="primary-button"
              onClick={() => setDialog("compare")}
              disabled={compared.length < 2}
            >
              {compared.length < 2
                ? "Add one more"
                : `Compare (${compared.length})`}
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}
      {toast && (
        <div
          className={`toast ${compared.length ? "above-tray" : ""}`}
          role="status"
        >
          <Check size={17} />
          <span>{toast}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {dialog === "cart" && (
        <CartDrawer
          cart={cart}
          products={allProducts}
          close={() => setDialog(null)}
          change={(p, quantity, variant) =>
            setCart((c) => updateCart(c, p, quantity, variant))
          }
          checkout={shop.beginCheckout}
          remove={(item) =>
            setCart((current) =>
              current.filter((line) => cartKey(line) !== cartKey(item)),
            )
          }
        />
      )}
      {dialog === "compare" && (
        <CompareDialog
          products={comparisonProducts}
          close={() => setDialog(null)}
          remove={(id) => setCompare(compared.filter((x) => x !== id))}
          add={addToCart}
        />
      )}
      {dialog === "filters" && (
        <Dialog
          title="Make it your collection"
          close={() => setDialog(null)}
          kind="drawer"
          className="filter-drawer"
        >
          <FilterPanel
            products={products}
            filters={filters}
            change={changeFilters}
            reset={reset}
          />
          <div className="filter-drawer-footer">
            <button className="primary-button" onClick={() => setDialog(null)}>
              Show {total} products
              <ArrowRight size={16} />
            </button>
          </div>
        </Dialog>
      )}
      {dialog === "about" && (
        <Dialog
          title="A little about Curio"
          close={() => setDialog(null)}
          className="about-dialog"
        >
          <span className="about-symbol">✳</span>
          <h3>Built for curious shoppers.</h3>
          <p>
            Curio is a frontend portfolio project: a place to explore products,
            make a thoughtful comparison, and try a complete shopping journey.
          </p>
          <p>
            The catalogue, brands, specifications, ratings, and prices are
            sample data. Curated product photographs are illustrative images
            from Unsplash. The optional external collection uses DummyJSON demo
            data. No real purchases or payments are made.
          </p>
          <div className="about-tech">
            <span>React</span>
            <span>TypeScript</span>
            <span>Vite</span>
            <span>React Router</span>
            <span>TanStack Query</span>
            <span>Vitest</span>
          </div>
          <p className="about-small">
            Your saved products and bag stay in this browser. Search and filters
            are included in the URL, so you can bookmark your collection.
          </p>
          <button className="primary-button" onClick={() => setDialog(null)}>
            Back to the good finds <ArrowRight size={16} />
          </button>
        </Dialog>
      )}
      <div className="sr-only" aria-live="polite">
        {loading ? (
          <>
            <LoaderCircle />
            Loading collection
          </>
        ) : null}
      </div>
    </>
  );
}
