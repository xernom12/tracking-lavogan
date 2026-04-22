import {
  createAdminSessionToken,
  isAdminAuthConfigured,
  validateAdminCredentials,
} from "../_lib/auth.js";
import { readJsonBody, sendError, sendJson, setCommonHeaders } from "../_lib/http.js";

export default async function handler(req, res) {
  setCommonHeaders(res);

  if (req.method !== "POST") {
    return sendError(res, 405, "Metode tidak didukung.");
  }

  if (!isAdminAuthConfigured()) {
    return sendError(res, 500, "Konfigurasi admin backend belum lengkap.");
  }

  const { email = "", password = "" } = readJsonBody(req);
  if (!validateAdminCredentials(email, password)) {
    return sendError(res, 401, "Email atau password admin tidak valid.");
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  return sendJson(res, 200, {
    authenticated: true,
    token: createAdminSessionToken(normalizedEmail),
    email: normalizedEmail,
  });
}
