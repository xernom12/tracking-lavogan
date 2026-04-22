import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Lock, AlertTriangle, History, Pencil, Upload, Clock, Eye, Trash2, CloudUpload, Download, FileText, Save } from "lucide-react";
import {
  type AdminSubmission,
  type ApprovalFinalizeInput,
  type LicenseIssuanceInput,
  type NewSubmissionInput,
  type SessionDecisionInput,
} from "@/contexts/SubmissionContext";
import { useSubmissions } from "@/contexts/useSubmissions";
import type {
  LicenseStatus,
  Stage,
} from "@/data/mockData";
import {
  getLatestDocumentUpload,
  hasApprovalDraftReadyForIssuance,
  hasUploadedRevisionAfterLatestRequest,
  getDecisionStatusLabel,
  getDocumentStatusLabel,
  normalizePbUmkuNumber,
} from "@/data/mockData";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import FlowConfirmDialog from "@/components/FlowConfirmDialog";
import {
  buildMetadataPreviewHref,
  downloadFileFromHref,
  formatBytes,
  openPreviewWindow,
} from "@/lib/file-preview";
import { scrollWindowToTop } from "@/lib/scroll";
import { KBLI_OPTIONS, getKbliOptionLabel, normalizeKbliCode } from "@/data/kbliOptions";
import { toast } from "sonner";

interface StageDetailAdminProps {
  submission: AdminSubmission;
  stageIndex: number;
  stages: Stage[];
}

type DraftStatus = "" | "approved" | "revision_required";
type HistoryPhase = "VERIFIKASI" | "PENINJAUAN";
type SubmissionFormErrors = Partial<Record<keyof NewSubmissionInput, string>>;
type SessionDrafts = Record<number, { status: DraftStatus; note: string }>;

const SESSION_DRAFT_STORAGE_KEY = "tracking-os-session-drafts";

const isSubmissionType = (value: string): value is NewSubmissionInput["submissionType"] =>
  value === "Baru" || value === "Perpanjangan";

const isLicenseStatus = (value: string): value is LicenseStatus =>
  value === "Aktif" || value === "Tidak Aktif";

const dialogFieldClassName = "app-form-field";
const dialogSelectClassName = "app-form-select";
const dialogFieldGroupClassName = "space-y-1.5";
const dialogLabelClassName = "app-field-label block";
const dialogErrorClassName = "text-xs font-medium text-status-revision";

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isDraftStatus = (value: unknown): value is DraftStatus =>
  value === "" || value === "approved" || value === "revision_required";

const buildSessionDraftStorageKey = (submissionId: string, phase: HistoryPhase, timelineLength: number) =>
  `${submissionId}:${phase}:${timelineLength}`;

const readSessionDraftStore = (): Record<string, unknown> => {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(SESSION_DRAFT_STORAGE_KEY);
    if (!raw) return {};

    const parsed: unknown = JSON.parse(raw);
    return isPlainRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const normalizeStoredSessionDrafts = (value: unknown, docsLength: number): SessionDrafts | null => {
  if (!isPlainRecord(value)) return null;

  const drafts = Object.entries(value).reduce<SessionDrafts>((acc, [indexKey, rawDraft]) => {
    const index = Number(indexKey);
    if (!Number.isInteger(index) || index < 0 || index >= docsLength || !isPlainRecord(rawDraft)) return acc;
    if (!isDraftStatus(rawDraft.status)) return acc;

    acc[index] = {
      status: rawDraft.status,
      note: typeof rawDraft.note === "string" ? rawDraft.note : "",
    };
    return acc;
  }, {});

  return Object.keys(drafts).length > 0 ? drafts : null;
};

const readStoredSessionDrafts = (
  submissionId: string,
  phase: HistoryPhase,
  timelineLength: number,
  docsLength: number,
): SessionDrafts | null => {
  const store = readSessionDraftStore();
  const key = buildSessionDraftStorageKey(submissionId, phase, timelineLength);
  return normalizeStoredSessionDrafts(store[key], docsLength);
};

const writeStoredSessionDrafts = (
  submissionId: string,
  phase: HistoryPhase,
  timelineLength: number,
  drafts: SessionDrafts,
): boolean => {
  if (typeof window === "undefined") return false;

  const key = buildSessionDraftStorageKey(submissionId, phase, timelineLength);
  const meaningfulDrafts = Object.entries(drafts).reduce<SessionDrafts>((acc, [indexKey, draft]) => {
    if (!draft.status && !draft.note.trim()) return acc;

    acc[Number(indexKey)] = {
      status: draft.status,
      note: draft.note,
    };
    return acc;
  }, {});

  try {
    const store = readSessionDraftStore();
    if (Object.keys(meaningfulDrafts).length > 0) {
      store[key] = meaningfulDrafts;
    } else {
      delete store[key];
    }

    if (Object.keys(store).length > 0) {
      window.localStorage.setItem(SESSION_DRAFT_STORAGE_KEY, JSON.stringify(store));
    } else {
      window.localStorage.removeItem(SESSION_DRAFT_STORAGE_KEY);
    }
  } catch {
    toast.error("Draft pemeriksaan gagal disimpan. Coba ulangi beberapa saat lagi.");
    return false;
  }

  return true;
};

const clearStoredSessionDraft = (submissionId: string, phase: HistoryPhase, timelineLength: number) => {
  if (typeof window === "undefined") return;

  const key = buildSessionDraftStorageKey(submissionId, phase, timelineLength);

  try {
    const store = readSessionDraftStore();
    delete store[key];

    if (Object.keys(store).length > 0) {
      window.localStorage.setItem(SESSION_DRAFT_STORAGE_KEY, JSON.stringify(store));
    } else {
      window.localStorage.removeItem(SESSION_DRAFT_STORAGE_KEY);
    }
  } catch {
    window.localStorage.removeItem(SESSION_DRAFT_STORAGE_KEY);
  }
};

const buildInitialSessionDrafts = (
  docs: AdminSubmission["documents"],
  editableSet: Set<number>,
): SessionDrafts =>
  docs.reduce<SessionDrafts>((acc, doc, idx) => {
    const docNumber = idx + 1;
    if (editableSet.has(docNumber)) {
      acc[idx] = { status: "", note: "" };
      return acc;
    }

    acc[idx] = {
      status: doc.status === "locked" ? "" : doc.status,
      note: doc.note || "",
    };
    return acc;
  }, {});

const DocumentStatusIcon = ({ status }: { status: "approved" | "revision_required" | "locked" | "empty" }) => {
  if (status === "approved") {
    return (
      <div title={getDocumentStatusLabel("approved")} className="w-8 h-8 rounded-full bg-status-completed-bg text-status-completed flex items-center justify-center shrink-0 border border-status-completed/20 shadow-sm">
        <Check className="w-4 h-4 stroke-[2.5]" />
      </div>
    );
  }
  if (status === "revision_required") {
    return (
      <div title={getDocumentStatusLabel("revision_required")} className="w-8 h-8 rounded-full bg-status-revision-bg text-status-revision flex items-center justify-center shrink-0 border border-status-revision/20 shadow-sm">
        <AlertTriangle className="w-4 h-4 stroke-[2.5]" />
      </div>
    );
  }
  if (status === "empty") {
    return (
      <div
        title="Status belum dipilih"
        className="w-8 h-8 rounded-full border border-slate-200 bg-slate-50 text-slate-400 flex items-center justify-center shrink-0 shadow-sm"
      >
        <Clock className="w-3.5 h-3.5 stroke-[2.2]" />
      </div>
    );
  }
  return (
    <div title={getDocumentStatusLabel("locked")} className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center shrink-0 border border-slate-200 shadow-sm">
      <Lock className="w-3.5 h-3.5 stroke-[2.5]" />
    </div>
  );
};

const getEditorDocumentAccentClasses = ({
  previousStatus,
  draftStatus,
}: {
  previousStatus: "approved" | "revision_required" | "locked";
  draftStatus: DraftStatus;
}) => {
  if (draftStatus === "approved") {
    return {
      cardClass: "border-status-completed bg-status-completed-bg/25 hover:border-status-completed/70",
      numberClass: "bg-status-completed/10 text-status-completed border-status-completed/20",
    };
  }

  const shouldHighlightRevision = draftStatus === "revision_required"
    || (previousStatus === "revision_required" && draftStatus === "");

  if (shouldHighlightRevision) {
    return {
      cardClass: "border-status-revision bg-status-revision-bg/25 hover:border-status-revision/70",
      numberClass: "bg-status-revision/10 text-status-revision border-status-revision/20",
    };
  }

  return {
    cardClass: "border-slate-200 bg-white hover:border-slate-300",
    numberClass: "bg-slate-100 text-slate-500 border-slate-200",
  };
};

const resolveDraftPreviewStatus = (
  previousStatus: "approved" | "revision_required" | "locked",
  draftStatus: DraftStatus,
): "approved" | "revision_required" | "empty" => {
  if (draftStatus === "approved" || draftStatus === "revision_required") return draftStatus;
  if (previousStatus === "revision_required") return "revision_required";
  return "empty";
};

const RevisionBadge = ({ status }: { status: "approved" | "revision_required" | "locked" }) => {
  if (status === "revision_required") {
    return (
      <span className="app-badge-sm app-badge-revision normal-case tracking-normal text-[11px] font-semibold">
        Memerlukan Perbaikan
      </span>
    );
  }

  return null;
};

const ReuploadReadyBadge = ({ visible }: { visible: boolean }) => {
  if (!visible) return null;

  return (
    <span className="app-badge-sm app-badge-neutral normal-case tracking-normal text-[11px] font-semibold">
      Siap Diperiksa Ulang
    </span>
  );
};

const monthMap: Record<string, number> = {
  januari: 0,
  februari: 1,
  maret: 2,
  april: 3,
  mei: 4,
  juni: 5,
  juli: 6,
  agustus: 7,
  september: 8,
  oktober: 9,
  november: 10,
  desember: 11,
};

const toDateInputValue = (value: string): string => {
  const normalized = value.trim();
  if (!normalized) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;

  const parts = normalized.split(" ");
  if (parts.length >= 3) {
    const day = Number(parts[0]);
    const month = monthMap[parts[1].toLowerCase()];
    const year = Number(parts[2]);
    if (!Number.isNaN(day) && month !== undefined && !Number.isNaN(year)) {
      const date = new Date(year, month, day);
      if (!Number.isNaN(date.getTime())) {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const dd = String(date.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
      }
    }
  }

  const fallback = new Date(normalized);
  if (Number.isNaN(fallback.getTime())) return "";
  const yyyy = fallback.getFullYear();
  const mm = String(fallback.getMonth() + 1).padStart(2, "0");
  const dd = String(fallback.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const formatDisplayDate = (value: string): string => {
  const normalized = value.trim();
  if (!normalized) return "-";

  const parsedDate = new Date(normalized);
  if (Number.isNaN(parsedDate.getTime())) return normalized;

  return parsedDate.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const openDateInputPicker = (input: HTMLInputElement & { showPicker?: () => void }) => {
  if (typeof input.showPicker !== "function") return;
  try {
    input.showPicker();
  } catch {
    // Some browsers block programmatic picker access outside direct user interaction.
  }
};

const StageDetailAdmin = ({ submission, stageIndex, stages }: StageDetailAdminProps) => {
  const stage = stages[stageIndex];
  const hasMountedRef = useRef(false);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    scrollWindowToTop();
  }, [submission.lastUpdated, submission.timeline.length, stageIndex]);

  if (stage.status === "locked") {
    return (
      <div className="app-surface-card-soft p-6 sm:p-10 text-center flex flex-col items-center">
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4 shadow-sm border border-white">
          <Lock className="w-8 h-8 text-slate-400" />
        </div>
        <p className="text-[14px] font-semibold text-slate-500">Tahapan ini terkunci</p>
        <p className="text-[12.5px] font-medium text-slate-400 mt-1">Selesaikan tahapan sebelumnya untuk mengakses informasi ini.</p>
      </div>
    );
  }

  if (stage.status === "completed") {
    if (stageIndex === 3 && !submission.licenseIssued) {
      return (
        <div className="space-y-6">
          <div className="app-surface-card p-5 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-5 sm:mb-6 pb-4 border-b border-slate-100">
              <h3 className="app-section-title text-lg sm:text-xl flex items-center gap-3">
                <span className="app-stage-icon">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                </span>
                {stage.label}
              </h3>
            </div>
            <PersetujuanAdmin submission={submission} />
          </div>
        </div>
      );
    }

    if (stageIndex === 1 || stageIndex === 2) {
      return (
        <div className="space-y-4">
          <SessionHistory submission={submission} phase={stageIndex === 1 ? "VERIFIKASI" : "PENINJAUAN"} />
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="app-surface-card-soft p-5 sm:p-8 space-y-5 sm:space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 pb-4 border-b border-slate-100">
            <h3 className="app-section-title text-lg sm:text-xl flex items-center gap-3">
              <span className="app-stage-icon">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
              </span>
              {stage.label}
            </h3>
          </div>
          {stageIndex === 0 && <PengajuanInfo submission={submission} />}
          {stageIndex === 3 && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <InfoRow label="Tanggal Persetujuan" value={submission.approvalDate} />
                <InfoRow label="Nomor Izin PB UMKU" value={submission.licenseNumber || "-"} />
              </div>
              <div className="space-y-1.5">
                <p className="app-info-label text-muted-foreground">
                  Izin PB UMKU
                </p>
	                {submission.skFileName ? (
	                  <FileAttachmentCard
	                    fileName={submission.skFileName}
	                    fileSizeBytes={submission.skFileSizeBytes}
	                    statusLabel="Terupload"
	                    fileUrl={submission.skFileUrl}
	                    onPreview={() => openPreviewWindow(submission.skFileUrl || buildMetadataPreviewHref({
	                      title: "Pratinjau Izin PB UMKU",
	                      fileName: submission.skFileName,
	                      fileSizeBytes: submission.skFileSizeBytes,
	                      extraLines: [
	                        `Nomor Izin PB UMKU: ${submission.licenseNumber || "-"}`,
	                        `Tanggal Persetujuan: ${submission.approvalDate || "-"}`,
	                      ],
	                    }))}
	                  />
                ) : (
                  <EmptyFileState />
                )}
              </div>
            </div>
          )}
          {stageIndex === 4 && <IzinTerbitView submission={submission} />}
        </div>
      </div>
    );
  }

  if (stageIndex === 1) {
    return (
      <div className="space-y-4">
        <SessionHistory submission={submission} phase="VERIFIKASI" />
        <VerifikasiAdmin submission={submission} />
      </div>
    );
  }

  if (stageIndex === 2) {
    return (
      <div className="space-y-4">
        <SessionHistory submission={submission} phase="PENINJAUAN" />
        <PeninjauanAdmin submission={submission} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="app-surface-card p-5 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-5 sm:mb-6 pb-4 border-b border-slate-100">
          <h3 className="app-section-title text-lg sm:text-xl flex items-center gap-3">
            <span className="app-stage-icon">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
            </span>
            {stage.label}
          </h3>
        </div>
        {stageIndex === 0 && <PengajuanAdmin submission={submission} />}
        {stageIndex === 1 && <VerifikasiAdmin submission={submission} />}
        {stageIndex === 3 && <PersetujuanAdmin submission={submission} />}
        {stageIndex === 4 && <IzinTerbitView submission={submission} />}
      </div>
    </div>
  );
};

const PengajuanAdmin = ({ submission }: { submission: AdminSubmission }) => {
  const { submissions, confirmPengajuan, updatePengajuanData } = useSubmissions();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [form, setForm] = useState<NewSubmissionInput>({
    pengajuanDate: toDateInputValue(submission.pengajuanDate),
    submissionNumber: submission.submissionNumber,
    organizationName: submission.organizationName,
    kbli: normalizeKbliCode(submission.kbli),
    submissionType: submission.submissionType,
    nib: submission.nib,
  });
  const [formErrors, setFormErrors] = useState<SubmissionFormErrors>({});

  useEffect(() => {
    setForm({
      pengajuanDate: toDateInputValue(submission.pengajuanDate),
      submissionNumber: submission.submissionNumber,
      organizationName: submission.organizationName,
      kbli: normalizeKbliCode(submission.kbli),
      submissionType: submission.submissionType,
      nib: submission.nib,
    });
    setFormErrors({});
  }, [submission.id, submission.pengajuanDate, submission.submissionNumber, submission.organizationName, submission.kbli, submission.submissionType, submission.nib]);

  const openEditDialog = () => {
    setForm({
      pengajuanDate: toDateInputValue(submission.pengajuanDate),
      submissionNumber: submission.submissionNumber,
      organizationName: submission.organizationName,
      kbli: normalizeKbliCode(submission.kbli),
      submissionType: submission.submissionType,
      nib: submission.nib,
    });
    setFormErrors({});
    setShowEditDialog(true);
  };

  const handleConfirm = () => {
    confirmPengajuan(submission.id);
    setIsConfirmDialogOpen(false);
    scrollWindowToTop();
    toast.success("Permohonan telah dikonfirmasi dan dilanjutkan ke tahap Verifikasi Dokumen.");
  };

  const validateForm = (): boolean => {
    const errors: SubmissionFormErrors = {};

    if (!form.pengajuanDate.trim()) errors.pengajuanDate = "Tanggal pengajuan wajib diisi.";
    if (!form.submissionNumber.trim()) errors.submissionNumber = "Nomor permohonan wajib diisi.";
    if (!form.organizationName.trim()) errors.organizationName = "Nama perusahaan/LPK wajib diisi.";
    if (!form.kbli.trim()) errors.kbli = "KBLI wajib dipilih.";
    if (!isSubmissionType(form.submissionType)) errors.submissionType = "Jenis permohonan wajib dipilih.";
    if (!form.nib.trim()) errors.nib = "NIB wajib diisi.";
    if (form.pengajuanDate.trim() && Number.isNaN(new Date(form.pengajuanDate).getTime())) {
      errors.pengajuanDate = "Tanggal pengajuan tidak valid.";
    }

    const duplicate = submissions.find(
      (s) => s.id !== submission.id && s.submissionNumber.toLowerCase() === form.submissionNumber.trim().toLowerCase(),
    );
    if (duplicate) errors.submissionNumber = "Nomor permohonan sudah digunakan.";

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const originalForm = useMemo(() => ({
    pengajuanDate: toDateInputValue(submission.pengajuanDate),
    submissionNumber: submission.submissionNumber.trim(),
    organizationName: submission.organizationName.trim(),
    kbli: normalizeKbliCode(submission.kbli),
    submissionType: submission.submissionType,
    nib: submission.nib.trim(),
  }), [submission.pengajuanDate, submission.submissionNumber, submission.organizationName, submission.kbli, submission.submissionType, submission.nib]);

  const hasFormChanges = form.pengajuanDate.trim() !== originalForm.pengajuanDate
    || form.submissionNumber.trim() !== originalForm.submissionNumber
    || form.organizationName.trim() !== originalForm.organizationName
    || form.kbli.trim() !== originalForm.kbli
    || form.submissionType !== originalForm.submissionType
    || form.nib.trim() !== originalForm.nib;

  const requestSaveEdit = () => {
    if (!hasFormChanges) return;
    handleSaveEdit();
  };

  const handleSaveEdit = () => {
    if (!validateForm()) return;

    const parsedDate = new Date(form.pengajuanDate);
    if (Number.isNaN(parsedDate.getTime())) {
      setFormErrors((prev) => ({ ...prev, pengajuanDate: "Tanggal pengajuan tidak valid." }));
      return;
    }

    const dateFormatted = parsedDate.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    updatePengajuanData(submission.id, {
      submissionNumber: form.submissionNumber.trim(),
      organizationName: form.organizationName.trim(),
      kbli: normalizeKbliCode(form.kbli),
      submissionType: form.submissionType,
      nib: form.nib.replace(/\s+/g, "").trim(),
      pengajuanDate: dateFormatted,
    });
    setShowEditDialog(false);
    toast.success("Data permohonan telah diperbarui.");
  };

  return (
    <div className="space-y-6">
      <PengajuanInfo submission={submission} />
      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 border-t border-slate-100 pt-5 sm:pt-6 mt-2">
        <button
          type="button"
          onClick={openEditDialog}
          title="Edit data permohonan"
          aria-label="Edit data permohonan"
          className="app-utility-button inline-flex h-11 w-full items-center justify-center rounded-xl text-slate-600 sm:w-11 sm:px-0"
        >
          <Pencil className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => setIsConfirmDialogOpen(true)}
          className="app-primary-button inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-6 text-sm font-semibold sm:w-auto"
        >
          <Check className="w-4 h-4 stroke-[3]" />
          Konfirmasi Pengajuan
        </button>
      </div>

      <Dialog
        open={showEditDialog}
        onOpenChange={(open) => {
          setShowEditDialog(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Edit data permohonan</DialogTitle>
            <DialogDescription>
              Perbarui data dasar permohonan sebelum proses dikonfirmasi.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className={dialogFieldGroupClassName}>
              <label htmlFor="edit-submission-date" className={dialogLabelClassName}>
                Tanggal pengajuan <span className="text-status-revision">*</span>
              </label>
              <input
                id="edit-submission-date"
                type="date"
                max={new Date().toLocaleDateString('en-CA')} // 'en-CA' gives YYYY-MM-DD
                value={form.pengajuanDate}
                onClick={(e) => {
                  openDateInputPicker(e.currentTarget);
                }}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val && val.split('-')[0].length > 4) return;
                  setForm((prev) => ({ ...prev, pengajuanDate: val }));
                  setFormErrors((prev) => ({ ...prev, pengajuanDate: undefined }));
                }}
                className={`${dialogFieldClassName} ${formErrors.pengajuanDate ? "border-status-revision focus:ring-status-revision/20" : ""} relative cursor-pointer`}
              />
              {formErrors.pengajuanDate ? (
                <p className={dialogErrorClassName}>{formErrors.pengajuanDate}</p>
              ) : null}
            </div>
            <div className={dialogFieldGroupClassName}>
              <label htmlFor="edit-submission-number" className={dialogLabelClassName}>
                Nomor permohonan <span className="text-status-revision">*</span>
              </label>
              <input
                id="edit-submission-number"
                type="text"
                value={form.submissionNumber}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, submissionNumber: e.target.value }));
                  setFormErrors((prev) => ({ ...prev, submissionNumber: undefined }));
                }}
                placeholder="Masukkan nomor permohonan"
                className={`${dialogFieldClassName} placeholder:text-muted-foreground ${formErrors.submissionNumber ? "border-status-revision focus:ring-status-revision/20" : ""}`}
              />
              {formErrors.submissionNumber ? (
                <p className={dialogErrorClassName}>{formErrors.submissionNumber}</p>
              ) : null}
            </div>
            <div className={dialogFieldGroupClassName}>
              <label htmlFor="edit-submission-organization" className={dialogLabelClassName}>
                Nama perusahaan/LPK <span className="text-status-revision">*</span>
              </label>
              <input
                id="edit-submission-organization"
                type="text"
                value={form.organizationName}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, organizationName: e.target.value }));
                  setFormErrors((prev) => ({ ...prev, organizationName: undefined }));
                }}
                placeholder="Masukkan nama perusahaan/LPK"
                className={`${dialogFieldClassName} placeholder:text-muted-foreground ${formErrors.organizationName ? "border-status-revision focus:ring-status-revision/20" : ""}`}
              />
              {formErrors.organizationName ? (
                <p className={dialogErrorClassName}>{formErrors.organizationName}</p>
              ) : null}
            </div>
            <div className={dialogFieldGroupClassName}>
              <label htmlFor="edit-submission-nib" className={dialogLabelClassName}>
                NIB <span className="text-status-revision">*</span>
              </label>
              <input
                id="edit-submission-nib"
                type="text"
                value={form.nib}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, nib: e.target.value }));
                  setFormErrors((prev) => ({ ...prev, nib: undefined }));
                }}
                placeholder="Masukkan NIB"
                className={`${dialogFieldClassName} placeholder:text-muted-foreground ${formErrors.nib ? "border-status-revision focus:ring-status-revision/20" : ""}`}
              />
              {formErrors.nib ? (
                <p className={dialogErrorClassName}>{formErrors.nib}</p>
              ) : null}
            </div>
            <div className={dialogFieldGroupClassName}>
              <label htmlFor="edit-submission-kbli" className={dialogLabelClassName}>
                KBLI <span className="text-status-revision">*</span>
              </label>
              <select
                id="edit-submission-kbli"
                value={form.kbli}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, kbli: e.target.value }));
                  setFormErrors((prev) => ({ ...prev, kbli: undefined }));
                }}
                className={`${dialogSelectClassName} ${!form.kbli ? "text-muted-foreground" : "text-foreground"} overflow-hidden text-ellipsis whitespace-nowrap ${formErrors.kbli ? "border-status-revision focus:ring-status-revision/20" : ""}`}
              >
                <option value="" disabled hidden>Pilih KBLI</option>
                {KBLI_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value} className="text-foreground">
                    {option.label}
                  </option>
                ))}
              </select>
              {formErrors.kbli ? (
                <p className={dialogErrorClassName}>{formErrors.kbli}</p>
              ) : null}
            </div>
            <div className={dialogFieldGroupClassName}>
              <label htmlFor="edit-submission-type" className={dialogLabelClassName}>
                Jenis permohonan <span className="text-status-revision">*</span>
              </label>
              <select
                id="edit-submission-type"
                value={form.submissionType}
                onChange={(e) => {
                  const nextSubmissionType = e.target.value;
                  setForm((prev) => ({
                    ...prev,
                    submissionType: isSubmissionType(nextSubmissionType) ? nextSubmissionType : "Baru",
                  }));
                  setFormErrors((prev) => ({ ...prev, submissionType: undefined }));
                }}
                className={`${dialogSelectClassName} ${!form.submissionType ? "text-muted-foreground" : "text-foreground"} ${formErrors.submissionType ? "border-status-revision focus:ring-status-revision/20" : ""}`}
              >
                <option value="Baru" className="text-foreground">Baru</option>
                <option value="Perpanjangan" className="text-foreground">Perpanjangan</option>
              </select>
              {formErrors.submissionType ? (
                <p className={dialogErrorClassName}>{formErrors.submissionType}</p>
              ) : null}
            </div>
          </div>
          <DialogFooter className="pt-1">
            <button
              type="button"
              onClick={() => setShowEditDialog(false)}
              className="app-secondary-button inline-flex h-11 w-full items-center justify-center rounded-xl px-4 text-sm font-medium sm:w-auto"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={requestSaveEdit}
              disabled={!hasFormChanges}
              className="app-primary-button inline-flex h-11 w-full items-center justify-center rounded-xl px-5 text-sm font-semibold sm:w-auto"
            >
              Simpan Perubahan
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FlowConfirmDialog
        open={isConfirmDialogOpen}
        onOpenChange={setIsConfirmDialogOpen}
        title="Lanjut ke Verifikasi Dokumen?"
        description="Permohonan akan dikonfirmasi dan proses akan dilanjutkan ke tahap Verifikasi Dokumen."
        confirmLabel="Ya, Konfirmasi & Lanjut"
        onConfirm={handleConfirm}
      />
    </div>
  );
};

const PengajuanInfo = ({ submission }: { submission: AdminSubmission }) => {
  return (
    <div className="space-y-4 mt-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div className="space-y-4">
          <InfoRow label="Nomor Permohonan" value={submission.submissionNumber} />
          <InfoRow label="NIB" value={submission.nib} />
          <InfoRow label="KBLI" value={getKbliOptionLabel(submission.kbli)} />
        </div>
        <div className="space-y-4">
          <InfoRow label="Nama Perusahaan/LPK" value={submission.organizationName} />
          <InfoRow label="Jenis Permohonan" value={submission.submissionType} />
          <InfoRow label="Tanggal Pengajuan" value={submission.pengajuanDate} />
        </div>
      </div>
    </div>
  );
};

const VerifikasiAdmin = ({ submission }: { submission: AdminSubmission }) => {
  const { submitVerificationSession } = useSubmissions();
  return (
    <SessionEditor
      submission={submission}
      docs={submission.documents}
      phase="VERIFIKASI"
      nextLabel="Lanjut"
      submit={submitVerificationSession}
      requireRevisionNote
    />
  );
};

const PeninjauanAdmin = ({ submission }: { submission: AdminSubmission }) => {
  const { submitReviewSession } = useSubmissions();
  return (
    <SessionEditor
      submission={submission}
      docs={submission.reviewDocuments}
      phase="PENINJAUAN"
      nextLabel="Lanjut"
      submit={submitReviewSession}
      requireRevisionNote={false}
    />
  );
};

const SessionEditor = ({
  submission,
  docs,
  phase,
  nextLabel,
  submit,
  requireRevisionNote,
}: {
  submission: AdminSubmission;
  docs: AdminSubmission["documents"];
  phase: HistoryPhase;
  nextLabel: string;
  submit: (id: string, decisions: SessionDecisionInput[]) => void;
  requireRevisionNote: boolean;
}) => {
  const [drafts, setDrafts] = useState<SessionDrafts>({});
	const [errors, setErrors] = useState<Record<number, boolean>>({});
	const [isConfirmOpen, setIsConfirmOpen] = useState(false);
	const [isDraftConfirmOpen, setIsDraftConfirmOpen] = useState(false);
	const [pendingDecisions, setPendingDecisions] = useState<SessionDecisionInput[] | null>(null);
  const draftResetKeyRef = useRef("");

  const editableDocNumbers = useMemo(
    () => docs.map((_, index) => index + 1),
    [docs],
  );
  const editableSet = useMemo(() => new Set(editableDocNumbers), [editableDocNumbers]);

  useEffect(() => {
    const nextDraftResetKey = `${submission.id}:${phase}:${submission.timeline.length}:${docs.length}`;
    if (draftResetKeyRef.current === nextDraftResetKey) return;
    draftResetKeyRef.current = nextDraftResetKey;

    const initialDrafts = buildInitialSessionDrafts(docs, editableSet);
    const storedDrafts = readStoredSessionDrafts(submission.id, phase, submission.timeline.length, docs.length);

    if (storedDrafts) {
      editableDocNumbers.forEach((docNumber) => {
        const index = docNumber - 1;
        const storedDraft = storedDrafts[index];
        if (storedDraft) initialDrafts[index] = storedDraft;
      });
    }

    setDrafts(initialDrafts);
    setErrors({});
  }, [docs, editableDocNumbers, editableSet, phase, submission.id, submission.timeline.length]);

  const allSelected = docs.every((_, idx) => {
    const docNumber = idx + 1;
    if (!editableSet.has(docNumber)) return true;
    return (drafts[idx]?.status || "") !== "";
  });
  const hasRevision = docs.some((doc, idx) => {
    const docNumber = idx + 1;
    if (!editableSet.has(docNumber)) return doc.status === "revision_required";
    return drafts[idx]?.status === "revision_required";
  });
  const pendingHasRevision = pendingDecisions?.some((decision) => decision.status === "revision_required") ?? false;
  const buttonLabel = hasRevision ? "Perlu Perbaikan" : nextLabel;
  const phaseLabel = phase === "VERIFIKASI" ? "Verifikasi Dokumen" : "Peninjauan Dokumen";
  const nextPhaseLabel = phase === "VERIFIKASI" ? "Peninjauan Dokumen" : "Persetujuan";
  const hasDraftContent = editableDocNumbers.some((docNumber) => {
    const draft = drafts[docNumber - 1];
    return Boolean(draft?.status || draft?.note.trim());
  });

  const handleConfirmSaveDraft = () => {
    if (!hasDraftContent) return;

    const isSaved = writeStoredSessionDrafts(submission.id, phase, submission.timeline.length, drafts);
    if (!isSaved) return;

    setIsDraftConfirmOpen(false);
    setErrors({});
    scrollWindowToTop();
    toast.success("Draft pemeriksaan telah disimpan.", {
      description: "Anda dapat melanjutkan pemeriksaan ini nanti sebelum sesi dikirim.",
    });
  };

  const prepareSubmitSession = () => {
    const nextErrors: Record<number, boolean> = {};
    const decisions: SessionDecisionInput[] = [];

    for (let i = 0; i < docs.length; i += 1) {
      const docNumber = i + 1;
      if (!editableSet.has(docNumber)) {
        decisions.push({
          status: docs[i].status === "revision_required" ? "revision_required" : "approved",
          note: docs[i].note?.trim() || undefined,
        });
        continue;
      }

      const draft = drafts[i];
      if (!draft?.status) {
        toast.error("Seluruh dokumen wajib diberikan keputusan terlebih dahulu.");
        return;
      }
      const cleanNote = draft.note.trim();
      if (requireRevisionNote && draft.status === "revision_required" && !cleanNote) nextErrors[i] = true;
      decisions.push({ status: draft.status, note: cleanNote || undefined });
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      toast.error(
        requireRevisionNote
          ? "Catatan perbaikan wajib diisi untuk setiap dokumen yang dinyatakan memerlukan perbaikan."
          : "Masih terdapat data dokumen yang belum lengkap.",
      );
      return;
    }

    setErrors({});
    setPendingDecisions(decisions);
    setIsConfirmOpen(true);
  };

  const submitSession = () => {
    if (!pendingDecisions) return;

    const nextHasRevision = pendingDecisions.some((decision) => decision.status === "revision_required");
    clearStoredSessionDraft(submission.id, phase, submission.timeline.length);
    submit(submission.id, pendingDecisions);
    setPendingDecisions(null);
    setIsConfirmOpen(false);
    scrollWindowToTop();
    toast.success(
      nextHasRevision
        ? `Hasil ${phase === "VERIFIKASI" ? "verifikasi dokumen" : "peninjauan dokumen"} telah disimpan. Terdapat dokumen yang memerlukan perbaikan.`
        : `Hasil ${phase === "VERIFIKASI" ? "verifikasi dokumen" : "peninjauan dokumen"} telah disimpan dan proses dilanjutkan ke tahapan berikutnya.`,
    );
  };

  return (
    <div className="space-y-6">
      <div className="app-surface-panel-soft rounded-[1.5rem] p-4 sm:p-8 space-y-5 sm:space-y-6 relative overflow-hidden">
        {/* Dekoratif */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/10 to-transparent rounded-bl-full pointer-events-none" />

        <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
          <div className="app-complete-icon">
            <Check className="w-5 h-5 stroke-[3]" />
          </div>
          <h4 className="app-section-title text-lg">
            {phase === "VERIFIKASI" ? "Verifikasi Dokumen" : "Peninjauan Dokumen"}
          </h4>
        </div>

        <div className="space-y-2">
          {docs.map((doc, idx) => {
            const draft = drafts[idx] || { status: "", note: "" };
            const latestUpload = getLatestDocumentUpload(doc, phase);
            const isAwaitingAdminReview = doc.status === "revision_required"
              && hasUploadedRevisionAfterLatestRequest(submission.timeline, idx + 1, phase);
            const isEditable = editableSet.has(idx + 1);
            const isStatusEmpty = isEditable && !draft.status;
            const isNoteRequired = isEditable
              && draft.status === "revision_required"
              && (requireRevisionNote || isAwaitingAdminReview);
            const isNoteEmpty = !draft.note.trim();
            const shouldHighlightNote = errors[idx] || (isNoteRequired && isNoteEmpty);
            const editorAccent = getEditorDocumentAccentClasses({
              previousStatus: doc.status,
              draftStatus: draft.status,
            });
            const previewStatus = resolveDraftPreviewStatus(doc.status, draft.status);
            return (
              <div
                key={doc.name}
                data-testid={`session-editor-doc-${idx + 1}`}
                className={`rounded-[1.25rem] border px-3.5 py-4 shadow-sm space-y-3 transition-all sm:px-4 ${editorAccent.cardClass}`}
              >
                <div className="flex items-center gap-3 w-full text-left">
                  <span className={`w-8 h-8 rounded-xl font-bold text-xs flex items-center justify-center shrink-0 border ${editorAccent.numberClass}`}>
                    {idx + 1}
                  </span>
                  <p className="text-[15px] font-bold text-slate-700 flex-1 min-w-0 flex flex-wrap items-center gap-2" title={doc.name}>
                    <span className="truncate">{doc.name}</span>
                    <RevisionBadge status={doc.status} />
                    <ReuploadReadyBadge visible={isAwaitingAdminReview} />
                  </p>
                  <DocumentStatusIcon status={previewStatus} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <select
                    value={draft.status}
                    onChange={(e) => {
                      const nextStatus = e.target.value as DraftStatus;
                      setDrafts((prev) => ({ ...prev, [idx]: { ...draft, status: nextStatus } }));
                      if (nextStatus !== "revision_required") {
                        setErrors((prev) => ({ ...prev, [idx]: false }));
                      }
                    }}
                    style={{ color: isStatusEmpty ? "hsl(var(--muted-foreground))" : "hsl(var(--foreground))" }}
                    className={`app-form-select md:col-span-4 h-10 px-3 text-[13px] ${!draft.status ? "text-muted-foreground" : "text-foreground"}`}
                  >
                    <option value="" disabled hidden>Pilih status dokumen</option>
                    <option value="approved" style={{ color: "hsl(var(--foreground))" }}>Sesuai Persyaratan</option>
                    <option value="revision_required" style={{ color: "hsl(var(--foreground))" }}>Memerlukan Perbaikan</option>
                  </select>
                  <input
                    value={draft.note}
                    onChange={(e) => {
                      setDrafts((prev) => ({ ...prev, [idx]: { ...draft, note: e.target.value } }));
                      if (e.target.value.trim()) setErrors((prev) => ({ ...prev, [idx]: false }));
                    }}
                    placeholder={isNoteRequired ? "Tulis catatan perbaikan" : "Tulis catatan bila perlu"}
                    className={`app-form-field md:col-span-8 h-10 px-3 text-[13px] ${shouldHighlightNote ? "app-form-field-error" : ""}`}
                  />
                </div>
                {draft.status === "revision_required" ? (
                  <p className={`text-[11px] ${isNoteEmpty ? "text-status-revision" : "text-status-revision/80"}`}>
                    Catatan perbaikan wajib diisi.
                  </p>
                ) : null}
                {latestUpload ? (
                  <p className="text-[11px] text-muted-foreground">
                    {isAwaitingAdminReview ? "Dokumen perbaikan terbaru sudah diunggah" : "Unggahan dokumen perbaikan terakhir"}: {latestUpload.fileName} ({formatBytes(latestUpload.fileSizeBytes)}) pada {latestUpload.date}, {latestUpload.time}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="pt-6 mt-4 border-t border-slate-200/60 relative z-10">
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              disabled={!hasDraftContent}
              onClick={() => setIsDraftConfirmOpen(true)}
              className="app-secondary-button inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold sm:w-auto sm:min-w-[160px]"
            >
              <Save className="h-4 w-4 stroke-[2.5]" />
              Simpan Draft
            </button>
            <button
              type="button"
              disabled={!allSelected}
              onClick={prepareSubmitSession}
              className={`inline-flex h-11 w-full items-center justify-center rounded-xl px-6 text-sm font-semibold sm:w-auto sm:min-w-[200px] ${hasRevision ? "app-danger-button" : "app-primary-button"}`}
            >
              {buttonLabel}
            </button>
          </div>
        </div>
      </div>

      <FlowConfirmDialog
        open={isDraftConfirmOpen}
        onOpenChange={setIsDraftConfirmOpen}
        title="Simpan Draft Pemeriksaan?"
        description={`Draft ${phaseLabel.toLowerCase()} akan disimpan sementara. Anda dapat melanjutkan pemeriksaan ini nanti sebelum sesi dikirim.`}
        confirmLabel="Ya, Simpan Draft"
        confirmVariant="primary"
        onConfirm={handleConfirmSaveDraft}
      />

      <FlowConfirmDialog
        open={isConfirmOpen}
        onOpenChange={(open) => {
          setIsConfirmOpen(open);
          if (!open) setPendingDecisions(null);
        }}
        title={pendingHasRevision
          ? `Simpan ${phaseLabel} dengan Permintaan Perbaikan?`
          : `Lanjut ke Tahapan ${nextPhaseLabel}?`}
        description={pendingHasRevision
          ? `Hasil ${phaseLabel.toLowerCase()} akan disimpan. Proses tetap berada pada tahapan ${phaseLabel}.`
          : `Hasil ${phaseLabel.toLowerCase()} akan disimpan dan proses akan dilanjutkan ke tahapan ${nextPhaseLabel}.`}
        confirmLabel={pendingHasRevision ? "Ya, Simpan Perbaikan" : "Ya, Simpan & Lanjut"}
        confirmVariant={pendingHasRevision ? "danger" : "primary"}
        onConfirm={submitSession}
      />
    </div>
  );
};

const PersetujuanAdmin = ({ submission }: { submission: AdminSubmission }) => {
  const { finalizeApproval, submissions } = useSubmissions();
  const [form, setForm] = useState<ApprovalFinalizeInput>({
    approvalDate: toDateInputValue(submission.approvalDate || ""),
    pbUmkuNumber: submission.licenseNumber || "",
    skFileName: submission.skFileName || "",
    skFileSizeBytes: submission.skFileSizeBytes || 0,
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<ApprovalFinalizeInput | null>(null);
  const [errors, setErrors] = useState<{
    approvalDate?: string;
    pbUmkuNumber?: string;
    skFile?: string;
  }>({});
  const currentFileName = selectedFile?.name || form.skFileName;
  const currentFileSize = selectedFile?.size || form.skFileSizeBytes || 0;
  const selectedFilePreviewUrl = useMemo(
    () => (selectedFile && typeof URL.createObjectURL === "function" ? URL.createObjectURL(selectedFile) : ""),
    [selectedFile],
  );
  const currentPreviewHref = selectedFilePreviewUrl || submission.skFileUrl || (
    currentFileName
      ? buildMetadataPreviewHref({
        title: "Pratinjau Izin PB UMKU",
        fileName: currentFileName,
        fileSizeBytes: currentFileSize,
        extraLines: [
          `Tanggal Persetujuan: ${formatDisplayDate(form.approvalDate)}`,
          `Nomor Izin PB UMKU: ${form.pbUmkuNumber.trim() || "-"}`,
        ],
      })
      : ""
  );

  useEffect(() => {
    setForm({
      approvalDate: toDateInputValue(submission.approvalDate || ""),
      pbUmkuNumber: submission.licenseNumber || "",
      skFileName: submission.skFileName || "",
      skFileSizeBytes: submission.skFileSizeBytes || 0,
    });
    setSelectedFile(null);
    setErrors({});
  }, [submission.id, submission.approvalDate, submission.licenseNumber, submission.skFileName, submission.skFileSizeBytes]);

  useEffect(() => {
    if (!selectedFilePreviewUrl) return undefined;
    return () => {
      URL.revokeObjectURL(selectedFilePreviewUrl);
    };
  }, [selectedFilePreviewUrl]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      return;
    }

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setSelectedFile(null);
      setErrors((prev) => ({ ...prev, skFile: "Izin PB UMKU wajib berformat PDF." }));
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setSelectedFile(null);
      setErrors((prev) => ({ ...prev, skFile: "Ukuran Izin PB UMKU maksimal 5 MB." }));
      event.target.value = "";
      return;
    }

    setErrors((prev) => ({ ...prev, skFile: undefined }));
    setSelectedFile(file);
  };

  const validate = () => {
    const nextErrors: {
      approvalDate?: string;
      pbUmkuNumber?: string;
      skFile?: string;
    } = {};

    const parsedApprovalDate = new Date(form.approvalDate);
    if (!form.approvalDate.trim() || Number.isNaN(parsedApprovalDate.getTime())) {
      nextErrors.approvalDate = "Tanggal persetujuan wajib diisi dan valid.";
    }

    const cleanNumber = normalizePbUmkuNumber(form.pbUmkuNumber);
    if (!cleanNumber) {
      nextErrors.pbUmkuNumber = "Nomor Izin PB UMKU wajib diisi.";
    } else {
      const duplicate = submissions.find(
        (item) => item.id !== submission.id && normalizePbUmkuNumber(item.licenseNumber || "") === cleanNumber,
      );
      if (duplicate) {
        nextErrors.pbUmkuNumber = "Nomor Izin PB UMKU sudah digunakan.";
      }
    }

    if (!selectedFile && !form.skFileName.trim()) {
      nextErrors.skFile = "Izin PB UMKU wajib diunggah.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    const parsedApprovalDate = new Date(form.approvalDate);
    if (Number.isNaN(parsedApprovalDate.getTime())) return;

    const formattedApprovalDate = parsedApprovalDate.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const payload: ApprovalFinalizeInput = {
      approvalDate: formattedApprovalDate,
      pbUmkuNumber: normalizePbUmkuNumber(form.pbUmkuNumber),
      skFileName: selectedFile?.name || form.skFileName || "",
      skFileSizeBytes: selectedFile?.size || form.skFileSizeBytes || 0,
      skFileUrl: submission.skFileUrl || "",
      skBlobPath: submission.skBlobPath || "",
      file: selectedFile,
    };

    setPendingPayload(payload);
    setIsConfirmDialogOpen(true);
  };

  const handleOpenFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handlePreviewFile = () => {
    if (!currentPreviewHref) return;
    openPreviewWindow(currentPreviewHref);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setForm((prev) => ({ ...prev, skFileName: "", skFileSizeBytes: 0 }));
    setErrors((prev) => ({ ...prev, skFile: undefined }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleConfirmApproval = () => {
    if (!pendingPayload) return;
    finalizeApproval(submission.id, pendingPayload);
    setPendingPayload(null);
    setIsConfirmDialogOpen(false);
    scrollWindowToTop();
    toast.success("Data persetujuan telah disimpan. Silakan lanjutkan ke tahap Izin Terbit.");
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="app-info-label text-muted-foreground">
            Tanggal Persetujuan <span className="text-status-revision">*</span>
          </label>
          <input
            type="date"
            max={new Date().toLocaleDateString('en-CA')}
            value={form.approvalDate}
            onClick={(e) => {
              openDateInputPicker(e.currentTarget);
            }}
            onChange={(e) => {
              const val = e.target.value;
              if (val && val.split('-')[0].length > 4) return;
              setForm((prev) => ({ ...prev, approvalDate: val }));
              setErrors((prev) => ({ ...prev, approvalDate: undefined }));
            }}
            className={`app-form-field ${errors.approvalDate ? "app-form-field-error" : ""} relative cursor-pointer`}
          />
          {errors.approvalDate ? <p className="text-xs text-status-revision mt-1">{errors.approvalDate}</p> : null}
        </div>

        <div className="space-y-1.5">
          <label className="app-info-label text-muted-foreground">
            Nomor Izin PB UMKU <span className="text-status-revision">*</span>
          </label>
          <input
            type="text"
            value={form.pbUmkuNumber}
            onChange={(e) => {
              setForm((prev) => ({ ...prev, pbUmkuNumber: e.target.value }));
              setErrors((prev) => ({ ...prev, pbUmkuNumber: undefined }));
            }}
            placeholder="Masukkan nomor izin PB UMKU"
            className={`app-form-field ${errors.pbUmkuNumber ? "app-form-field-error" : ""}`}
          />
          {errors.pbUmkuNumber ? <p className="text-xs text-status-revision mt-1">{errors.pbUmkuNumber}</p> : null}
        </div>
      </div>

      <div className="space-y-2">
        <label className="app-info-label text-muted-foreground">
          Izin PB UMKU (PDF maks. 5 MB) <span className="text-status-revision">*</span>
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={handleFileChange}
          className="hidden"
        />
        {errors.skFile ? <p className="text-xs text-status-revision mt-1">{errors.skFile}</p> : null}
        {currentFileName ? (
          <FileAttachmentCard
            fileName={currentFileName}
            fileSizeBytes={currentFileSize}
            statusLabel="Terupload"
            onPreview={handlePreviewFile}
            onRemove={handleRemoveFile}
          />
        ) : (
          <FileUploadPickerCard
            label="Pilih file Izin PB UMKU"
            helperText="PDF maks. 5 MB"
            onSelect={handleOpenFilePicker}
            hasError={!!errors.skFile}
          />
        )}
      </div>

      <div className="flex justify-end pt-4 border-t border-slate-100">
        <button
          type="button"
          onClick={handleSubmit}
          className="app-primary-button inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-6 text-sm font-semibold sm:w-auto"
        >
          <Upload className="w-4 h-4 stroke-[3]" />
          Simpan Persetujuan & Lanjut
        </button>
      </div>

      <FlowConfirmDialog
        open={isConfirmDialogOpen}
        onOpenChange={(open) => {
          setIsConfirmDialogOpen(open);
          if (!open) setPendingPayload(null);
        }}
        title="Simpan Persetujuan & Lanjut ke Izin Terbit?"
        description="Data persetujuan akan disimpan dan proses akan dilanjutkan ke tahap Izin Terbit."
        confirmLabel="Ya, Simpan & Lanjut"
        onConfirm={handleConfirmApproval}
      />
    </div>
  );
};

const IzinTerbitView = ({ submission }: { submission: AdminSubmission }) => {
  const { issueLicense } = useSubmissions();
  const navigate = useNavigate();
  const hasSkFile = !!submission.skFileName;
  const isApprovalDraftReady = hasApprovalDraftReadyForIssuance(submission);
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | "">(submission.licenseStatus || "");
  const [error, setError] = useState<string>("");
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isFinishDialogOpen, setIsFinishDialogOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<LicenseIssuanceInput | null>(null);

  useEffect(() => {
    setLicenseStatus(submission.licenseStatus || "");
    setError("");
    setPendingStatus(null);
    setIsConfirmDialogOpen(false);
  }, [submission.id, submission.licenseIssued, submission.licenseStatus, submission.lastUpdated]);

  const getApprovalDraftErrorMessage = () => {
    if (!submission.approvalCompleted) return "Selesaikan persetujuan terlebih dahulu.";
    if (!submission.approvalDate.trim()) return "Tanggal persetujuan belum tersedia.";
    if (!submission.licenseNumber.trim()) return "Nomor Izin PB UMKU belum tersedia.";
    if (!submission.skFileName.trim() || submission.skFileSizeBytes <= 0) {
      return "Izin PB UMKU belum lengkap.";
    }
    if (!submission.skFileName.trim().toLowerCase().endsWith(".pdf")) {
      return "File Izin PB UMKU harus berformat PDF.";
    }
    return "Lengkapi data persetujuan terlebih dahulu.";
  };

  const prepareIssueLicense = () => {
    if (!isApprovalDraftReady) {
      setError(getApprovalDraftErrorMessage());
      return;
    }

    if (!isLicenseStatus(licenseStatus)) {
      setError("Status izin wajib dipilih.");
      return;
    }

    setError("");
    setPendingStatus({ status: licenseStatus });
    setIsConfirmDialogOpen(true);
  };

  const handleConfirmIssueLicense = () => {
    if (!pendingStatus || !isLicenseStatus(pendingStatus.status)) return;

    issueLicense(submission.id, pendingStatus);
    setPendingStatus(null);
    setIsConfirmDialogOpen(false);
    scrollWindowToTop();
    toast.success(`Izin PB UMKU telah ditetapkan dengan status ${licenseStatus}.`);
  };

  if (!submission.licenseIssued) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <InfoRow label="Nomor Izin PB UMKU" value={submission.licenseNumber || "-"} />
          <InfoRow label="Tanggal Persetujuan" value={submission.approvalDate || "-"} />
        </div>

        {hasSkFile ? (
          <div className="space-y-1.5">
            <p className="app-info-label text-muted-foreground">
              Izin PB UMKU
            </p>
	            <FileAttachmentCard
	              fileName={submission.skFileName}
	              fileSizeBytes={submission.skFileSizeBytes}
	              statusLabel="Terupload"
	              fileUrl={submission.skFileUrl}
	              onPreview={() => openPreviewWindow(submission.skFileUrl || buildMetadataPreviewHref({
	                title: "Pratinjau Izin PB UMKU",
	                fileName: submission.skFileName,
	                fileSizeBytes: submission.skFileSizeBytes,
	                extraLines: [
	                  `Tanggal Persetujuan: ${submission.approvalDate || "-"}`,
	                  `Nomor Izin PB UMKU: ${submission.licenseNumber || "-"}`,
	                  "Status Izin: Menunggu Penetapan",
	                ],
	              }))}
	            />
          </div>
        ) : (
          <div className="space-y-1.5">
            <p className="app-info-label text-muted-foreground">Izin PB UMKU</p>
            <EmptyFileState />
          </div>
        )}

        <div className="space-y-1.5">
          <label className="app-info-label text-muted-foreground">
            Status Izin <span className="text-status-revision">*</span>
          </label>
          <select
            value={licenseStatus}
            onChange={(e) => {
              setLicenseStatus(isLicenseStatus(e.target.value) ? e.target.value : "");
              setError("");
            }}
            className={`app-form-select ${!licenseStatus ? "text-muted-foreground" : "text-foreground"} ${error ? "app-form-field-error" : ""}`}
          >
            <option value="" disabled hidden>Pilih status izin</option>
            <option value="Aktif" className="text-foreground">Aktif</option>
            <option value="Tidak Aktif" className="text-foreground">Tidak Aktif</option>
          </select>
          {error ? <p className="text-xs text-status-revision mt-1">{error}</p> : null}
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={prepareIssueLicense}
            className="app-primary-button inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-6 text-sm font-semibold sm:w-auto"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            Simpan Izin Terbit
          </button>
        </div>

        <FlowConfirmDialog
          open={isConfirmDialogOpen}
          onOpenChange={(open) => {
            setIsConfirmDialogOpen(open);
            if (!open) setPendingStatus(null);
          }}
          title="Simpan Izin Terbit?"
          description="Status izin akan disimpan dan proses permohonan akan dinyatakan selesai."
          confirmLabel="Ya, Simpan Izin"
          onConfirm={handleConfirmIssueLicense}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
        <InfoRow label="Nomor Izin PB UMKU" value={submission.licenseNumber || "-"} />
        <InfoRow label="Tanggal Terbit" value={submission.licenseDate || "-"} />
        <InfoRow label="Status Izin" value={submission.licenseStatus || "-"} />
      </div>
      {hasSkFile ? (
        <div className="space-y-1.5">
          <p className="app-info-label text-muted-foreground">
            Izin PB UMKU
          </p>
	          <FileAttachmentCard
	            fileName={submission.skFileName}
	            fileSizeBytes={submission.skFileSizeBytes}
	            statusLabel="Terupload"
	            fileUrl={submission.skFileUrl}
	            onPreview={() => openPreviewWindow(submission.skFileUrl || buildMetadataPreviewHref({
	              title: "Pratinjau Izin PB UMKU",
	              fileName: submission.skFileName,
	              fileSizeBytes: submission.skFileSizeBytes,
	              extraLines: [
	                `Tanggal Terbit: ${submission.licenseDate || "-"}`,
	                `Nomor Izin PB UMKU: ${submission.licenseNumber || "-"}`,
	                `Status Izin: ${submission.licenseStatus || "-"}`,
	              ],
	            }))}
	          />
        </div>
      ) : (
        <div className="space-y-1.5">
          <p className="app-info-label text-muted-foreground">Izin PB UMKU</p>
          <EmptyFileState />
        </div>
      )}

      <div className="flex justify-end pt-5 border-t border-slate-100 mt-2">
        <button
          type="button"
          onClick={() => setIsFinishDialogOpen(true)}
          className="app-primary-button inline-flex h-11 w-full items-center justify-center rounded-xl px-8 text-sm font-semibold sm:w-auto"
        >
          Selesai
        </button>
      </div>

      <FlowConfirmDialog
        open={isFinishDialogOpen}
        onOpenChange={setIsFinishDialogOpen}
        title="Proses Permohonan Selesai"
        description="Semua tahapan permohonan penerbitan izin telah terlewati dengan lengkap. Anda akan dikembalikan ke Halaman Kelola Admin."
        confirmLabel="Selesai"
        onConfirm={() => {
          setIsFinishDialogOpen(false);
          navigate("/admin");
        }}
      />
    </div>
  );
};

const FileUploadPickerCard = ({
  label,
  helperText,
  onSelect,
  hasError = false,
}: {
  label: string;
  helperText: string;
  onSelect: () => void;
  hasError?: boolean;
}) => (
  <button
    type="button"
    onClick={onSelect}
    className={`group w-full rounded-[1.25rem] border-2 border-dashed px-4 py-8 text-center flex flex-col items-center justify-center gap-3 transition-colors duration-200 ${hasError ? "border-status-revision/40 bg-status-revision/5 hover:bg-status-revision/10" : "border-slate-300 bg-slate-50/50 hover:bg-slate-100 hover:border-slate-400"
      }`}
  >
    <div className="shrink-0 h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-1 group-hover:scale-110 transition-transform duration-200">
      <CloudUpload className="w-6 h-6" />
    </div>
    <div className="space-y-1 w-full px-4">
      <p className="text-sm font-semibold text-slate-800">
        Klik untuk mengunggah <span className="font-normal text-slate-500">atau tarik dan lepas</span>
      </p>
      <p className="text-xs font-medium text-slate-500">
        {label} ({helperText})
      </p>
    </div>
  </button>
);

const FileAttachmentCard = ({
  fileName,
  fileSizeBytes,
  statusLabel,
  fileUrl,
  onPreview,
  onRemove,
}: {
  fileName: string;
  fileSizeBytes: number;
  statusLabel: string;
  fileUrl?: string;
  onPreview?: () => void;
  onRemove?: () => void;
}) => (
  <div className="app-file-card flex items-start gap-3 sm:items-center sm:gap-4">
    <div className="shrink-0 h-11 w-11 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center">
      <span className="inline-flex items-center justify-center rounded-md border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-black text-rose-600">
        PDF
      </span>
    </div>
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-semibold text-slate-800" title={fileName}>{fileName}</p>
      <div className="app-file-card-meta">
        <span>{formatBytes(fileSizeBytes)}</span>
        <span className="text-slate-300">|</span>
        <span className="inline-flex items-center gap-1.5 text-emerald-600">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {statusLabel}
        </span>
      </div>
    </div>

    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => {
          if (fileUrl) {
            downloadFileFromHref(fileUrl, fileName);
            return;
          }
          toast.success(`Proses unduh ${fileName} dimulai.`);
          setTimeout(() => toast.info("Proses unduh dokumen telah selesai."), 1500);
        }}
        aria-label={`Unduh dokumen ${fileName}`}
        title={`Unduh dokumen ${fileName}`}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg p-0 text-slate-600 border border-slate-200 bg-white"
      >
        <Download className="w-4 h-4" />
      </button>

      {onPreview ? (
        <button
          type="button"
          onClick={onPreview}
          aria-label={`Lihat dokumen ${fileName}`}
          title={`Lihat dokumen ${fileName}`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg p-0 text-slate-600 border border-slate-200 bg-white"
        >
          <Eye className="w-4 h-4" />
        </button>
      ) : null}

      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Hapus dokumen ${fileName}`}
          title={`Hapus dokumen ${fileName}`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg p-0 text-slate-400 border border-transparent bg-transparent"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      ) : null}
    </div>
  </div>
);

const EmptyFileState = () => (
  <div className="flex items-center gap-3 rounded-[1.25rem] border border-amber-200/50 bg-amber-50/50 p-3.5 sm:p-4">
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100/80 text-amber-600">
      <AlertTriangle className="h-5 w-5 stroke-[2.5]" />
    </div>
    <div>
      <p className="text-[13px] font-bold text-amber-900">Salinan Dokumen Belum Tersedia</p>
      <p className="text-[12px] font-medium text-amber-700/80 mt-0.5">Izin PB UMKU belum diunggah ke sistem.</p>
    </div>
  </div>
);

const SessionHistory = ({ submission, phase }: { submission: AdminSubmission; phase: HistoryPhase }) => {
  const sessions = useMemo(() => buildSessionGroups(submission, phase), [phase, submission]);
  const resetAccordionKey = `${phase}-${submission.id}-${submission.lastUpdated}-${submission.timeline.length}-${sessions.length}`;
  const defaultSessionKey = sessions.at(-1)?.key;
  if (sessions.length === 0) return null;

  return (
    <div className="space-y-3 pb-2 animate-fade-in-up">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-100">
          <History className="w-4 h-4 text-slate-500" />
        </div>
        <h3 className="app-section-title text-lg">
          Riwayat {phase === "VERIFIKASI" ? "Verifikasi Dokumen" : "Peninjauan Dokumen"} <span className="text-slate-400 font-medium">({sessions.length})</span>
        </h3>
      </div>
      <Accordion
        key={resetAccordionKey}
        type="single"
        collapsible
        defaultValue={defaultSessionKey}
        className="space-y-3"
      >
        {sessions.map((session, sessionIndex) => {
          const isLatestSession = sessionIndex === sessions.length - 1;

          return (
            <AccordionItem
              key={session.key}
              value={session.key}
              className="overflow-hidden rounded-[1.25rem] border border-slate-200/80 bg-white px-4 shadow-sm data-[state=open]:border-slate-300 sm:px-5"
            >
              <AccordionTrigger className="group py-4 hover:no-underline sm:py-4.5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 text-left w-full pr-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-bold text-slate-800">{session.label}</span>
                    {isLatestSession ? (
                      <span className="app-badge-sm app-badge-phase normal-case tracking-normal text-[10.5px] font-semibold">
                        Terbaru
                      </span>
                    ) : null}
                  </div>
                  <span className="app-badge-sm app-badge-neutral self-start normal-case tracking-normal text-xs font-semibold sm:ml-auto">{session.dateLabel}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-5 pt-1">
                <Accordion
                  key={`${resetAccordionKey}-${session.key}`}
                  type="multiple"
                  className="mt-1 space-y-2.5"
                >
                  {session.entries.map((entry) => (
                    <AccordionItem
                      key={`${session.key}-doc-${entry.documentNumber}`}
                      value={`${session.key}-doc-${entry.documentNumber}`}
                      className="rounded-[1rem] border border-slate-200/70 bg-slate-50/60 px-3.5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.03)] data-[state=open]:border-slate-300/80 data-[state=open]:bg-white sm:px-4"
                    >
                      <AccordionTrigger className="py-3.5 hover:no-underline">
                        <div className="flex items-start gap-3 w-full text-left">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-500 shadow-sm">
                            {entry.documentNumber}
                          </span>
                          <p className="min-w-0 flex-1 text-[14px] font-semibold leading-snug text-slate-700 sm:truncate">
                            {entry.documentName}
                          </p>
                          <span
                            title={getDecisionStatusLabel(entry.status)}
                            className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border shadow-sm ${entry.status === "approved"
                                ? "border-status-completed/20 bg-status-completed-bg text-status-completed"
                                : "border-status-revision/20 bg-status-revision-bg text-status-revision"
                              }`}
                          >
                            {entry.status === "approved"
                              ? <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                              : <AlertTriangle className="w-3.5 h-3.5 stroke-[2.5]" />}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-4 pt-0.5">
                        <div className="grid gap-2.5 sm:grid-cols-2">
                          <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3">
                            <p className="app-info-label mb-1.5">Status</p>
                            <p className="text-[13px] font-semibold text-slate-800">
                              {getDecisionStatusLabel(entry.status)}
                            </p>
                          </div>
                          <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3">
                            <p className="app-info-label mb-1.5">Catatan</p>
                            <p className="text-[13px] leading-relaxed text-slate-600">
                              {entry.note || "-"}
                            </p>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
};

const buildSessionGroups = (submission: AdminSubmission, phase: HistoryPhase) => {
  type SessionEntryRow = {
    documentNumber: number;
    documentName: string;
    status: "approved" | "revision_required";
    note?: string;
    date: string;
    time: string;
  };

  type SessionGroupDraft = {
    dateLabel: string;
    entries: Map<number, SessionEntryRow>;
  };

  const docs = phase === "VERIFIKASI" ? submission.documents : submission.reviewDocuments;
  const groups = new Map<number, SessionGroupDraft>();

  submission.timeline.forEach((event) => {
    if (event.phase !== phase) return;
    const session = event.sessionNumber || event.reviewCycle || 1;
    if (!session) return;

    const group = groups.get(session) || {
      dateLabel: event.date,
      entries: new Map<number, SessionEntryRow>(),
    };

    if (Array.isArray(event.sessionEntries) && event.sessionEntries.length > 0) {
      event.sessionEntries.forEach((entry) => {
        group.entries.set(entry.documentNumber, {
          documentNumber: entry.documentNumber,
          documentName: entry.documentName || docs[entry.documentNumber - 1]?.name || `Dokumen ${entry.documentNumber}`,
          status: entry.status,
          note: entry.note,
          date: entry.date || event.date,
          time: entry.time || event.time,
        });
      });
      groups.set(session, group);
      return;
    }

    if (!event.decisionStatus || !event.documentNumber) {
      groups.set(session, group);
      return;
    }

    group.entries.set(event.documentNumber, {
      documentNumber: event.documentNumber,
      documentName: docs[event.documentNumber - 1]?.name || `Dokumen ${event.documentNumber}`,
      status: event.decisionStatus,
      note: event.note,
      date: event.date,
      time: event.time,
    });
    groups.set(session, group);
  });

  return Array.from(groups.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([session, group]) => ({
      key: `${phase}-${session}`,
      label: `${phase === "VERIFIKASI" ? "Verifikasi Dokumen" : "Peninjauan Dokumen"} ke-${session}`,
      dateLabel: group.dateLabel || "-",
      entries: Array.from(group.entries.values()).sort((a, b) => a.documentNumber - b.documentNumber),
    }));
};

const InfoRow = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="app-surface-tile p-3.5 sm:p-4 block">
    <p className="app-info-label mb-1.5">{label}</p>
    <div className="font-medium text-slate-800 text-[14px] leading-snug">{value}</div>
  </div>
);

export default StageDetailAdmin;
