import { getAdminSessionToken, isAdminAuthConfigured, verifyAdminSessionToken } from "../_lib/auth.js";
import { sendError, sendJson, setCommonHeaders } from "../_lib/http.js";

export default async function handler(req, res) {
  setCommonHeaders(res);

  if (req.method !== "GET") {
    return sendError(res, 405, "Metode tidak didukung.");
  }

  if (!isAdminAuthConfigured()) {
    return sendError(res, 500, "Konfigurasi admin backend belum lengkap.");
  }

  const session = verifyAdminSessionToken(getAdminSessionToken(req));
  if (!session) {
    return sendError(res, 401, "Sesi admin tidak valid atau sudah kedaluwarsa.");
  }

  return sendJson(res, 200, {
    authenticated: true,
    email: session.email,
    expiresAt: session.expiresAt,
  });
}
