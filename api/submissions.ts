import { requireAdminSession } from "./_lib/auth.js";
import { readJsonBody, sendError, sendJson, setCommonHeaders } from "./_lib/http.js";
import { listSubmissions, upsertSubmission } from "./_lib/repository.js";
import { createSubmission } from "./_lib/submission-service.js";

export default async function handler(req, res) {
  setCommonHeaders(res);

  try {
    if (req.method === "GET") {
      const submissions = await listSubmissions();
      return sendJson(res, 200, {
        submissions,
      });
    }

    if (req.method === "POST") {
      const session = requireAdminSession(req, res);
      if (!session) return;

      const payload = readJsonBody(req);
      const submissions = await listSubmissions();
      const nextSubmissions = createSubmission(submissions, payload, session.email);
      const createdSubmission = nextSubmissions[0];

      if (!createdSubmission) {
        return sendError(res, 400, "Permohonan baru gagal dibuat.");
      }

      await upsertSubmission(createdSubmission);
      return sendJson(res, 201, {
        submission: createdSubmission,
      });
    }

    return sendError(res, 405, "Metode tidak didukung.");
  } catch (error) {
    return sendError(res, 500, "Gagal memproses permintaan submissions.", error instanceof Error ? error.message : undefined);
  }
}
