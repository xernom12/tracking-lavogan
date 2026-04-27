import { requireAdminSession } from "./_lib/auth.js";
import { writeAuditLog } from "./_lib/audit.js";
import { readJsonBody, sendError, sendJson, setCommonHeaders } from "./_lib/http.js";
import { enforceRateLimit } from "./_lib/rate-limit.js";
import { listSubmissions, upsertSubmission } from "./_lib/repository.js";
import { createSubmission } from "./_lib/submission-service.js";
import { sendValidationError, submissionInputSchema } from "./_lib/validation.js";
import type { NewSubmissionInput } from "../src/lib/submission-types.js";

export default async function handler(req, res) {
  setCommonHeaders(res);

  try {
    if (req.method === "GET") {
      const session = requireAdminSession(req, res);
      if (!session) return;

      const submissions = await listSubmissions();
      return sendJson(res, 200, {
        submissions,
        requestedBy: session.email,
      });
    }

    if (req.method === "POST") {
      if (!enforceRateLimit(req, res, {
        key: "admin-submission-create",
        limit: 60,
        windowMs: 60 * 1000,
      })) return;

      const session = requireAdminSession(req, res);
      if (!session) return;

      const parsedBody = submissionInputSchema.safeParse(readJsonBody(req));
      if (!parsedBody.success) {
        return sendValidationError(res, parsedBody.error);
      }

      const payload = parsedBody.data as NewSubmissionInput;
      const submissions = await listSubmissions();
      const nextSubmissions = createSubmission(submissions, payload, session.email);
      const createdSubmission = nextSubmissions[0];

      if (!createdSubmission) {
        return sendError(res, 400, "Permohonan baru gagal dibuat.");
      }

      await upsertSubmission(createdSubmission);
      await writeAuditLog(req, {
        actor: session.email,
        action: "submission.create",
        targetType: "submission",
        targetId: createdSubmission.id,
        metadata: {
          submissionNumber: createdSubmission.submissionNumber,
        },
      });
      return sendJson(res, 201, {
        submission: createdSubmission,
      });
    }

    return sendError(res, 405, "Metode tidak didukung.");
  } catch (error) {
    return sendError(res, 500, "Gagal memproses permintaan submissions.", error instanceof Error ? error.message : undefined);
  }
}
