import { z } from "zod";
import type { ApiResponseLike } from "./http.js";
import { sendError } from "./http.js";

const optionalTrimmedString = z.string().trim().optional();

const requiredTrimmedString = (message: string) => z.string().trim().min(1, message);

const positiveFileSize = z.coerce.number().finite().positive();

export const adminLoginSchema = z.object({
  email: requiredTrimmedString("Email wajib diisi.").email("Format email tidak valid."),
  password: requiredTrimmedString("Password wajib diisi."),
});

export const submissionInputSchema = z.object({
  id: optionalTrimmedString,
  submissionNumber: requiredTrimmedString("Nomor permohonan wajib diisi."),
  submissionType: z.enum(["Baru", "Perpanjangan"]),
  organizationName: requiredTrimmedString("Nama perusahaan/LPK wajib diisi."),
  kbli: requiredTrimmedString("KBLI wajib diisi."),
  nib: requiredTrimmedString("NIB wajib diisi."),
  pengajuanDate: requiredTrimmedString("Tanggal pengajuan wajib diisi."),
});

const sessionDecisionSchema = z.object({
  status: z.enum(["approved", "revision_required"]),
  note: optionalTrimmedString,
});

const revisionUploadInputSchema = z.object({
  fileName: requiredTrimmedString("Nama file wajib diisi."),
  fileSizeBytes: positiveFileSize,
  fileUrl: optionalTrimmedString,
  blobPath: optionalTrimmedString,
  publicActionToken: optionalTrimmedString,
});

const approvalFinalizeSchema = z.object({
  approvalDate: requiredTrimmedString("Tanggal persetujuan wajib diisi."),
  pbUmkuNumber: requiredTrimmedString("Nomor izin PB UMKU wajib diisi."),
  skFileName: requiredTrimmedString("Nama file SK wajib diisi."),
  skFileSizeBytes: positiveFileSize,
  skFileUrl: optionalTrimmedString,
  skBlobPath: optionalTrimmedString,
});

const licenseIssuanceSchema = z.object({
  status: z.enum(["Aktif", "Tidak Aktif"]),
});

export const submissionActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("confirmPengajuan"),
    payload: z.unknown().optional(),
  }),
  z.object({
    type: z.literal("uploadRevisionDocument"),
    payload: z.object({
      phase: z.enum(["VERIFIKASI", "PENINJAUAN"]),
      documentNumber: z.coerce.number().int().min(1),
      input: revisionUploadInputSchema,
    }),
  }),
  z.object({
    type: z.literal("submitVerificationSession"),
    payload: z.object({
      decisions: z.array(sessionDecisionSchema).min(1),
    }),
  }),
  z.object({
    type: z.literal("submitReviewSession"),
    payload: z.object({
      decisions: z.array(sessionDecisionSchema).min(1),
    }),
  }),
  z.object({
    type: z.literal("finalizeApproval"),
    payload: approvalFinalizeSchema,
  }),
  z.object({
    type: z.literal("issueLicense"),
    payload: licenseIssuanceSchema,
  }),
]);

export const uploadFileSchema = z.object({
  folder: optionalTrimmedString.default("uploads"),
  fileName: requiredTrimmedString("Nama file wajib diisi."),
  contentType: optionalTrimmedString.default("application/pdf"),
  dataBase64: requiredTrimmedString("Konten file wajib diisi."),
  publicActionToken: optionalTrimmedString.default(""),
  documentNumber: z.coerce.number().int().min(0).default(0),
});

export const sendValidationError = (
  res: ApiResponseLike,
  error: z.ZodError,
) => sendError(res, 400, "Payload permintaan tidak valid.", error.issues.map((issue) => ({
  path: issue.path.join("."),
  message: issue.message,
})));
