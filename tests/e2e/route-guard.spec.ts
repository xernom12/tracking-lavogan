import { expect, test } from "@playwright/test";

test("admin detail route redirects unauthenticated users to the login screen", async ({ page }) => {
  await page.goto("/admin/kelola/1");

  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByRole("heading", { name: /selamat datang/i })).toBeVisible();
  await expect(page.getByLabel(/email/i)).toBeVisible();
});
