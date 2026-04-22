import type { DecisionStatus, LicenseStatus, SubmissionData, SubmissionType } from "../data/mockData.js";

const DEFAULT_SUBMISSION_TYPE: SubmissionType = "Baru";

export const normalizeNib = (val: unknown): string => {
  if (typeof val !== "string") return "";
  return val.replace(/\s+/g, "").trim();
};

export const formatDecisionDescription = (docName: string, status: DecisionStatus, note?: string) => {
  if (status === "approved") {
    return `Dokumen ${docName} dinyatakan sesuai persyaratan.`;
  }

  return `Dokumen ${docName} memerlukan perbaikan${note ? `: ${note}` : "."}`;
};

export const formatSessionSummaryDescription = (
  phase: "VERIFIKASI" | "PENINJAUAN",
  sessionNumber: number,
  hasRevision: boolean,
) => {
  const phaseLabel = phase === "VERIFIKASI" ? "verifikasi" : "peninjauan";
  const currentStageLabel = phase === "VERIFIKASI" ? "Verifikasi Dokumen" : "Peninjauan Dokumen";
  const nextStageLabel = phase === "VERIFIKASI" ? "Peninjauan Dokumen" : "Persetujuan";

  if (hasRevision) {
    return `Sesi ${phaseLabel} #${sessionNumber} disimpan. Terdapat dokumen yang memerlukan perbaikan, tahapan tetap pada ${currentStageLabel}.`;
  }

  return `Sesi ${phaseLabel} #${sessionNumber} disimpan. Seluruh dokumen sesuai persyaratan, proses dilanjutkan ke ${nextStageLabel}.`;
};

export const normalizeSubmissionType = (value: string | undefined): SubmissionType => {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "baru") return "Baru";
  if (normalized === "perpanjangan") return "Perpanjangan";
  if (normalized === "perubahan") return "Perpanjangan";
  return DEFAULT_SUBMISSION_TYPE;
};

export const normalizeLicenseStatus = (value: string | undefined, licenseIssued = false): LicenseStatus | "" => {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "aktif") return "Aktif";
  if (normalized === "tidak aktif") return "Tidak Aktif";
  return licenseIssued ? "Aktif" : "";
};

export const normalizeTrackingToken = (value: string): string =>
  value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

export const findSubmissionBySubmissionNumber = <T extends Pick<SubmissionData, "submissionNumber">>(
  list: T[],
  num: string,
): T | undefined => {
  const normalizedQuery = normalizeTrackingToken(num);
  if (!normalizedQuery) return undefined;

  return list.find((submission) => normalizeTrackingToken(submission.submissionNumber) === normalizedQuery);
};

export const getCurrentActor = (storageKey: string): string => {
  if (typeof window === "undefined") return "Admin";
  const raw = window.localStorage.getItem(storageKey)?.trim();
  return raw || "Admin";
};
