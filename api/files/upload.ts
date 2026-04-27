import { requireAdminSession } from "../_lib/auth.js";
import { writeAuditLog } from "../_lib/audit.js";
import { uploadPdfToBlob } from "../_lib/blob.js";
import { readJsonBody, sendError, sendJson, setCommonHeaders } from "../_lib/http.js";
import { verifyPublicRevisionUploadToken } from "../_lib/public-action-token.js";
import { enforceRateLimit } from "../_lib/rate-limit.js";
import { sendValidationError, uploadFileSchema } from "../_lib/validation.js";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export default async function handler(req, res) {
  setCommonHeaders(res);

  if (req.method !== "POST") {
    return sendError(res, 405, "Metode tidak didukung.");
  }

  const parsedBody = uploadFileSchema.safeParse(readJsonBody(req));
  if (!parsedBody.success) {
    return sendValidationError(res, parsedBody.error);
  }

  const {
    folder,
    fileName,
    contentType,
    dataBase64,
    publicActionToken,
    documentNumber,
  } = parsedBody.data;

  const normalizedFolder = String(folder).trim() || "uploads";
  const isPublicRevisionUpload = normalizedFolder.startsWith("revision/");
  if (!enforceRateLimit(req, res, {
    key: isPublicRevisionUpload ? "public-file-upload" : "admin-file-upload",
    limit: isPublicRevisionUpload ? 20 : 60,
    windowMs: 60 * 1000,
  })) return;

  const session = isPublicRevisionUpload ? { email: "Pemohon" } : requireAdminSession(req, res);
  if (!session) return;

  if (isPublicRevisionUpload) {
    const [, submissionId = "", phaseSegment = ""] = normalizedFolder.split("/");
    const phase = phaseSegment.toUpperCase();
    if (!submissionId || (phase !== "VERIFIKASI" && phase !== "PENINJAUAN")) {
      return sendError(res, 400, "Folder unggah dokumen perbaikan tidak valid.");
    }

    const isValidPublicToken = verifyPublicRevisionUploadToken(publicActionToken, {
      submissionId,
      phase,
      documentNumber: Number(documentNumber),
    });

    if (!isValidPublicToken) {
      return sendError(res, 401, "Token unggah dokumen perbaikan tidak valid atau sudah kedaluwarsa.");
    }
  }

  if (!fileName.toLowerCase().endsWith(".pdf")) {
    return sendError(res, 400, "File harus berformat PDF.");
  }

  try {
    const result = await uploadPdfToBlob({
      folder: normalizedFolder,
      fileName,
      contentType,
      dataBase64,
    });

    if (result.size > MAX_FILE_SIZE_BYTES) {
      return sendError(res, 400, "Ukuran file melebihi batas maksimum 5 MB.");
    }

    await writeAuditLog(req, {
      actor: session.email,
      action: isPublicRevisionUpload ? "file.upload.revision" : "file.upload.admin",
      targetType: "file",
      targetId: result.pathname,
      metadata: {
        folder: normalizedFolder,
        fileName,
        size: result.size,
        contentType,
      },
    });

    return sendJson(res, 200, {
      url: result.url,
      pathname: result.pathname,
      size: result.size,
      uploadedBy: session.email,
    });
  } catch (error) {
    return sendError(res, 500, "Gagal mengunggah file ke storage.", error instanceof Error ? error.message : undefined);
  }
}
