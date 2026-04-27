import { requireAdminSession } from "../_lib/auth.js";
import { writeAuditLog } from "../_lib/audit.js";
import { readJsonBody, sendError, sendJson, setCommonHeaders } from "../_lib/http.js";
import { enforceRateLimit } from "../_lib/rate-limit.js";
import {
  deleteSubmissionById,
  getSubmissionById,
  listSubmissions,
  upsertSubmission,
} from "../_lib/repository.js";
import { removeSubmission, updateSubmission } from "../_lib/submission-service.js";
import { sendValidationError, submissionInputSchema } from "../_lib/validation.js";

const getId = (req) => String(req.query.id || "").trim();

export default async function handler(req, res) {
  setCommonHeaders(res);

  const id = getId(req);
  if (!id) {
    return sendError(res, 400, "ID submission tidak valid.");
  }

  try {
    if (req.method === "GET") {
      const submission = await getSubmissionById(id);
      if (!submission) return sendError(res, 404, "Submission tidak ditemukan.");
      return sendJson(res, 200, { submission });
    }

    if (req.method === "PATCH") {
      if (!enforceRateLimit(req, res, {
        key: "admin-submission-update",
        limit: 90,
        windowMs: 60 * 1000,
      })) return;

      const session = requireAdminSession(req, res);
      if (!session) return;

      const parsedBody = submissionInputSchema.safeParse(readJsonBody(req));
      if (!parsedBody.success) {
        return sendValidationError(res, parsedBody.error);
      }

      const payload = parsedBody.data;
      const submissions = await listSubmissions();
      const nextSubmissions = updateSubmission(submissions, id, payload);
      const updatedSubmission = nextSubmissions.find((submission) => submission.id === id);
      if (!updatedSubmission) return sendError(res, 404, "Submission tidak ditemukan.");

      await upsertSubmission(updatedSubmission);
      await writeAuditLog(req, {
        actor: session.email,
        action: "submission.update",
        targetType: "submission",
        targetId: updatedSubmission.id,
        metadata: {
          submissionNumber: updatedSubmission.submissionNumber,
        },
      });
      return sendJson(res, 200, { submission: updatedSubmission, updatedBy: session.email });
    }

    if (req.method === "DELETE") {
      if (!enforceRateLimit(req, res, {
        key: "admin-submission-delete",
        limit: 30,
        windowMs: 60 * 1000,
      })) return;

      const session = requireAdminSession(req, res);
      if (!session) return;

      const submissions = await listSubmissions();
      const deletedSubmission = submissions.find((submission) => submission.id === id);
      const nextSubmissions = removeSubmission(submissions, id);
      if (nextSubmissions.length === submissions.length) {
        return sendError(res, 404, "Submission tidak ditemukan.");
      }

      await deleteSubmissionById(id);
      await writeAuditLog(req, {
        actor: session.email,
        action: "submission.delete",
        targetType: "submission",
        targetId: id,
        metadata: {
          submissionNumber: deletedSubmission?.submissionNumber || "",
        },
      });
      return sendJson(res, 200, { ok: true, deletedBy: session.email });
    }

    return sendError(res, 405, "Metode tidak didukung.");
  } catch (error) {
    return sendError(res, 500, "Gagal memproses submission.", error instanceof Error ? error.message : undefined);
  }
}
