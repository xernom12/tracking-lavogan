import type {
  Document,
  DocumentHistoryEntry,
  DocumentStatus,
  DocumentUploadEntry,
  SubmissionData,
} from "../data/mockData.js";
import { ensureWibTime, ensureWibTimestamp } from "../data/mockData.js";
import { DOCUMENT_NAMES, buildReviewDocuments } from "../data/submissionDocuments.js";
import { normalizeKbliCode } from "../data/kbliOptions.js";
import { normalizeLicenseStatus, normalizeSubmissionType } from "./submission-domain.js";

export type StoredSubmission = SubmissionData & { id: string };

const parseLastUpdatedParts = (lastUpdated: string): { date: string; time: string } => {
  const [dateRaw, timeRaw] = lastUpdated.split(",");
  return {
    date: dateRaw?.trim() || "-",
    time: ensureWibTime(timeRaw?.trim() || "-"),
  };
};

export const normalizeLegacyDocumentStatus = (value: string): DocumentStatus => {
  if (value === "approved") return "approved";
  if (value === "revision_required") return "revision_required";
  if (value === "under_review") return "locked";
  return "locked";
};

const buildInitialHistoryEntry = (
  status: DocumentStatus,
  note: string | undefined,
  lastUpdated: string,
): DocumentHistoryEntry | null => {
  if (status === "locked") return null;
  const parts = parseLastUpdatedParts(lastUpdated);
  return {
    date: parts.date,
    time: parts.time,
    status,
    note,
  };
};

const normalizeDocumentUploads = (uploads: Document["uploads"]): DocumentUploadEntry[] => {
  if (!Array.isArray(uploads) || uploads.length === 0) return [];

  return uploads
    .map((entry) => ({
      fileName: entry.fileName?.trim() || "",
      fileSizeBytes: Number.isFinite(entry.fileSizeBytes) && entry.fileSizeBytes > 0
        ? entry.fileSizeBytes
        : 0,
      date: entry.date?.trim() || "-",
      time: ensureWibTime(entry.time || "-"),
      phase: (entry.phase === "PENINJAUAN" ? "PENINJAUAN" : "VERIFIKASI") as "VERIFIKASI" | "PENINJAUAN",
      fileUrl: entry.fileUrl?.trim() || "",
      blobPath: entry.blobPath?.trim() || "",
    }))
    .filter((entry) => entry.fileName);
};

const normalizeDocumentHistory = (doc: Document, lastUpdated: string): Document => {
  const safeStatus = normalizeLegacyDocumentStatus(String(doc.status));
  const safeNote = safeStatus === "revision_required" ? doc.note : undefined;
  const uploads = normalizeDocumentUploads(doc.uploads);

  if (Array.isArray(doc.history) && doc.history.length > 0) {
    const normalizedHistory = doc.history
      .map((entry) => ({
        ...entry,
        status: normalizeLegacyDocumentStatus(String(entry.status)),
        time: ensureWibTime(entry.time || "-"),
      }))
      .filter((entry) => entry.status !== "locked");

    return {
      ...doc,
      status: safeStatus,
      note: safeNote,
      history: normalizedHistory,
      uploads,
    };
  }

  const initialEntry = buildInitialHistoryEntry(safeStatus, safeNote, lastUpdated);
  return {
    ...doc,
    status: safeStatus,
    note: safeNote,
    history: initialEntry ? [initialEntry] : [],
    uploads,
  };
};

export const appendHistoryIfChanged = (
  doc: Document,
  status: DocumentStatus,
  note: string | undefined,
  timestamp: { date: string; time: string },
  forceAppend = false,
): Document => {
  const normalized = doc.history?.length ? doc : { ...doc, history: [] };
  const lastEntry = normalized.history[normalized.history.length - 1];
  const nextNote = note?.trim() || undefined;

  if (status === "locked") {
    return {
      ...normalized,
      status,
      note: undefined,
    };
  }

  if (!forceAppend && lastEntry && lastEntry.status === status && (lastEntry.note || "") === (nextNote || "")) {
    return {
      ...normalized,
      status,
      note: nextNote,
    };
  }

  return {
    ...normalized,
    status,
    note: nextNote,
    history: [
      ...normalized.history,
      {
        date: timestamp.date,
        time: timestamp.time,
        status,
        note: nextNote,
      },
    ],
  };
};

const inferVerificationCompleted = <T extends StoredSubmission>(submission: T): boolean => {
  if (typeof submission.verificationCompleted === "boolean") return submission.verificationCompleted;

  const hasPendingWorklist = Array.isArray(submission.verificationWorklistDocNumbers)
    && submission.verificationWorklistDocNumbers.length > 0;
  if (hasPendingWorklist) return false;

  const allDocsApproved = submission.documents.every(
    (doc) => normalizeLegacyDocumentStatus(String(doc.status)) === "approved",
  );
  if (!allDocsApproved) return false;

  const hasMovedBeyondVerification = (submission.timeline || []).some(
    (event) => event.phase === "PENINJAUAN" || event.phase === "PERSETUJUAN" || event.phase === "IZIN_TERBIT",
  );

  return hasMovedBeyondVerification || submission.reviewCompleted || submission.approvalCompleted || submission.licenseIssued;
};

const normalizeReviewDocuments = (
  reviewDocuments: Document[] | undefined,
  lastUpdated: string,
): Document[] => {
  const fallback = buildReviewDocuments("locked");
  if (!Array.isArray(reviewDocuments) || reviewDocuments.length !== DOCUMENT_NAMES.length) {
    return fallback;
  }

  return reviewDocuments.map((doc, index) =>
    normalizeDocumentHistory(
      {
        ...doc,
        name: DOCUMENT_NAMES[index],
      },
      lastUpdated,
    ),
  );
};

const normalizeWorklist = (worklist: number[] | undefined): number[] => {
  if (!Array.isArray(worklist)) return [];
  return Array.from(new Set(worklist.filter((n) => Number.isInteger(n) && n >= 1 && n <= 8))).sort((a, b) => a - b);
};

const normalizeSubmissionDocuments = <T extends StoredSubmission>(submission: T): T => ({
  ...submission,
  nib: submission.nib || "1234567890123",
  submissionType: normalizeSubmissionType(submission.submissionType),
  kbli: normalizeKbliCode(submission.kbli) || "85493",
  licenseStatus: normalizeLicenseStatus(submission.licenseStatus, submission.licenseIssued),
  lastUpdated: ensureWibTimestamp(submission.lastUpdated || "-"),
  skFileName: submission.skFileName?.trim() || "",
  skFileSizeBytes: Number.isFinite(submission.skFileSizeBytes) && submission.skFileSizeBytes > 0
    ? submission.skFileSizeBytes
    : 0,
  skFileUrl: submission.skFileUrl?.trim() || "",
  skBlobPath: submission.skBlobPath?.trim() || "",
  verificationCompleted: inferVerificationCompleted(submission),
  reviewCycle: Number.isInteger(submission.reviewCycle) && submission.reviewCycle > 0 ? submission.reviewCycle : 1,
  reviewDocuments: normalizeReviewDocuments(submission.reviewDocuments, submission.lastUpdated),
  verificationWorklistDocNumbers: normalizeWorklist(submission.verificationWorklistDocNumbers),
  lastRevisionCarryover: submission.lastRevisionCarryover && Array.isArray(submission.lastRevisionCarryover.worklistDocNumbers)
    ? {
      ...submission.lastRevisionCarryover,
      worklistDocNumbers: normalizeWorklist(submission.lastRevisionCarryover.worklistDocNumbers),
    }
    : undefined,
  timeline: submission.timeline.map((event) => ({
    ...event,
    actor: event.actor || "Admin",
    time: ensureWibTime(event.time || "-"),
  })),
  documents: submission.documents.map((doc) =>
    normalizeDocumentHistory(doc, submission.lastUpdated),
  ),
});

export const loadStoredSubmissions = <T extends StoredSubmission>(
  storageKey: string,
  fallbackSubmissions: T[],
  defaultOssStatus: string,
): T[] => {
  if (typeof window === "undefined") return fallbackSubmissions.map(normalizeSubmissionDocuments);

  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return fallbackSubmissions.map(normalizeSubmissionDocuments);

  try {
    const parsed = JSON.parse(raw) as T[];
    if (!Array.isArray(parsed)) return fallbackSubmissions.map(normalizeSubmissionDocuments);

      const normalizedParsed = parsed.map((item) => ({
        ...item,
        submissionType: normalizeSubmissionType(item.submissionType),
        kbli: normalizeKbliCode(item.kbli) || "85493",
        ossStatus: item.ossStatus?.trim() || defaultOssStatus,
        licenseStatus: normalizeLicenseStatus(item.licenseStatus, item.licenseIssued),
      lastUpdated: ensureWibTimestamp(item.lastUpdated || "-"),
      reviewCycle: Number.isInteger(item.reviewCycle) && item.reviewCycle > 0 ? item.reviewCycle : 1,
      skFileName: item.skFileName?.trim() || "",
      skFileSizeBytes: Number.isFinite(item.skFileSizeBytes) && item.skFileSizeBytes > 0
        ? item.skFileSizeBytes
        : 0,
      skFileUrl: item.skFileUrl?.trim() || "",
      skBlobPath: item.skBlobPath?.trim() || "",
      reviewDocuments: normalizeReviewDocuments(item.reviewDocuments, item.lastUpdated),
      verificationWorklistDocNumbers: normalizeWorklist(item.verificationWorklistDocNumbers),
      lastRevisionCarryover: item.lastRevisionCarryover && Array.isArray(item.lastRevisionCarryover.worklistDocNumbers)
        ? {
          ...item.lastRevisionCarryover,
          worklistDocNumbers: normalizeWorklist(item.lastRevisionCarryover.worklistDocNumbers),
        }
        : undefined,
      timeline: (item.timeline || []).map((event) => ({
        ...event,
        actor: event.actor || "Admin",
        time: ensureWibTime(event.time || "-"),
      })),
    }));

    return normalizedParsed.map(normalizeSubmissionDocuments);
  } catch {
    return fallbackSubmissions.map(normalizeSubmissionDocuments);
  }
};
