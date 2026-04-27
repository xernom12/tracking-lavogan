import { requireAdminSession } from "../../_lib/auth.js";
import { writeAuditLog } from "../../_lib/audit.js";
import { readJsonBody, sendError, sendJson, setCommonHeaders } from "../../_lib/http.js";
import { verifyPublicRevisionUploadToken } from "../../_lib/public-action-token.js";
import { projectPublicSubmission } from "../../_lib/public-submission.js";
import { enforceRateLimit } from "../../_lib/rate-limit.js";
import { listSubmissions, upsertSubmission } from "../../_lib/repository.js";
import { applySubmissionAction } from "../../_lib/submission-service.js";
import { sendValidationError, submissionActionSchema } from "../../_lib/validation.js";

const getId = (req) => String(req.query.id || "").trim();

export default async function handler(req, res) {
  setCommonHeaders(res);

  if (req.method !== "POST") {
    return sendError(res, 405, "Metode tidak didukung.");
  }

  const id = getId(req);
  if (!id) {
    return sendError(res, 400, "ID submission tidak valid.");
  }

  const parsedBody = submissionActionSchema.safeParse(readJsonBody(req));
  if (!parsedBody.success) {
    return sendValidationError(res, parsedBody.error);
  }

  const { type, payload } = parsedBody.data;
  const isPublicAction = type === "uploadRevisionDocument";
  if (!enforceRateLimit(req, res, {
    key: isPublicAction ? "public-submission-action" : "admin-submission-action",
    limit: isPublicAction ? 30 : 120,
    windowMs: 60 * 1000,
  })) return;

  if (isPublicAction) {
    const isValidPublicToken = verifyPublicRevisionUploadToken(
      payload.input.publicActionToken,
      {
        submissionId: id,
        phase: payload.phase,
        documentNumber: payload.documentNumber,
      },
    );

    if (!isValidPublicToken) {
      return sendError(res, 401, "Token aksi dokumen perbaikan tidak valid atau sudah kedaluwarsa.");
    }
  }

  const session = isPublicAction ? { email: "Pemohon" } : requireAdminSession(req, res);
  if (!session) return;

  try {
    const submissions = await listSubmissions();
    const actionPayload = type === "confirmPengajuan" ? undefined : payload;
    const nextSubmissions = applySubmissionAction(submissions, id, type, actionPayload, session.email);
    const updatedSubmission = nextSubmissions.find((submission) => submission.id === id);

    if (!updatedSubmission) {
      return sendError(res, 404, "Submission tidak ditemukan.");
    }

    await upsertSubmission(updatedSubmission);
    await writeAuditLog(req, {
      actor: session.email,
      action: `submission.action.${type}`,
      targetType: "submission",
      targetId: id,
      metadata: {
        submissionNumber: updatedSubmission.submissionNumber,
        phase: typeof payload === "object" && payload && "phase" in payload ? payload.phase : undefined,
        documentNumber: typeof payload === "object" && payload && "documentNumber" in payload ? payload.documentNumber : undefined,
      },
    });
    return sendJson(res, 200, {
      submission: isPublicAction
        ? projectPublicSubmission(updatedSubmission, { includeProcessDetails: true })
        : updatedSubmission,
      actionType: type,
      updatedBy: session.email,
    });
  } catch (error) {
    return sendError(res, 500, "Gagal menjalankan aksi submission.", error instanceof Error ? error.message : undefined);
  }
}
