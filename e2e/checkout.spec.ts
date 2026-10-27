import { test, expect } from "@playwright/test";

test("a variant, coupon, saved order and reorder work across real pages", async ({
  page,
}) => {
  await page.goto("/products/aural-studio?variant=sand");
  await expect(
    page.getByRole("heading", { name: "Studio Wireless Headphones", level: 1 }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add to bag · $159" }).click();
  await page
    .getByRole("button", { name: "Open shopping bag (1 items)" })
    .click();
  await page.getByRole("button", { name: "Continue to checkout" }).click();
  await expect(page).toHaveURL(/\/checkout/);
  await page.getByRole("button", { name: "Use demo details" }).click();
  await page.getByLabel("Have a demo discount code?").fill("curio10");
  await page.getByRole("button", { name: "Apply code", exact: true }).click();
  await expect(page.getByText("−$15.90", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Place demo order", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "That’s a wrap.", level: 1 }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/orders\/[^/]+\?placed=1/);
  await expect(
    page.getByRole("button", { name: "Open shopping bag (0 items)" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "That’s a wrap.", level: 1 }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Buy again", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Added 1 item");
  await page
    .getByRole("button", { name: "Review your bag", exact: true })
    .click();
  await expect(
    page
      .getByRole("dialog", { name: "Your shopping bag" })
      .getByText("Sand finish", { exact: true }),
  ).toBeVisible();
});

test("invalid contact details show an accessible field error", async ({
  page,
}) => {
  await page.goto("/products/aural-studio");
  await page.getByRole("button", { name: "Add to bag · $149" }).click();
  await page
    .getByRole("button", { name: "Open shopping bag (1 items)" })
    .click();
  await page.getByRole("button", { name: "Continue to checkout" }).click();
  await page
    .getByRole("button", { name: "Place demo order", exact: true })
    .click();
  await expect(page.getByLabel("Full name", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.getByLabel("Full name", { exact: true })).toBeFocused();
  await expect(page).toHaveURL(/\/checkout/);
});
