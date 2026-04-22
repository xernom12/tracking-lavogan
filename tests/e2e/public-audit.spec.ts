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
};

const createSubmission = async (page: Page, submissionNumber: string, organizationName: string) => {
  await page.getByRole("button", { name: /buat permohonan baru/i }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/buat permohonan baru/i)).toBeVisible();
  await dialog.locator('input[type="date"]').first().fill("2026-04-22");
  await dialog.getByPlaceholder(/masukkan nomor permohonan/i).fill(submissionNumber);
  await dialog.getByPlaceholder(/masukkan nama perusahaan\/lpk/i).fill(organizationName);
  await dialog.getByPlaceholder(/masukkan nib/i).fill("1234567890123");
  await dialog.getByRole("combobox").nth(0).selectOption("78425");
  await dialog.getByRole("combobox").nth(1).selectOption("Baru");
  await dialog.getByRole("button", { name: /^buat permohonan$/i }).click();
  await page.getByRole("button", { name: /ya, buat permohonan/i }).click();
  await expect(page.getByRole("row").filter({ hasText: submissionNumber })).toBeVisible({ timeout: 15000 });
};

const deleteSubmissionFromDashboard = async (page: Page, submissionNumber: string) => {
  await page.goto("/admin");
  const row = page.getByRole("row").filter({ hasText: submissionNumber }).first();
  await expect(row).toBeVisible({ timeout: 15000 });
  await row.getByRole("button", { name: /kelola permohonan/i }).click();
  await page.getByRole("button", { name: /^hapus$/i }).click();
  await page.getByRole("button", { name: /^hapus$/i }).last().click();
  await expect(page.getByRole("row").filter({ hasText: submissionNumber })).toHaveCount(0, { timeout: 15000 });
};

test("public tracking works correctly without depending on seeded submissions", async ({ browser }) => {
  test.setTimeout(120000);

  const adminContext = await browser.newContext();
  const publicContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  const publicPage = await publicContext.newPage();

  const suffix = uniqueSuffix();
  const submissionNumber = `I-PUBLIC-${suffix}`;
  const organizationName = `LPK Public ${suffix}`;

  await loginAsAdmin(adminPage);
  await createSubmission(adminPage, submissionNumber, organizationName);

  await publicPage.goto("/");
  await expect(publicPage.getByRole("heading", { name: /pb umku\/oss penyelenggaraan/i })).toBeVisible();
  await expect(publicPage.getByRole("heading", { name: /daftar izin pb umku terbit/i })).toBeVisible();

  await publicPage.getByRole("button", { name: /lacak permohonan/i }).click();
  await expect(publicPage.getByText(/nomor permohonan wajib diisi/i)).toBeVisible();

  await publicPage.getByLabel(/nomor permohonan/i).fill("I-TIDAK-ADA-999");
  await publicPage.getByRole("button", { name: /lacak permohonan/i }).click();
  await expect(publicPage.getByText(/nomor permohonan tidak ditemukan/i)).toBeVisible();

  await publicPage.getByLabel(/nomor permohonan/i).fill(submissionNumber);
  await publicPage.getByRole("button", { name: /lacak permohonan/i }).click();
  await expect(publicPage.locator("#tracking-result-summary")).toContainText(submissionNumber, { timeout: 15000 });
  await expect(publicPage.locator("#tracking-result-summary")).toContainText(organizationName);

  await deleteSubmissionFromDashboard(adminPage, submissionNumber);

  await adminPage.close();
  await publicPage.close();
  await adminContext.close();
  await publicContext.close();
});
