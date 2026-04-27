import { sendError, sendJson, setCommonHeaders } from "../_lib/http.js";
import { projectPublicSubmissionList } from "../_lib/public-submission.js";
import { enforceRateLimit } from "../_lib/rate-limit.js";
import { listSubmissions } from "../_lib/repository.js";

export default async function handler(req, res) {
  setCommonHeaders(res);

  if (req.method !== "GET") {
    return sendError(res, 405, "Metode tidak didukung.");
  }

  if (!enforceRateLimit(req, res, {
    key: "public-submissions-list",
    limit: 120,
    windowMs: 60 * 1000,
  })) return;

  try {
    const submissions = await listSubmissions();
    return sendJson(res, 200, {
      submissions: projectPublicSubmissionList(submissions),
    });
  } catch (error) {
    return sendError(res, 500, "Gagal mengambil daftar izin publik.", error instanceof Error ? error.message : undefined);
  }
}
