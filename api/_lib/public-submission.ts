import type {
  AdminSubmission,
} from "../../src/lib/submission-types.js";
import type {
  Document,
  DocumentUploadPhase,
  TimelineEvent,
} from "../../src/data/mockData.js";
import { createPublicRevisionUploadToken } from "./public-action-token.js";

const redactDocument = (
  submissionId: string,
  phase: DocumentUploadPhase,
  document: Document,
  documentNumber: number,
): Document => ({
  name: document.name,
  status: document.status,
  note: document.note,
  history: document.history,
  uploads: (document.uploads || []).map((upload) => ({
    fileName: upload.fileName,
    fileSizeBytes: upload.fileSizeBytes,
    date: upload.date,
    time: upload.time,
    phase: upload.phase,
    fileUrl: upload.fileUrl,
  })),
  publicUploadToken: document.status === "revision_required"
    ? createPublicRevisionUploadToken({
      submissionId,
      phase,
      documentNumber,
    })
    : undefined,
});

const redactTimelineEvent = (event: TimelineEvent): TimelineEvent => ({
  date: event.date,
  time: event.time,
  description: event.description,
  actor: event.actor,
  phase: event.phase,
  sessionNumber: event.sessionNumber,
  sessionEntries: event.sessionEntries,
  documentNumber: event.documentNumber,
  decisionStatus: event.decisionStatus,
  note: event.note,
  reviewCycle: event.reviewCycle,
  type: event.type,
});

export const projectPublicSubmission = (
  submission: AdminSubmission,
  options: { includeProcessDetails?: boolean } = {},
): AdminSubmission => {
  const includeProcessDetails = Boolean(options.includeProcessDetails);

  return {
    id: submission.id,
    submissionNumber: submission.submissionNumber,
    submissionType: submission.submissionType,
    organizationName: submission.organizationName,
    nib: submission.nib,
    kbli: submission.kbli,
    ossStatus: submission.ossStatus,
    lastUpdated: submission.lastUpdated,
    pengajuanConfirmed: submission.pengajuanConfirmed,
    verificationCompleted: submission.verificationCompleted,
    pengajuanDate: submission.pengajuanDate,
    documents: includeProcessDetails
      ? submission.documents.map((document, index) =>
        redactDocument(submission.id, "VERIFIKASI", document, index + 1))
      : [],
    reviewNotes: "",
    reviewCompleted: submission.reviewCompleted,
    approvalCompleted: submission.approvalCompleted,
    approvalDate: submission.approvalDate,
    licenseIssued: submission.licenseIssued,
    licenseStatus: submission.licenseStatus,
    licenseNumber: submission.licenseNumber,
    licenseDate: submission.licenseDate,
    skFileName: submission.skFileName,
    skFileSizeBytes: submission.skFileSizeBytes,
    skFileUrl: submission.skFileUrl,
    skBlobPath: "",
    reviewCycle: submission.reviewCycle,
    reviewDocuments: includeProcessDetails
      ? submission.reviewDocuments.map((document, index) =>
        redactDocument(submission.id, "PENINJAUAN", document, index + 1))
      : [],
    verificationWorklistDocNumbers: [],
    lastRevisionCarryover: undefined,
    timeline: includeProcessDetails ? submission.timeline.map(redactTimelineEvent) : [],
  };
};

export const projectPublicSubmissionList = (submissions: AdminSubmission[]) =>
  submissions
    .filter((submission) => submission.licenseIssued)
    .map((submission) => projectPublicSubmission(submission));
