import { requireAdminSession } from "../_lib/auth.js";
import { uploadPdfToBlob } from "../_lib/blob.js";
import { readJsonBody, sendError, sendJson, setCommonHeaders } from "../_lib/http.js";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export default async function handler(req, res) {
  setCommonHeaders(res);

  if (req.method !== "POST") {
    return sendError(res, 405, "Metode tidak didukung.");
  }

  const session = requireAdminSession(req, res);
  if (!session) return;

  const {
    folder = "uploads",
    fileName = "",
    contentType = "application/pdf",
    dataBase64 = "",
  } = readJsonBody(req);

  if (!String(fileName).toLowerCase().endsWith(".pdf")) {
    return sendError(res, 400, "File harus berformat PDF.");
  }

  if (!dataBase64 || typeof dataBase64 !== "string") {
    return sendError(res, 400, "Konten file tidak ditemukan.");
  }

  try {
    const result = await uploadPdfToBlob({
      folder: String(folder).trim() || "uploads",
      fileName: String(fileName),
      contentType: String(contentType || "application/pdf"),
      dataBase64,
    });

    if (result.size > MAX_FILE_SIZE_BYTES) {
      return sendError(res, 400, "Ukuran file melebihi batas maksimum 5 MB.");
    }

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
