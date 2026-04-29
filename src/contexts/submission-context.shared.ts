import { createContext } from "react";
import type { DocumentUploadPhase } from "@/data/mockData";
import type {
  AdminSubmission,
  ApprovalFinalizeInput,
  LicenseIssuanceInput,
  NewSubmissionInput,
  RevisionUploadInput,
  SessionDecisionInput,
} from "@/lib/submission-types";

export interface SubmissionContextType {
  submissions: AdminSubmission[];
  getSubmission: (id: string) => AdminSubmission | undefined;
  findBySubmissionNumber: (num: string) => AdminSubmission | undefined | Promise<AdminSubmission | undefined>;
  addSubmission: (input: NewSubmissionInput) => void;
  updatePengajuanData: (id: string, input: NewSubmissionInput) => void;
  deleteSubmission: (id: string) => void;
  confirmPengajuan: (id: string) => void;
  uploadRevisionDocument: (
    id: string,
    phase: DocumentUploadPhase,
    documentNumber: number,
    input: RevisionUploadInput,
  ) => Promise<boolean>;
  submitVerificationSession: (id: string, decisions: SessionDecisionInput[]) => void;
  submitReviewSession: (id: string, decisions: SessionDecisionInput[]) => void;
  finalizeApproval: (id: string, input: ApprovalFinalizeInput) => Promise<boolean>;
  issueLicense: (id: string, input: LicenseIssuanceInput) => Promise<boolean>;
}

export const SubmissionContext = createContext<SubmissionContextType | null>(null);
