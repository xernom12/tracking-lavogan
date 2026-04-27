import { clearAdminSessionCookie, verifyAdminSessionToken, getAdminSessionToken } from "../_lib/auth.js";
import { writeAuditLog } from "../_lib/audit.js";
import { sendError, sendJson, setCommonHeaders } from "../_lib/http.js";

export default async function handler(req, res) {
  setCommonHeaders(res);

  if (req.method !== "POST") {
    return sendError(res, 405, "Metode tidak didukung.");
  }

  const session = verifyAdminSessionToken(getAdminSessionToken(req));
  clearAdminSessionCookie(res);
  if (session) {
    await writeAuditLog(req, {
      actor: session.email,
      action: "admin.logout",
      targetType: "admin_session",
    });
  }

  return sendJson(res, 200, {
    ok: true,
  });
}
