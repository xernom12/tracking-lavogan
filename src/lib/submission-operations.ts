import type {
  DocumentUploadEntry,
  TimelineEvent,
} from "../data/mockData.js";
import {
  formatTimestamp,
  formatTimelineNow,
  hasApprovalDraftReadyForIssuance,
  hasUploadedRevisionAfterLatestRequest,
  normalizePbUmkuNumber,
} from "../data/mockData.js";
import { buildReviewDocuments } from "../data/submissionDocuments.js";
import { normalizeKbliCode } from "../data/kbliOptions.js";
import {
  findSubmissionBySubmissionNumber,
  normalizeLicenseStatus,
  normalizeNib,
  normalizeSubmissionType,
} from "./submission-domain.js";
import {
  createSessionDecisionEvents,
  createSessionSummaryEvent,
  getNextSessionNumber,
  normalizeSessionDecisions,
} from "./submission-sessions.js";
import { appendHistoryIfChanged, normalizeLegacyDocumentStatus } from "./submission-storage.js";
import type {
  AdminSubmission,
  ApprovalFinalizeInput,
  IssuedSkFileUpdateInput,
  LicenseIssuanceInput,
  NewSubmissionInput,
  RevisionUploadInput,
  SessionDecisionInput,
} from "./submission-types.js";

const DEFAULT_OSS_STATUS = "Menunggu Verifikasi K/L";

const replaceSubmission = (
  submissions: AdminSubmission[],
  id: string,
  updater: (submission: AdminSubmission) => AdminSubmission,
) => submissions.map((submission) => (submission.id === id ? updater(submission) : submission));

export const createSubmissionRecord = (
  submissions: AdminSubmission[],
  input: NewSubmissionInput,
  actor: string,
): AdminSubmission[] => {
  const normalizedSubmissionNumber = input.submissionNumber.trim();
  if (!normalizedSubmissionNumber) return submissions;

  const duplicate = findSubmissionBySubmissionNumber(submissions, normalizedSubmissionNumber);
  if (duplicate) return submissions;

  const timestamp = formatTimelineNow();
  const nextSubmission: AdminSubmission = {
    id: input.id?.trim() || String(Date.now()),
    submissionNumber: normalizedSubmissionNumber,
    submissionType: normalizeSubmissionType(input.submissionType),
    organizationName: input.organizationName.trim(),
    nib: normalizeNib(input.nib),
    kbli: normalizeKbliCode(input.kbli),
    ossStatus: DEFAULT_OSS_STATUS,
    pengajuanDate: input.pengajuanDate.trim(),
    lastUpdated: formatTimestamp(),
    pengajuanConfirmed: false,
    verificationCompleted: false,
    documents: buildReviewDocuments("locked"),
    reviewNotes: "",
    reviewCompleted: false,
    approvalCompleted: false,
    approvalDate: "",
    licenseIssued: false,
    licenseStatus: "",
    licenseNumber: "",
    licenseDate: "",
    skFileName: "",
    skFileSizeBytes: 0,
    skFileUrl: "",
    skBlobPath: "",
    reviewCycle: 1,
    reviewDocuments: buildReviewDocuments("locked"),
    verificationWorklistDocNumbers: [],
    timeline: [
      {
        date: timestamp.date,
        time: timestamp.time,
        actor,
        phase: "PENGAJUAN",
        description: "Data permohonan berhasil dibuat.",
        type: "info",
      },
    ],
  };

  return [nextSubmission, ...submissions];
};

export const updatePengajuanSubmission = (
  submissions: AdminSubmission[],
  id: string,
  input: NewSubmissionInput,
): AdminSubmission[] =>
  replaceSubmission(submissions, id, (submission) => {
    const cleanInput = {
      submissionNumber: input.submissionNumber.trim(),
      submissionType: normalizeSubmissionType(input.submissionType),
      organizationName: input.organizationName.trim(),
      nib: normalizeNib(input.nib),
      kbli: normalizeKbliCode(input.kbli),
      pengajuanDate: input.pengajuanDate.trim(),
    };

    const duplicate = submissions.find(
      (item) =>
        item.id !== id
        && normalizePbUmkuNumber(item.submissionNumber) === normalizePbUmkuNumber(cleanInput.submissionNumber),
    );
    if (duplicate) return submission;

    const hasChanges = submission.submissionNumber !== cleanInput.submissionNumber
      || submission.submissionType !== cleanInput.submissionType
      || submission.organizationName !== cleanInput.organizationName
      || submission.nib !== cleanInput.nib
      || submission.kbli !== cleanInput.kbli
      || submission.pengajuanDate !== cleanInput.pengajuanDate;

    if (!hasChanges) return submission;

    return {
      ...submission,
      ...cleanInput,
      lastUpdated: formatTimestamp(),
    };
  });

export const deleteSubmissionRecord = (
  submissions: AdminSubmission[],
  id: string,
) => submissions.filter((submission) => submission.id !== id);

export const confirmPengajuanSubmission = (
  submissions: AdminSubmission[],
  id: string,
  actor: string,
): AdminSubmission[] => {
  const timestamp = formatTimelineNow();

  return replaceSubmission(submissions, id, (submission) => ({
    ...submission,
    pengajuanConfirmed: true,
    verificationCompleted: false,
    lastUpdated: formatTimestamp(),
    timeline: [
      ...submission.timeline,
      {
        date: timestamp.date,
        time: timestamp.time,
        actor,
        phase: "PENGAJUAN",
        description: "Pengajuan dikonfirmasi. Tahap Verifikasi Dokumen dimulai.",
        type: "info",
      },
    ],
  }));
};

export const uploadRevisionSubmissionDocument = (
  submissions: AdminSubmission[],
  id: string,
  phase: "VERIFIKASI" | "PENINJAUAN",
  documentNumber: number,
  input: RevisionUploadInput,
): AdminSubmission[] => {
  const cleanName = input.fileName.trim();
  const cleanSize = Number.isFinite(input.fileSizeBytes) && input.fileSizeBytes > 0
    ? input.fileSizeBytes
    : 0;

  if (!cleanName || cleanSize <= 0 || !Number.isInteger(documentNumber)) return submissions;

  const timestamp = formatTimelineNow();

  return replaceSubmission(submissions, id, (submission) => {
    const documents = phase === "VERIFIKASI" ? submission.documents : submission.reviewDocuments;
    const targetDocument = documents[documentNumber - 1];

    if (!targetDocument) return submission;
    if (normalizeLegacyDocumentStatus(String(targetDocument.status)) !== "revision_required") return submission;

    const nextUpload: DocumentUploadEntry = {
      fileName: cleanName,
      fileSizeBytes: cleanSize,
      date: timestamp.date,
      time: timestamp.time,
      phase,
      fileUrl: input.fileUrl?.trim() || undefined,
      blobPath: input.blobPath?.trim() || undefined,
    };

    const nextDocuments = documents.map((document, index) => {
      if (index !== documentNumber - 1) return document;
      return {
        ...document,
        uploads: [...(document.uploads || []), nextUpload],
      };
    });

    const nextTimelineEvent: TimelineEvent = {
      date: timestamp.date,
      time: timestamp.time,
      actor: "Pemohon",
      phase,
      documentNumber,
      description: `Dokumen perbaikan untuk ${targetDocument.name} diunggah: ${cleanName}.`,
      type: "info",
    };

    if (phase === "VERIFIKASI") {
      return {
        ...submission,
        documents: nextDocuments,
        lastUpdated: formatTimestamp(),
        timeline: [...submission.timeline, nextTimelineEvent],
      };
    }

    return {
      ...submission,
      reviewDocuments: nextDocuments,
      lastUpdated: formatTimestamp(),
      timeline: [...submission.timeline, nextTimelineEvent],
    };
  });
};

export const submitVerificationSubmissionSession = (
  submissions: AdminSubmission[],
  id: string,
  decisions: SessionDecisionInput[],
  actor: string,
): AdminSubmission[] => {
  const timestamp = formatTimelineNow();

  return replaceSubmission(submissions, id, (submission) => {
    if (!submission.pengajuanConfirmed || submission.verificationCompleted) return submission;

    const reuploadedDocNumbers = submission.documents
      .map((document, index) => ({ document, docNumber: index + 1 }))
      .filter(({ document, docNumber }) =>
        document.status === "revision_required"
        && hasUploadedRevisionAfterLatestRequest(submission.timeline, docNumber, "VERIFIKASI"),
      )
      .map(({ docNumber }) => docNumber);

    const normalized = normalizeSessionDecisions(decisions, submission.documents.length, {
      requireRevisionNote: true,
      requireRevisionNoteForDocNumbers: reuploadedDocNumbers,
    });
    if (!normalized) return submission;

    const nextDocuments = submission.documents.map((document, index) =>
      appendHistoryIfChanged(
        document,
        normalized[index].status,
        normalized[index].note,
        timestamp,
        true,
      ),
    );

    const hasRevision = normalized.some((decision) => decision.status === "revision_required");
    const nextRevisionDocNumbers = normalized
      .map((decision, index) => ({ decision, docNumber: index + 1 }))
      .filter(({ decision }) => decision.status === "revision_required")
      .map(({ docNumber }) => docNumber);
    const sessionNumber = getNextSessionNumber(submission.timeline, "VERIFIKASI");
    const decisionEvents = createSessionDecisionEvents(
      "VERIFIKASI",
      sessionNumber,
      normalized,
      nextDocuments,
      timestamp,
      actor,
    );

    return {
      ...submission,
      documents: nextDocuments,
      verificationCompleted: !hasRevision,
      reviewCompleted: false,
      approvalCompleted: false,
      approvalDate: "",
      licenseIssued: false,
      licenseStatus: "",
      licenseNumber: "",
      licenseDate: "",
      skFileName: "",
      skFileSizeBytes: 0,
      skFileUrl: "",
      skBlobPath: "",
      verificationWorklistDocNumbers: hasRevision ? nextRevisionDocNumbers : [],
      lastRevisionCarryover: undefined,
      lastUpdated: formatTimestamp(),
      timeline: [
        ...submission.timeline,
        ...decisionEvents,
        createSessionSummaryEvent(
          "VERIFIKASI",
          sessionNumber,
          normalized,
          nextDocuments,
          timestamp,
          actor,
          hasRevision,
        ),
      ],
    };
  });
};

export const submitReviewSubmissionSession = (
  submissions: AdminSubmission[],
  id: string,
  decisions: SessionDecisionInput[],
  actor: string,
): AdminSubmission[] => {
  const timestamp = formatTimelineNow();

  return replaceSubmission(submissions, id, (submission) => {
    if (!submission.verificationCompleted || submission.reviewCompleted) return submission;

    const reuploadedDocNumbers = submission.reviewDocuments
      .map((document, index) => ({ document, docNumber: index + 1 }))
      .filter(({ document, docNumber }) =>
        document.status === "revision_required"
        && hasUploadedRevisionAfterLatestRequest(submission.timeline, docNumber, "PENINJAUAN"),
      )
      .map(({ docNumber }) => docNumber);

    const normalized = normalizeSessionDecisions(decisions, submission.reviewDocuments.length, {
      requireRevisionNote: false,
      requireRevisionNoteForDocNumbers: reuploadedDocNumbers,
    });
    if (!normalized) return submission;

    const nextReviewDocuments = submission.reviewDocuments.map((document, index) =>
      appendHistoryIfChanged(
        document,
        normalized[index].status,
        normalized[index].note,
        timestamp,
        true,
      ),
    );

    const hasRevision = normalized.some((decision) => decision.status === "revision_required");
    const sessionNumber = getNextSessionNumber(submission.timeline, "PENINJAUAN");
    const revisionDocNumbers = normalized
      .map((decision, index) => ({ decision, docNumber: index + 1 }))
      .filter(({ decision }) => decision.status === "revision_required")
      .map(({ docNumber }) => docNumber);
    const decisionEvents = createSessionDecisionEvents(
      "PENINJAUAN",
      sessionNumber,
      normalized,
      nextReviewDocuments,
      timestamp,
      actor,
    );

    return {
      ...submission,
      reviewDocuments: nextReviewDocuments,
      reviewCompleted: !hasRevision,
      reviewNotes: hasRevision
        ? `Masih terdapat dokumen yang memerlukan perbaikan: ${revisionDocNumbers.join(", ")}.`
        : "Seluruh dokumen pada tahap peninjauan dinyatakan sesuai persyaratan.",
      approvalCompleted: false,
      approvalDate: "",
      licenseIssued: false,
      licenseStatus: "",
      licenseNumber: "",
      licenseDate: "",
      skFileName: "",
      skFileSizeBytes: 0,
      skFileUrl: "",
      skBlobPath: "",
      lastUpdated: formatTimestamp(),
      timeline: [
        ...submission.timeline,
        ...decisionEvents,
        createSessionSummaryEvent(
          "PENINJAUAN",
          sessionNumber,
          normalized,
          nextReviewDocuments,
          timestamp,
          actor,
          hasRevision,
        ),
      ],
    };
  });
};

export const finalizeApprovalSubmission = (
  submissions: AdminSubmission[],
  id: string,
  input: ApprovalFinalizeInput,
  actor: string,
): AdminSubmission[] => {
  const cleanApprovalDate = input.approvalDate.trim();
  const cleanNumber = normalizePbUmkuNumber(input.pbUmkuNumber);
  const cleanFileName = input.skFileName.trim();
  const cleanSize = Number.isFinite(input.skFileSizeBytes) && input.skFileSizeBytes > 0
    ? input.skFileSizeBytes
    : 0;
  const hasDuplicateNumber = submissions.some(
    (submission) => submission.id !== id && normalizePbUmkuNumber(submission.licenseNumber || "") === cleanNumber,
  );

  if (!cleanApprovalDate || !cleanNumber || !cleanFileName || cleanSize <= 0) return submissions;
  if (!cleanFileName.toLowerCase().endsWith(".pdf")) return submissions;
  if (hasDuplicateNumber) return submissions;

  const timestamp = formatTimelineNow();

  return replaceSubmission(submissions, id, (submission) => {
    if (!submission.reviewCompleted || submission.licenseIssued) return submission;

    return {
      ...submission,
      ossStatus: "Izin Terbit",
      approvalCompleted: true,
      approvalDate: cleanApprovalDate,
      licenseIssued: false,
      licenseStatus: "",
      licenseNumber: cleanNumber,
      licenseDate: "",
      skFileName: cleanFileName,
      skFileSizeBytes: cleanSize,
      skFileUrl: input.skFileUrl?.trim() || submission.skFileUrl || "",
      skBlobPath: input.skBlobPath?.trim() || submission.skBlobPath || "",
      lastUpdated: formatTimestamp(),
      timeline: [
        ...submission.timeline,
        {
          date: timestamp.date,
          time: timestamp.time,
          actor,
          phase: "PERSETUJUAN",
          description: "Data persetujuan disimpan. Lanjut ke Izin Terbit untuk menetapkan status izin.",
          type: "success",
        },
      ],
    };
  });
};

export const issueLicenseSubmission = (
  submissions: AdminSubmission[],
  id: string,
  input: LicenseIssuanceInput,
  actor: string,
): AdminSubmission[] => {
  const cleanStatus = normalizeLicenseStatus(input.status);
  if (!cleanStatus) return submissions;

  const timestamp = formatTimelineNow();
  const issuedAt = formatTimestamp();

  return replaceSubmission(submissions, id, (submission) => {
    if (!submission.approvalCompleted || submission.licenseIssued) return submission;
    if (!hasApprovalDraftReadyForIssuance(submission)) return submission;

    return {
      ...submission,
      ossStatus: "Izin Terbit",
      licenseIssued: true,
      licenseStatus: cleanStatus,
      licenseDate: issuedAt,
      lastUpdated: issuedAt,
      timeline: [
        ...submission.timeline,
        {
          date: timestamp.date,
          time: timestamp.time,
          actor,
          phase: "IZIN_TERBIT",
          description: `Izin PB UMKU diterbitkan dengan status ${cleanStatus}.`,
          type: "success",
        },
      ],
    };
  });
};

export const replaceIssuedSkFileSubmission = (
  submissions: AdminSubmission[],
  id: string,
  input: IssuedSkFileUpdateInput,
  actor: string,
): AdminSubmission[] => {
  const cleanFileName = input.skFileName.trim();
  const cleanSize = Number.isFinite(input.skFileSizeBytes) && input.skFileSizeBytes > 0
    ? input.skFileSizeBytes
    : 0;
  const cleanFileUrl = input.skFileUrl?.trim() || "";
  const cleanBlobPath = input.skBlobPath?.trim() || "";

  if (!cleanFileName || cleanSize <= 0 || !cleanFileUrl) return submissions;
  if (!cleanFileName.toLowerCase().endsWith(".pdf")) return submissions;

  const timestamp = formatTimelineNow();

  return replaceSubmission(submissions, id, (submission) => {
    if (!submission.approvalCompleted) return submission;

    return {
      ...submission,
      skFileName: cleanFileName,
      skFileSizeBytes: cleanSize,
      skFileUrl: cleanFileUrl,
      skBlobPath: cleanBlobPath || submission.skBlobPath || "",
      lastUpdated: formatTimestamp(),
      timeline: [
        ...submission.timeline,
        {
          date: timestamp.date,
          time: timestamp.time,
          actor,
          phase: "PERSETUJUAN",
          description: "Dokumen SK PB UMKU diperbarui.",
          type: "info",
        },
      ],
    };
  });
};
