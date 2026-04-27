import {
  createAdminSessionToken,
  isAdminAuthConfigured,
  setAdminSessionCookie,
  validateAdminCredentials,
} from "../_lib/auth.js";
import { writeAuditLog } from "../_lib/audit.js";
import { readJsonBody, sendError, sendJson, setCommonHeaders } from "../_lib/http.js";
import { enforceRateLimit } from "../_lib/rate-limit.js";
import { adminLoginSchema, sendValidationError } from "../_lib/validation.js";

export default async function handler(req, res) {
  setCommonHeaders(res);

  if (req.method !== "POST") {
    return sendError(res, 405, "Metode tidak didukung.");
  }

  if (!enforceRateLimit(req, res, {
    key: "admin-login",
    limit: 8,
    windowMs: 60 * 1000,
  })) return;

  if (!isAdminAuthConfigured()) {
    return sendError(res, 500, "Konfigurasi admin backend belum lengkap.");
  }

  const parsedBody = adminLoginSchema.safeParse(readJsonBody(req));
  if (!parsedBody.success) {
    return sendValidationError(res, parsedBody.error);
  }

  const { email, password } = parsedBody.data;
  if (!validateAdminCredentials(email, password)) {
    await writeAuditLog(req, {
      actor: email,
      action: "admin.login.failed",
      targetType: "admin_session",
    });
    return sendError(res, 401, "Email atau password admin tidak valid.");
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const token = createAdminSessionToken(normalizedEmail);
  setAdminSessionCookie(res, token);
  await writeAuditLog(req, {
    actor: normalizedEmail,
    action: "admin.login.success",
    targetType: "admin_session",
  });

  return sendJson(res, 200, {
    authenticated: true,
    email: normalizedEmail,
  });
}
