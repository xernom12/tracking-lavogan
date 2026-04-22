export type DocumentStatus = "approved" | "revision_required" | "locked";
export type StageStatus = "completed" | "active" | "locked";
export type DisplayStatusType = "completed" | "active" | "revision" | "pending";
export type WorkflowPhase = "PENGAJUAN" | "VERIFIKASI" | "PENINJAUAN" | "PERSETUJUAN" | "IZIN_TERBIT";
export type DecisionStatus = "approved" | "revision_required";
export type SubmissionType = "Baru" | "Perpanjangan";
export type DocumentUploadPhase = "VERIFIKASI" | "PENINJAUAN";
export type LicenseStatus = "Aktif" | "Tidak Aktif";

export interface SessionEntry {
  documentNumber: number;
  documentName: string;
  status: DecisionStatus;
  note?: string;
  date: string;
  time: string;
}

export interface DocumentHistoryEntry {
  date: string;
  time: string;
  status: DocumentStatus;
  note?: string;
}

export interface DocumentUploadEntry {
  fileName: string;
  fileSizeBytes: number;
  date: string;
  time: string;
  phase: DocumentUploadPhase;
  fileUrl?: string;
  blobPath?: string;
}

export interface Document {
  name: string;
  status: DocumentStatus;
  note?: string;
  history?: DocumentHistoryEntry[];
  uploads?: DocumentUploadEntry[];
}

export interface Stage {
  label: string;
  status: StageStatus;
}

export interface TimelineEvent {
  date: string;
  time: string;
  description: string;
  actor?: string;
  phase?: WorkflowPhase;
  sessionNumber?: number;
  sessionEntries?: SessionEntry[];
  documentNumber?: number;
  decisionStatus?: DecisionStatus;
  note?: string;
  reviewCycle?: number;
  type: "info" | "warning" | "success" | "error";
}

export interface RevisionCarryoverMeta {
  fromReviewCycle: number;
  worklistDocNumbers: number[];
  carriedAt: string;
}

export interface SubmissionData {
  submissionNumber: string;
  submissionType: SubmissionType;
  organizationName: string;
  nib: string;
  kbli: string;
  ossStatus: string;
  lastUpdated: string;
  pengajuanConfirmed: boolean;
  verificationCompleted: boolean;
  pengajuanDate: string;
  documents: Document[];
  reviewNotes: string;
  reviewCompleted: boolean;
  approvalCompleted: boolean;
  approvalDate: string;
  licenseIssued: boolean;
  licenseStatus: LicenseStatus | "";
  licenseNumber: string;
  licenseDate: string;
  skFileName: string;
  skFileSizeBytes: number;
  skFileUrl?: string;
  skBlobPath?: string;
  reviewCycle: number;
  reviewDocuments: Document[];
  verificationWorklistDocNumbers: number[];
  lastRevisionCarryover?: RevisionCarryoverMeta;
  timeline: TimelineEvent[];
}

export const STAGE_LABELS = [
  "Pengajuan",
  "Verifikasi Dokumen",
  "Peninjauan",
  "Persetujuan",
  "Izin Terbit",
];

const PHASE_LABELS: Record<WorkflowPhase, string> = {
  PENGAJUAN: "Pengajuan",
  VERIFIKASI: "Verifikasi Dokumen",
  PENINJAUAN: "Peninjauan",
  PERSETUJUAN: "Persetujuan",
  IZIN_TERBIT: "Izin Terbit",
};

export function getWorkflowPhaseLabel(phase: WorkflowPhase): string {
  return PHASE_LABELS[phase];
}

export function getDecisionStatusLabel(status: DecisionStatus): string {
  if (status === "approved") return "Sesuai Persyaratan";
  return "Memerlukan Perbaikan";
}

export function getDocumentStatusLabel(status: DocumentStatus): string {
  if (status === "approved") return "Sesuai Persyaratan";
  if (status === "revision_required") return "Memerlukan Perbaikan";
  return "Belum Diproses";
}

export function normalizePbUmkuNumber(value: string): string {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

export function hasApprovalDraftReadyForIssuance(data: Pick<SubmissionData, "approvalCompleted" | "approvalDate" | "licenseNumber" | "skFileName" | "skFileSizeBytes">): boolean {
  return Boolean(
    data.approvalCompleted
      && data.approvalDate.trim()
      && normalizePbUmkuNumber(data.licenseNumber)
      && data.skFileName.trim().toLowerCase().endsWith(".pdf")
      && data.skFileSizeBytes > 0,
  );
}

export function deriveStages(data: SubmissionData): Stage[] {
  const stages: Stage[] = STAGE_LABELS.map((label) => ({ label, status: "locked" as StageStatus }));

  if (!data.pengajuanConfirmed) {
    stages[0].status = "active";
    return stages;
  }
  stages[0].status = "completed";

  if (!data.verificationCompleted) {
    stages[1].status = "active";
    return stages;
  }
  stages[1].status = "completed";

  if (!data.reviewCompleted) {
    stages[2].status = "active";
    return stages;
  }
  stages[2].status = "completed";

  if (!data.approvalCompleted) {
    stages[3].status = "active";
    return stages;
  }
  stages[3].status = "completed";

  if (!data.licenseIssued) {
    stages[4].status = "active";
    return stages;
  }
  stages[4].status = "completed";

  return stages;
}

export function deriveDisplayStatus(data: SubmissionData): { label: string; type: DisplayStatusType } {
  const stages = deriveStages(data);
  if (stages.every((s) => s.status === "completed")) return { label: "Izin Terbit", type: "completed" };
  const hasVerificationRevision = data.documents.some((d) => d.status === "revision_required");
  if (hasVerificationRevision && stages[1].status === "active") {
    return { label: "Memerlukan Perbaikan", type: "revision" };
  }
  const hasReviewRevision = data.reviewDocuments.some((d) => d.status === "revision_required");
  if (hasReviewRevision && stages[2].status === "active") {
    return { label: "Memerlukan Perbaikan", type: "revision" };
  }
  const active = stages.find((s) => s.status === "active");
  if (active) return { label: active.label, type: "active" };
  return { label: "Menunggu Proses", type: "pending" };
}

export function deriveLicenseStatusLabel(data: SubmissionData): string {
  if (data.licenseIssued) {
    return data.licenseStatus || "-";
  }

  if (data.approvalCompleted) {
    return "Menunggu Penetapan";
  }

  return "-";
}

export function getActiveStageIndex(data: SubmissionData): number {
  const stages = deriveStages(data);
  const idx = stages.findIndex((s) => s.status === "active");
  return idx >= 0 ? idx : stages.length - 1;
}

export function ensureWibTime(value: string): string {
  const normalized = value.trim();
  if (!normalized || normalized === "-") return "-";
  if (/\bWIB\b/i.test(normalized)) {
    return normalized.replace(/\bwib\b/i, "WIB");
  }
  return `${normalized} WIB`;
}

export function ensureWibTimestamp(value: string): string {
  const normalized = value.trim();
  if (!normalized) return "-";

  const [datePart] = normalized.split(",");
  return datePart?.trim() || normalized;
}

export function formatTimestamp(): string {
  const now = new Date();
  return now.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

export function formatTimelineNow(): { date: string; time: string } {
  const now = new Date();
  return {
    date: now.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }),
    time: "-",
  };
}

export function getLatestDocumentUpload(
  doc: Document,
  phase?: DocumentUploadPhase
): DocumentUploadEntry | undefined {
  if (!Array.isArray(doc.uploads) || doc.uploads.length === 0) return undefined;

  for (let i = doc.uploads.length - 1; i >= 0; i -= 1) {
    const entry = doc.uploads[i];
    if (!phase || entry.phase === phase) {
      return entry;
    }
  }

  return undefined;
}

export function hasUploadedRevisionAfterLatestRequest(
  timeline: TimelineEvent[],
  documentNumber: number,
  phase: DocumentUploadPhase
): boolean {
  let latestRevisionIndex = -1;
  let latestUploadIndex = -1;

  timeline.forEach((event, index) => {
    if (event.phase !== phase || event.documentNumber !== documentNumber) return;

    if (event.decisionStatus === "revision_required") {
      latestRevisionIndex = index;
      return;
    }

    if (event.actor === "Pemohon" && event.type === "info") {
      latestUploadIndex = index;
    }
  });

  return latestRevisionIndex >= 0 && latestUploadIndex > latestRevisionIndex;
}
