import { requireAdminSession } from "../../_lib/auth.js";
import { readJsonBody, sendError, sendJson, setCommonHeaders } from "../../_lib/http.js";
import { listSubmissions, upsertSubmission } from "../../_lib/repository.js";
import { applySubmissionAction } from "../../_lib/submission-service.js";

const getId = (req) => String(req.query.id || "").trim();

export default async function handler(req, res) {
  setCommonHeaders(res);

  if (req.method !== "POST") {
    return sendError(res, 405, "Metode tidak didukung.");
  }

  const session = requireAdminSession(req, res);
  if (!session) return;

  const id = getId(req);
  if (!id) {
    return sendError(res, 400, "ID submission tidak valid.");
  }

  const { type = "", payload = {} } = readJsonBody(req);
  if (!type) {
    return sendError(res, 400, "Tipe aksi wajib diisi.");
  }

  try {
    const submissions = await listSubmissions();
    const nextSubmissions = applySubmissionAction(submissions, id, String(type), payload, session.email);
    const updatedSubmission = nextSubmissions.find((submission) => submission.id === id);

    if (!updatedSubmission) {
      return sendError(res, 404, "Submission tidak ditemukan.");
    }

    await upsertSubmission(updatedSubmission);
    return sendJson(res, 200, {
      submission: updatedSubmission,
      actionType: type,
      updatedBy: session.email,
    });
  } catch (error) {
    return sendError(res, 500, "Gagal menjalankan aksi submission.", error instanceof Error ? error.message : undefined);
  }
}
