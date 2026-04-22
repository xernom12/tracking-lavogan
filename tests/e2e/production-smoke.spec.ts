import { expect, test } from "@playwright/test";

test("public homepage renders and exposes tracking actions", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /PB UMKU\/OSS Penyelenggaraan/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /dashboard admin/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /lacak permohonan/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /daftar izin pb umku terbit/i })).toBeVisible();

  const publicFileLink = page.getByRole("link", { name: /unduh dokumen/i }).first();
  await expect(publicFileLink).toBeVisible();
  await expect(publicFileLink).toHaveAttribute("href", /^(?!data:)(https?:)?\/\//i);
});

test("admin login page renders", async ({ page }) => {
  await page.goto("/admin");

  await expect(page.getByRole("heading", { name: /selamat datang/i })).toBeVisible();
  await expect(page.getByLabel(/email/i)).toBeVisible();
  await expect(page.getByLabel(/password/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /^masuk$/i })).toBeVisible();
});
