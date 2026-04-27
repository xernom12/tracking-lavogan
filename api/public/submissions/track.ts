import { sendError, sendJson, setCommonHeaders } from "../../_lib/http.js";
import { projectPublicSubmission } from "../../_lib/public-submission.js";
import { enforceRateLimit } from "../../_lib/rate-limit.js";
import { listSubmissions } from "../../_lib/repository.js";
import { findSubmissionBySubmissionNumber } from "../../../src/lib/submission-domain.js";

export default async function handler(req, res) {
  setCommonHeaders(res);

  if (req.method !== "GET") {
    return sendError(res, 405, "Metode tidak didukung.");
  }

  if (!enforceRateLimit(req, res, {
    key: "public-submissions-track",
    limit: 60,
    windowMs: 60 * 1000,
  })) return;

  const submissionNumber = String(req.query.number || "").trim();
  if (!submissionNumber) {
    return sendError(res, 400, "Nomor permohonan wajib diisi.");
  }

  try {
    const submissions = await listSubmissions();
    const submission = findSubmissionBySubmissionNumber(submissions, submissionNumber);

    if (!submission) {
      return sendError(res, 404, "Nomor permohonan tidak ditemukan.");
    }

    return sendJson(res, 200, {
      submission: projectPublicSubmission(submission, { includeProcessDetails: true }),
    });
  } catch (error) {
    return sendError(res, 500, "Gagal melacak permohonan.", error instanceof Error ? error.message : undefined);
  }
}
