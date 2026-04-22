import { expect, test, type Page } from "@playwright/test";

const adminCredentials = {
  email: "admin.testing@tracking-os.local",
  password: "TrackingOS!Test2026",
};

const uniqueSuffix = () => `${Date.now()}-${Math.floor(Math.random() * 1000)}`;

const loginAsAdmin = async (page: Page) => {
  await page.goto("/admin/login");
  await page.getByLabel(/email/i).fill(adminCredentials.email);
  await page.getByLabel(/password/i).fill(adminCredentials.password);
  await page.getByRole("button", { name: /^masuk$/i }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: /dashboard admin/i })).toBeVisible();
};

test("admin can create, open, edit, and delete a submission", async ({ page }) => {
  const suffix = uniqueSuffix();
  const submissionNumber = `I-AUDIT-${suffix}`;
  const organizationName = `LPK Audit ${suffix}`;
  const updatedOrganizationName = `${organizationName} Updated`;

  await loginAsAdmin(page);

  await page.getByRole("button", { name: /buat permohonan baru/i }).click();
  await expect(page.getByRole("dialog").getByText(/buat permohonan baru/i)).toBeVisible();

  await page.locator('input[type="date"]').first().fill("2026-04-22");
  await page.getByPlaceholder(/masukkan nomor permohonan/i).fill(submissionNumber);
  await page.getByPlaceholder(/masukkan nama perusahaan\/lpk/i).fill(organizationName);
  await page.getByPlaceholder(/masukkan nib/i).fill("1234567890123");
  await page.getByRole("combobox").nth(0).selectOption("78425");
  await page.getByRole("combobox").nth(1).selectOption("Baru");
  await page.getByRole("button", { name: /^buat permohonan$/i }).click();
  await page.getByRole("button", { name: /ya, buat permohonan/i }).click();

  const row = page.getByRole("row").filter({ hasText: submissionNumber }).first();
  await expect(row).toBeVisible({ timeout: 15000 });

  await row.getByRole("button", { name: /kelola permohonan/i }).click();
  await page.getByRole("button", { name: /^kelola$/i }).click();
  await expect(page).toHaveURL(/\/admin\/kelola\//);

  await expect(page.locator("main")).toContainText(submissionNumber, { timeout: 15000 });
  await page.getByRole("button", { name: /edit data permohonan/i }).click();
  await expect(page.getByRole("dialog").getByText(/edit data permohonan/i)).toBeVisible();

  const dialog = page.getByRole("dialog");
  const organizationInput = dialog.getByPlaceholder(/masukkan nama perusahaan\/lpk/i);
  await organizationInput.fill(updatedOrganizationName);
  await page.getByRole("button", { name: /simpan perubahan/i }).click();
  await expect(page.locator("main")).toContainText(updatedOrganizationName, { timeout: 15000 });

  await page.getByRole("button", { name: /kembali ke dashboard admin/i }).click();
  await expect(page).toHaveURL(/\/admin$/);

  const updatedRow = page.getByRole("row").filter({ hasText: submissionNumber }).first();
  await expect(updatedRow).toContainText(updatedOrganizationName);
  await updatedRow.getByRole("button", { name: /kelola permohonan/i }).click();
  await page.getByRole("button", { name: /^hapus$/i }).click();
  await page.getByRole("button", { name: /^hapus$/i }).last().click();

  await expect(page.getByRole("row").filter({ hasText: submissionNumber })).toHaveCount(0, { timeout: 15000 });
});
