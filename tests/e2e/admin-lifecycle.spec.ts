import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const adminCredentials = {
  email: "admin.testing@tracking-os.local",
  password: "TrackingOS!Test2026",
};

const fixturePdfPath = path.resolve(process.cwd(), "tests/fixtures/sample-upload.pdf");

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

  const row = page.getByRole("row").filter({ hasText: submissionNumber }).first();
  await expect(row).toBeVisible({ timeout: 15000 });
  await row.getByRole("button", { name: /kelola permohonan/i }).click();
  await page.getByRole("button", { name: /^kelola$/i }).click();
  await expect(page).toHaveURL(/\/admin\/kelola\//);
};

const approveAllDocumentsInCurrentStage = async (page: Page) => {
  const documentCards = page.locator('[data-testid^="session-editor-doc-"]');
  const count = await documentCards.count();

  for (let index = 0; index < count; index += 1) {
    const select = documentCards.nth(index).getByRole("combobox");
    await select.selectOption("approved");
    await expect(select).toHaveValue("approved");
  }
};

const confirmStageSubmit = async (page: Page) => {
  await page.getByRole("button", { name: /^(lanjut|perlu perbaikan)$/i }).click();
  await page.getByRole("button", { name: /^ya, simpan & lanjut$/i }).click();
};

const waitForStageHeading = async (page: Page, heading: RegExp) => {
  await expect(page.getByRole("heading", { name: heading })).toBeVisible({ timeout: 15000 });
};

const deleteSubmissionFromDashboard = async (page: Page, submissionNumber: string) => {
  await page.getByRole("button", { name: /kembali ke dashboard admin/i }).click();
  await expect(page).toHaveURL(/\/admin$/);

  const row = page.getByRole("row").filter({ hasText: submissionNumber }).first();
  await expect(row).toBeVisible({ timeout: 15000 });
  await row.getByRole("button", { name: /kelola permohonan/i }).click();
  await page.getByRole("button", { name: /^hapus$/i }).click();
  await page.getByRole("button", { name: /^hapus$/i }).last().click();
  await expect(page.getByRole("row").filter({ hasText: submissionNumber })).toHaveCount(0, { timeout: 15000 });
};

test("admin can complete a full lifecycle from submission to issued license", async ({ page }) => {
  test.setTimeout(120000);

  const suffix = uniqueSuffix();
  const submissionNumber = `I-LIFECYCLE-${suffix}`;
  const organizationName = `LPK Lifecycle ${suffix}`;
  const pbUmkuNumber = `PB-UMKU-${suffix}`;

  await loginAsAdmin(page);
  await createSubmission(page, submissionNumber, organizationName);
  await waitForStageHeading(page, /^pengajuan$/i);

  await page.getByRole("button", { name: /konfirmasi pengajuan/i }).click();
  await page.getByRole("button", { name: /ya, konfirmasi & lanjut/i }).click();
  await waitForStageHeading(page, /verifikasi dokumen/i);

  await approveAllDocumentsInCurrentStage(page);
  await confirmStageSubmit(page);
  await waitForStageHeading(page, /peninjauan dokumen/i);

  await approveAllDocumentsInCurrentStage(page);
  await confirmStageSubmit(page);
  await waitForStageHeading(page, /^persetujuan$/i);

  await page.locator('input[type="date"]').first().fill("2026-04-22");
  await page.getByPlaceholder(/masukkan nomor izin pb umku/i).fill(pbUmkuNumber);
  await page.locator('input[type="file"]').setInputFiles(fixturePdfPath);
  await page.getByRole("button", { name: /simpan persetujuan & lanjut/i }).click();
  await page.getByRole("button", { name: /^ya, simpan & lanjut$/i }).click();
  await waitForStageHeading(page, /^izin terbit$/i);

  await page.getByRole("combobox").selectOption("Aktif");
  await page.getByRole("button", { name: /simpan izin terbit/i }).click();
  await page.getByRole("button", { name: /ya, simpan izin/i }).click();

  await expect(page.locator("main")).toContainText(pbUmkuNumber, { timeout: 15000 });
  await expect(page.locator("main")).toContainText("Aktif", { timeout: 15000 });

  await deleteSubmissionFromDashboard(page, submissionNumber);
});
