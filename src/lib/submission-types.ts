import type {
  DocumentUploadPhase,
  LicenseStatus,
  SubmissionData,
  SubmissionType,
  DecisionStatus,
} from "../data/mockData.js";

export interface AdminSubmission extends SubmissionData {
  id: string;
}

export interface NewSubmissionInput {
  id?: string;
  submissionNumber: string;
  submissionType: SubmissionType;
  organizationName: string;
  kbli: string;
  nib: string;
  pengajuanDate: string;
}

export interface SessionDecisionInput {
  status: DecisionStatus;
  note?: string;
}

export interface ApprovalFinalizeInput {
  approvalDate: string;
  pbUmkuNumber: string;
  skFileName: string;
  skFileSizeBytes: number;
  skFileUrl?: string;
  skBlobPath?: string;
  file?: File | null;
}

export interface IssuedSkFileUpdateInput {
  skFileName: string;
  skFileSizeBytes: number;
  skFileUrl: string;
  skBlobPath?: string;
}

export interface LicenseIssuanceInput {
  status: LicenseStatus;
}

export interface RevisionUploadInput {
  fileName: string;
  fileSizeBytes: number;
  fileUrl?: string;
  blobPath?: string;
  file?: File | null;
  publicActionToken?: string;
}

export interface SubmissionActionPayloadMap {
  updatePengajuanData: NewSubmissionInput;
  confirmPengajuan: undefined;
  uploadRevisionDocument: {
    phase: DocumentUploadPhase;
    documentNumber: number;
    input: RevisionUploadInput;
  };
  submitVerificationSession: {
    decisions: SessionDecisionInput[];
  };
  submitReviewSession: {
    decisions: SessionDecisionInput[];
  };
  finalizeApproval: ApprovalFinalizeInput;
  issueLicense: LicenseIssuanceInput;
}
