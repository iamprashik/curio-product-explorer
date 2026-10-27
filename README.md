# Curio — Ecommerce Product Explorer, v3.0.1

A React and TypeScript storefront for discovering, comparing and saving products. Version 3 adds a complete local demo checkout: contact and delivery details, discounts, delivery costs, saved order receipts, order history and Buy again.

This update starts from the last shared v2 source and includes the 2px purple square hover outline added to the navbar. Any other changes made only in your local folder need to be merged from that folder. This copy includes Vercel hosting support. See `DEPLOYMENT.md` for the GitHub upload and public-demo setup.

## Start in VS Code on Windows

1. Extract the ZIP into a **new folder**, such as `curio-product-explorer-v3`, to keep your existing version.
2. Choose **File → Open Folder** in VS Code and select the folder containing `package.json` and `package-lock.json`.
3. Choose **Terminal → New Terminal** and run:

```sh
npm ci
npm run dev
```

Open the localhost address printed in the terminal, usually `http://localhost:5173`. Keep that terminal running. Press Ctrl+C to stop the app.

Use a current **Node.js 24.x** release; this update was checked using Node 24.19.0. You need only one terminal for the frontend and catalogue API. No API key or environment file is required.

If npm cannot find a package or lockfile, run `dir` and make sure the terminal is in the extracted project folder. This ZIP has the project files at its root, without another nested project folder. `node_modules` and `dist` are excluded; npm installs the dependencies using the included lockfile.

## Try the new shopping flow

1. Open **Studio Wireless Headphones**, choose **Sand finish**, and add it to the bag.
2. Open the bag and choose **Continue to checkout**.
3. Click **Use demo details**, or fill out the contact and delivery fields. Empty or invalid fields display a message and focus moves to the first field that needs attention.
4. Apply **CURIO10**. The $159 sample option receives a $15.90 discount; standard delivery is free and the total is **$143.10**.
5. Try **Express delivery**. With that same code and item, the total becomes **$158.09**.
6. Choose **Place demo order**. The app refreshes the product collection, checks the selected option and stock, saves a receipt, clears the bag, and opens the confirmation page.
7. Open **My Orders** from the navbar, or the package icon on smaller screens. Search the saved orders, open a receipt, and try **Buy again**.
8. Reload an order page to check that its original items, selected options, prices, delivery charge and discount are retained.

A failed order save leaves the bag intact. If product prices change during checkout, you must review the updated summary and place the demo order again. Unavailable options and quantities exceeding current stock block checkout until the bag is updated. A bag change detected during checkout also requires another review.

## Demo pricing rules

All amounts are sample USD prices, calculated using integer cents.

| Rule              | Behavior                                                                         |
| ----------------- | -------------------------------------------------------------------------------- |
| `CURIO10`         | 10% off a product subtotal of $75 or more                                        |
| `SAVE25`          | $25 off a product subtotal of $200 or more                                       |
| Coupon limit      | One code per order; an invalid code never replaces an already applied valid code |
| Standard delivery | $6.99, or free when the subtotal **after discounts** is at least $100            |
| Express delivery  | $14.99                                                                           |
| Taxes             | Not calculated in this demo                                                      |

The delivery time labels are sample estimates. Country and postal fields perform basic format validation, not address verification or real delivery eligibility checks.

## What is saved

Orders use `localStorage` under `curio.orders.v3`. Each order keeps a snapshot of its item names, option labels, quantities, unit prices, discount, delivery choice, contact details, address and total. Changing the current catalogue does not change an existing receipt.

Checkout field drafts use `sessionStorage` for the current browser tab and are removed after a successful order. Orders remain in the same browser until that site's stored data is cleared. They are not account-backed or synchronized across devices. Ordinary storage events update the order list and shopping state between tabs.

Buy again refreshes the relevant collections and adds available options at current prices. It caps additional quantities at stock and bag limits, skips unavailable items, and explains what could be added. Existing bag items are preserved.

**This is a local portfolio demo.** It collects no card details, takes no payment, sends no email, creates no server-side order and reserves no inventory. No real purchase or shipment is made. Browser-local storage is not an order database or a transaction service; it does not provide database-level multi-tab concurrency guarantees. Use the sample-details button when exploring checkout.

## Existing discovery features

- Curated products across Audio, Laptops, Cameras, Wearables and Accessories, with locally bundled illustrative images.
- Product routes, image views and enlargement, selectable options, related products and bookmarkable option links.
- Autocomplete, recent searches, keyboard selection and delayed catalogue searches.
- Combined category, brand, price, rating, deal and availability filters; sorting, pagination and grid/list layouts.
- Persistent saved finds, variant-specific bag lines, and comparison for up to three products.
- An optional external DummyJSON sample collection with explicit recovery notices.

The original product galleries use a photograph in a full view and labelled CSS detail crops. Sample finishes are not pictured. Curio brands, reviews, stock, specifications, options and prices are fictional. Photo-source URLs are recorded in `src/data/photo-sources.json`. External products use the provider's images and a Standard option because it does not supply variant data.

## Local catalogue API

Vite middleware in `server/api.ts` starts with both development and local preview. Curio reads `public/catalogue.json`. The optional adapter requests electronics categories from [DummyJSON](https://dummyjson.com/docs/products), validates and deduplicates the products, applies its sample discount percentages, and maps them to the shared product contract. Successful external collections are cached for 60 seconds; provider requests have a seven-second timeout.

| GET endpoint                                                      | Purpose                                              |
| ----------------------------------------------------------------- | ---------------------------------------------------- |
| `/api/catalogue?source=curio`                                     | Full collection for categories and suggestions       |
| `/api/products?category=Audio&q=headphones&sort=price-asc&page=1` | Combined filters, sorting and nine-item result pages |
| `/api/products/aural-studio`                                      | Product details and options                          |
| `/api/catalogue?source=dummyjson`                                 | Optional external sample collection                  |

Product endpoints also accept `source=dummyjson`. Filters use `q`, `category`, `brands`, `min`, `max`, `rating`, `deals`, `stock`, `sort` and `page`. Saved-product filtering runs locally because those selections belong to the browser.

Browsing can recover from connection failures using a validated saved catalogue or the packaged JSON, with a notice. Placing orders and Buy again require a successful collection refresh; they stop if only a fallback or cached-error response is available. This is not a service-worker offline app.

For local development and preview, Vite runs the API middleware. On Vercel, `api/index.ts` runs the same catalogue handlers as a Node.js function, using the bundled JSON collection. `vercel.json` routes the API requests and supports page refreshes for React Router URLs. A static-only host does not run this API; checkout needs it for the collection refresh.

## Publish a portfolio demo

Follow **[DEPLOYMENT.md](DEPLOYMENT.md)** to upload the source to a separate GitHub repository and connect that repository to Vercel. Upload the project contents, including `api/`, `server/` and `vercel.json`. Keep `node_modules/`, `dist/`, `.vercel/`, local environment files and test reports out of GitHub. The hosting configuration selects the Vite build and the `dist` output directory; use Node.js 24.x.

The app still uses browser-local demo orders. Moving from localhost to the public domain starts with that domain’s own browser storage. No production deployment has been performed or verified as part of preparing this source.

## Checks

Run the business-rule and React interaction suite:

```sh
npm test
npm run build
```

The suite covers discovery, routes, options, comparison, API mapping and recovery, coupon thresholds, delivery calculations, form validation, order snapshots, failed writes, product-price changes, stock changes, storage-event updates, a bag changed during checkout, and Buy again. The production build includes TypeScript checking of the application, unit tests and browser-test source.

To review the built application locally, run after building:

```sh
npm run preview
```

## Optional browser tests

Playwright tests are included in `e2e/checkout.spec.ts`, with desktop and mobile Chromium configurations. Install the browser once and run them locally:

```sh
npx playwright install chromium
npm run test:e2e
```

The configuration starts its own local Vite server on port 5185. The tests exercise a selected option through checkout, coupon application, receipt persistence, Buy again and invalid-field focus. Screenshots, video and tracing are disabled in this configuration.

Browser tests and visual checks have **not been run in the build environment**. The unit and React tests use jsdom with mocked native-dialog APIs. Check responsive layouts, native modal focus behavior and keyboard use in your local browser. No Lighthouse or real-device accessibility result is claimed.

## Source map

| File                              | Responsibility                                                                          |
| --------------------------------- | --------------------------------------------------------------------------------------- |
| `src/main.tsx`                    | Router and query-client providers                                                       |
| `src/App.tsx`                     | Page selection, shared header, catalogue and dialogs                                    |
| `src/hooks/useShop.ts`            | Navigation, requests, shopping state, fresh collection checks and checkout coordination |
| `src/hooks/useOrders.ts`          | Validated saved orders and cross-tab updates                                            |
| `src/components/CheckoutPage.tsx` | Contact/address form, delivery choices, validation and order submission                 |
| `src/components/OrderSummary.tsx` | Items, coupons, delivery charge and totals                                              |
| `src/components/OrdersPage.tsx`   | Searchable history, confirmation, saved receipt and Buy again                           |
| `src/components/CartDrawer.tsx`   | Variant quantities, removal and the link to checkout                                    |
| `src/lib/checkout.ts`             | Pricing, delivery rules, validation, quote signatures and reorder limits                |
| `src/lib/orders.ts`               | Order schema, receipt snapshots and synchronous storage writes                          |
| `src/lib/catalogue.ts`            | Product validation, filters, sorting, URL state and bag rules                           |
| `src/lib/api.ts`                  | Validated requests and browsing recovery                                                |
| `api/index.ts`                    | Vercel function entry point with the bundled catalogue                                  |
| `server/hosted.ts`                | Hosted request/rewrite adapter for the shared API                                       |
| `vercel.json`                     | Hosting build settings and API/React Router routing                                     |
| `server/`                         | Local API and external sample-provider adapter                                          |
| `tests/`                          | Unit and React interaction tests                                                        |
| `e2e/`                            | Browser tests to run locally                                                            |

## Learning and resume notes

After reviewing and understanding the source, you can describe the implemented work:

- Built a React and TypeScript product explorer with product routes, option selection, URL filters, comparison and persistent shopping state.
- Implemented a demo checkout with accessible field errors, coupon and delivery calculations, saved order snapshots and stock-aware repeat purchases.
- Tested pricing rules, shopping interactions, API recovery, storage failures and product changes with Vitest and React Testing Library.

Explain how the app refreshes products before checkout, why monetary calculations use integer cents, how an order preserves historical prices, and why a browser-local receipt differs from a real payment and order service. Run the included browser tests locally before claiming browser-test results.
