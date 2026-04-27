import {
  createAdminSessionToken,
  isAdminRegistrationAllowed,
  setAdminSessionCookie,
  validateAdminRegistrationCode,
} from "../_lib/auth.js";
import { createAdminAccount, findAdminByEmail, normalizeAdminEmail } from "../_lib/admin-repository.js";
import { writeAuditLog } from "../_lib/audit.js";
import { isDatabaseConfigured } from "../_lib/db.js";
import { readJsonBody, sendError, sendJson, setCommonHeaders } from "../_lib/http.js";
import { enforceRateLimit } from "../_lib/rate-limit.js";
import { adminRegisterSchema, sendValidationError } from "../_lib/validation.js";

export default async function handler(req, res) {
  setCommonHeaders(res);

  if (req.method !== "POST") {
    return sendError(res, 405, "Metode tidak didukung.");
  }

  if (!enforceRateLimit(req, res, {
    key: "admin-register",
    limit: 5,
    windowMs: 60 * 1000,
  })) return;

  if (!isDatabaseConfigured()) {
    return sendError(res, 500, "Database admin belum dikonfigurasi.");
  }

  if (!(await isAdminRegistrationAllowed())) {
    return sendError(res, 403, "Pendaftaran admin belum diaktifkan.");
  }

  const parsedBody = adminRegisterSchema.safeParse(readJsonBody(req));
  if (!parsedBody.success) {
    return sendValidationError(res, parsedBody.error);
  }

  const { email, password, fullName, registrationCode } = parsedBody.data;
  const normalizedEmail = normalizeAdminEmail(email);

  if (!(await validateAdminRegistrationCode(registrationCode))) {
    await writeAuditLog(req, {
      actor: normalizedEmail,
      action: "admin.register.denied",
      targetType: "admin_account",
    });
    return sendError(res, 403, "Kode pendaftaran tidak valid.");
  }

  if (await findAdminByEmail(normalizedEmail)) {
    return sendError(res, 409, "Email admin sudah terdaftar.");
  }

  const admin = await createAdminAccount({
    email: normalizedEmail,
    password,
    fullName,
  });

  const token = createAdminSessionToken(normalizedEmail);
  setAdminSessionCookie(res, token);
  await writeAuditLog(req, {
    actor: normalizedEmail,
    action: "admin.register.success",
    targetType: "admin_account",
    targetId: admin.id,
  });

  return sendJson(res, 201, {
    authenticated: true,
    email: normalizedEmail,
    fullName: admin.fullName || fullName,
  });
}
