import { expect, test } from "@playwright/test";

test("public tracking handles empty, invalid, and valid submission searches", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: /lacak permohonan/i }).click();
  await expect(page.getByText(/nomor permohonan wajib diisi/i)).toBeVisible();

  await page.getByLabel(/nomor permohonan/i).fill("TIDAK-ADA-123");
  await page.getByRole("button", { name: /lacak permohonan/i }).click();
  await expect(page.getByText(/nomor permohonan tidak ditemukan/i)).toBeVisible();

  await page.getByLabel(/nomor permohonan/i).fill("I-202602061045000552310");
  await page.getByRole("button", { name: /lacak permohonan/i }).click();

  await expect(page.locator("#tracking-result-summary")).toContainText("I-202602061045000552310");
  await expect(page.getByText(/izin terbit/i).first()).toBeVisible();
  await expect(page.getByText(/nomor izin pb umku/i).first()).toBeVisible();
});
