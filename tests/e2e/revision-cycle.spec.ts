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

test("revision cycle syncs correctly between admin and public tracking", async ({ browser }) => {
  test.setTimeout(120000);

  const adminContext = await browser.newContext();
  const publicContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  const publicPage = await publicContext.newPage();

  const suffix = uniqueSuffix();
  const submissionNumber = `I-REVISION-${suffix}`;
  const organizationName = `LPK Revision ${suffix}`;
  const revisionNote = "Perbaiki dokumen surat permohonan dengan lampiran terbaru.";

  await loginAsAdmin(adminPage);
  await createSubmission(adminPage, submissionNumber, organizationName);

  await adminPage.getByRole("button", { name: /konfirmasi pengajuan/i }).click();
  await adminPage.getByRole("button", { name: /ya, konfirmasi & lanjut/i }).click();
  await expect(adminPage.getByRole("heading", { name: /verifikasi dokumen/i })).toBeVisible({ timeout: 15000 });

  const docCards = adminPage.locator('[data-testid^="session-editor-doc-"]');
  const docCount = await docCards.count();
  for (let index = 0; index < docCount; index += 1) {
    const card = docCards.nth(index);
    const select = card.getByRole("combobox");
    if (index === 0) {
      await select.selectOption("revision_required");
      await expect(select).toHaveValue("revision_required");
      await card.getByPlaceholder(/tulis catatan perbaikan/i).fill(revisionNote);
    } else {
      await select.selectOption("approved");
      await expect(select).toHaveValue("approved");
    }
  }

  const revisionSubmitButton = adminPage.getByRole("button", { name: /perlu perbaikan/i });
  await expect(revisionSubmitButton).toBeEnabled({ timeout: 15000 });
  await revisionSubmitButton.click();
  await adminPage.getByRole("button", { name: /ya, simpan perbaikan/i }).click();
  await expect(adminPage.locator("main")).toContainText(/memerlukan perbaikan/i, { timeout: 15000 });
  await expect(adminPage.locator('[data-testid="session-editor-doc-1"]')).toContainText(/memerlukan perbaikan/i);

  await publicPage.goto("/");
  await publicPage.getByLabel(/nomor permohonan/i).fill(submissionNumber);
  await publicPage.getByRole("button", { name: /lacak permohonan/i }).click();
  await expect(publicPage.locator("#tracking-result-summary")).toContainText(submissionNumber, { timeout: 15000 });

  const revisionCard = publicPage.getByTestId("user-doc-verifikasi-1").getByRole("button", { name: /surat permohonan izin/i });
  await revisionCard.click();
  await expect(publicPage.getByText(/unggah dokumen perbaikan/i)).toBeVisible();
  await publicPage.locator('input[type="file"]').setInputFiles(fixturePdfPath);
  await publicPage.getByRole("button", { name: /ya, unggah dokumen/i }).click();
  const refreshedRevisionCard = publicPage.getByTestId("user-doc-verifikasi-1").getByRole("button", { name: /surat permohonan izin/i });
  await refreshedRevisionCard.click();
  await expect(publicPage.locator("main")).toContainText(/unggahan terakhir|sample-upload\.pdf/i, { timeout: 15000 });

  await adminPage.reload();
  await expect(adminPage.locator("main")).toContainText(/siap diperiksa ulang|dokumen perbaikan terbaru sudah diunggah/i, { timeout: 15000 });

  await adminPage.getByRole("button", { name: /kembali ke dashboard admin/i }).click();
  const row = adminPage.getByRole("row").filter({ hasText: submissionNumber }).first();
  await row.getByRole("button", { name: /kelola permohonan/i }).click();
  await adminPage.getByRole("button", { name: /^hapus$/i }).click();
  await adminPage.getByRole("button", { name: /^hapus$/i }).last().click();
  await expect(adminPage.getByRole("row").filter({ hasText: submissionNumber })).toHaveCount(0, { timeout: 15000 });

  await adminPage.close();
  await publicPage.close();
  await adminContext.close();
  await publicContext.close();
});
