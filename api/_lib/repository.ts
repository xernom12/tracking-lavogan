import { count, desc, eq } from "drizzle-orm";
import { submissionSnapshots } from "../../db/schema.js";
import { initialSubmissions } from "../../src/data/initialSubmissions.js";
import type { AdminSubmission } from "../../src/lib/submission-types.js";
import { ensureSchemaReady, getDb, isDatabaseConfigured } from "./db.js";

const normalizeSubmission = (submission: AdminSubmission): AdminSubmission => ({
  ...submission,
  skFileUrl: submission.skFileUrl || "",
  skBlobPath: submission.skBlobPath || "",
  documents: submission.documents.map((document) => ({
    ...document,
    uploads: (document.uploads || []).map((upload) => ({
      ...upload,
      fileUrl: upload.fileUrl || "",
      blobPath: upload.blobPath || "",
    })),
  })),
  reviewDocuments: submission.reviewDocuments.map((document) => ({
    ...document,
    uploads: (document.uploads || []).map((upload) => ({
      ...upload,
      fileUrl: upload.fileUrl || "",
      blobPath: upload.blobPath || "",
    })),
  })),
});

const ensureSeedData = async () => {
  const db = getDb();
  const [{ total }] = await db
    .select({ total: count() })
    .from(submissionSnapshots);

  if (Number(total) > 0) return;

  const seeded = initialSubmissions.map((submission) => normalizeSubmission(submission));
  await db.insert(submissionSnapshots).values(
    seeded.map((submission) => ({
      id: submission.id,
      submissionNumber: submission.submissionNumber,
      submissionType: submission.submissionType,
      organizationName: submission.organizationName,
      nib: submission.nib,
      kbli: submission.kbli,
      ossStatus: submission.ossStatus,
      licenseIssued: submission.licenseIssued,
      licenseStatus: submission.licenseStatus || "",
      lastUpdatedLabel: submission.lastUpdated,
      payload: submission,
    })),
  );
};

export const assertDatabaseConfigured = () => {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL belum dikonfigurasi.");
  }
};

export const listSubmissions = async (): Promise<AdminSubmission[]> => {
  assertDatabaseConfigured();
  await ensureSchemaReady();
  await ensureSeedData();

  const db = getDb();
  const rows = await db
    .select()
    .from(submissionSnapshots)
    .orderBy(desc(submissionSnapshots.updatedAt));

  return rows.map((row) => normalizeSubmission(row.payload));
};

export const getSubmissionById = async (id: string): Promise<AdminSubmission | null> => {
  assertDatabaseConfigured();
  await ensureSchemaReady();
  await ensureSeedData();

  const db = getDb();
  const rows = await db
    .select()
    .from(submissionSnapshots)
    .where(eq(submissionSnapshots.id, id))
    .limit(1);

  if (!rows[0]) return null;
  return normalizeSubmission(rows[0].payload);
};

export const upsertSubmission = async (submission: AdminSubmission) => {
  assertDatabaseConfigured();
  await ensureSchemaReady();

  const normalized = normalizeSubmission(submission);
  const db = getDb();
  await db
    .insert(submissionSnapshots)
    .values({
      id: normalized.id,
      submissionNumber: normalized.submissionNumber,
      submissionType: normalized.submissionType,
      organizationName: normalized.organizationName,
      nib: normalized.nib,
      kbli: normalized.kbli,
      ossStatus: normalized.ossStatus,
      licenseIssued: normalized.licenseIssued,
      licenseStatus: normalized.licenseStatus || "",
      lastUpdatedLabel: normalized.lastUpdated,
      payload: normalized,
    })
    .onConflictDoUpdate({
      target: submissionSnapshots.id,
      set: {
        submissionNumber: normalized.submissionNumber,
        submissionType: normalized.submissionType,
        organizationName: normalized.organizationName,
        nib: normalized.nib,
        kbli: normalized.kbli,
        ossStatus: normalized.ossStatus,
        licenseIssued: normalized.licenseIssued,
        licenseStatus: normalized.licenseStatus || "",
        lastUpdatedLabel: normalized.lastUpdated,
        payload: normalized,
        updatedAt: new Date(),
      },
    });

  return normalized;
};

export const deleteSubmissionById = async (id: string) => {
  assertDatabaseConfigured();
  await ensureSchemaReady();

  const db = getDb();
  await db.delete(submissionSnapshots).where(eq(submissionSnapshots.id, id));
};
