import {
  confirmPengajuanSubmission,
  createSubmissionRecord,
  deleteSubmissionRecord,
  finalizeApprovalSubmission,
  issueLicenseSubmission,
  replaceIssuedSkFileSubmission,
  submitReviewSubmissionSession,
  submitVerificationSubmissionSession,
  updatePengajuanSubmission,
  uploadRevisionSubmissionDocument,
} from "../../src/lib/submission-operations.js";
import type {
  AdminSubmission,
  ApprovalFinalizeInput,
  IssuedSkFileUpdateInput,
  LicenseIssuanceInput,
  NewSubmissionInput,
  RevisionUploadInput,
  SessionDecisionInput,
} from "../../src/lib/submission-types.js";

export const createSubmission = (
  submissions: AdminSubmission[],
  input: NewSubmissionInput,
  actor: string,
) => createSubmissionRecord(submissions, input, actor);

export const updateSubmission = (
  submissions: AdminSubmission[],
  id: string,
  input: NewSubmissionInput,
) => updatePengajuanSubmission(submissions, id, input);

export const removeSubmission = (
  submissions: AdminSubmission[],
  id: string,
) => deleteSubmissionRecord(submissions, id);

export const applySubmissionAction = (
  submissions: AdminSubmission[],
  id: string,
  type: string,
  payload: unknown,
  actor: string,
) => {
  switch (type) {
    case "confirmPengajuan":
      return confirmPengajuanSubmission(submissions, id, actor);
    case "uploadRevisionDocument": {
      const typedPayload = payload as {
        phase: "VERIFIKASI" | "PENINJAUAN";
        documentNumber: number;
        input: RevisionUploadInput;
      };
      return uploadRevisionSubmissionDocument(
        submissions,
        id,
        typedPayload.phase,
        typedPayload.documentNumber,
        typedPayload.input,
      );
    }
    case "submitVerificationSession":
      return submitVerificationSubmissionSession(
        submissions,
        id,
        (payload as { decisions: SessionDecisionInput[] }).decisions,
        actor,
      );
    case "submitReviewSession":
      return submitReviewSubmissionSession(
        submissions,
        id,
        (payload as { decisions: SessionDecisionInput[] }).decisions,
        actor,
      );
    case "finalizeApproval":
      return finalizeApprovalSubmission(submissions, id, payload as ApprovalFinalizeInput, actor);
    case "issueLicense":
      return issueLicenseSubmission(submissions, id, payload as LicenseIssuanceInput, actor);
    case "replaceIssuedSkFile":
      return replaceIssuedSkFileSubmission(submissions, id, payload as IssuedSkFileUpdateInput, actor);
    default:
      return submissions;
  }
};
