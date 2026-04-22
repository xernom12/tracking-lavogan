import { requireAdminSession } from "../_lib/auth.js";
import { readJsonBody, sendError, sendJson, setCommonHeaders } from "../_lib/http.js";
import {
  deleteSubmissionById,
  getSubmissionById,
  listSubmissions,
  upsertSubmission,
} from "../_lib/repository.js";
import { removeSubmission, updateSubmission } from "../_lib/submission-service.js";

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
      const session = requireAdminSession(req, res);
      if (!session) return;

      const payload = readJsonBody(req);
      const submissions = await listSubmissions();
      const nextSubmissions = updateSubmission(submissions, id, payload);
      const updatedSubmission = nextSubmissions.find((submission) => submission.id === id);
      if (!updatedSubmission) return sendError(res, 404, "Submission tidak ditemukan.");

      await upsertSubmission(updatedSubmission);
      return sendJson(res, 200, { submission: updatedSubmission, updatedBy: session.email });
    }

    if (req.method === "DELETE") {
      const session = requireAdminSession(req, res);
      if (!session) return;

      const submissions = await listSubmissions();
      const nextSubmissions = removeSubmission(submissions, id);
      if (nextSubmissions.length === submissions.length) {
        return sendError(res, 404, "Submission tidak ditemukan.");
      }

      await deleteSubmissionById(id);
      return sendJson(res, 200, { ok: true, deletedBy: session.email });
    }

    return sendError(res, 405, "Metode tidak didukung.");
  } catch (error) {
    return sendError(res, 500, "Gagal memproses submission.", error instanceof Error ? error.message : undefined);
  }
}
