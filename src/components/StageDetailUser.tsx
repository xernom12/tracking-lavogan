import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Check,
  AlertTriangle,
  Lock,
  FileText,
  Download,
  Eye,
  ChevronDown,
  ChevronUp,
  Upload,
  History,
} from "lucide-react";
import type { AdminSubmission } from "@/contexts/SubmissionContext";
import { useSubmissions } from "@/contexts/useSubmissions";
import type { Document, DocumentUploadPhase, Stage } from "@/data/mockData";
import {
  getDecisionStatusLabel,
  getLatestDocumentUpload,
  hasUploadedRevisionAfterLatestRequest,
  getDocumentStatusLabel,
  getWorkflowPhaseLabel,
} from "@/data/mockData";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import FlowConfirmDialog from "@/components/FlowConfirmDialog";
import {
  buildMetadataPreviewHref,
  downloadFileFromHref,
  formatBytes,
  openPreviewWindow,
} from "@/lib/file-preview";
import { scrollWindowToTop } from "@/lib/scroll";
import { getKbliOptionLabel } from "@/data/kbliOptions";

interface StageDetailUserProps {
  submission: AdminSubmission;
  stageIndex: number;
  stages: Stage[];
}

const statusConfig = {
  approved: { icon: Check, label: getDocumentStatusLabel("approved"), className: "app-badge app-badge-success" },
  revision_required: { icon: AlertTriangle, label: getDocumentStatusLabel("revision_required"), className: "app-badge app-badge-revision" },
  locked: { icon: Lock, label: getDocumentStatusLabel("locked"), className: "app-badge app-badge-pending" },
};

const getDocumentPanelClasses = (status: Document["status"]) => {
  if (status === "approved") {
    return {
      cardClass: "bg-status-completed-bg/25 border-status-completed hover:border-status-completed/70",
      numberClass: "bg-status-completed/10 text-status-completed border-status-completed/20",
    };
  }

  if (status === "revision_required") {
    return {
      cardClass: "bg-status-revision-bg/25 border-status-revision hover:border-status-revision/70",
      numberClass: "bg-status-revision/10 text-status-revision border-status-revision/20",
    };
  }

  return {
    cardClass: "bg-muted/30 border-border/40 opacity-70",
    numberClass: "bg-slate-100 text-slate-400 border-slate-200",
  };
};

const StageDetailUser = ({ submission, stageIndex, stages }: StageDetailUserProps) => {
  const stage = stages[stageIndex];
  const hasMountedRef = useRef(false);
  const operationalModeLabel =
    stageIndex === 1
      ? "Riwayat Verifikasi per Sesi"
      : stageIndex === 2
        ? "Riwayat Peninjauan per Sesi"
        : null;

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    scrollWindowToTop();
  }, [submission.lastUpdated, submission.timeline.length]);

  if (stage.status === "locked") {
    return (
      <div className="app-surface-card-soft p-6 sm:p-10 text-center flex flex-col items-center justify-center animate-fade-in-up">
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4 shadow-sm border border-white">
          <Lock className="w-7 h-7 sm:w-8 sm:h-8 text-muted-foreground" />
        </div>
        <p className="text-sm font-semibold text-slate-500">Tahapan ini terkunci</p>
        <p className="text-xs text-slate-400 mt-1">Selesaikan tahapan sebelumnya untuk mengakses informasi ini.</p>
      </div>
    );
  }

  return (
    <div className="app-surface-card p-5 sm:p-8 animate-fade-in-up">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 border-b border-slate-100 pb-4 sm:pb-5 mb-5 sm:mb-6">
        <h3 className="app-section-title text-lg sm:text-xl flex items-center gap-3">
          <span className="app-stage-icon">
            <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
          </span>
          {stage.label}
        </h3>
      </div>

      {operationalModeLabel ? (
        <p className="text-xs text-muted-foreground -mt-2 mb-5">{operationalModeLabel}</p>
      ) : null}

      {stageIndex === 0 && <PengajuanDetail submission={submission} />}
      {stageIndex === 1 && <VerifikasiDetail submission={submission} completed={stage.status === "completed"} />}
      {stageIndex === 2 && <PeninjauanDetail submission={submission} completed={stage.status === "completed"} />}
      {stageIndex === 3 && <PersetujuanDetail submission={submission} completed={stage.status === "completed"} />}
      {stageIndex === 4 && <IzinTerbitDetail submission={submission} completed={stage.status === "completed"} />}
    </div>
  );
};

const PengajuanDetail = ({ submission }: { submission: AdminSubmission }) => {
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

const VerifikasiDetail = ({ submission, completed }: { submission: AdminSubmission; completed: boolean }) => {
  return (
    <DocumentProcessDetail
      submission={submission}
      docs={submission.documents}
      completed={completed}
      phase="VERIFIKASI"
      title="Riwayat Verifikasi Dokumen"
      variant="verification"
    />
  );
};

const PeninjauanDetail = ({ submission, completed }: { submission: AdminSubmission; completed: boolean }) => {
  return (
    <DocumentProcessDetail
      submission={submission}
      docs={submission.reviewDocuments}
      completed={completed}
      phase="PENINJAUAN"
      title="Riwayat Peninjauan Dokumen"
      variant="review"
    />
  );
};

type HistoryPhase = "VERIFIKASI" | "PENINJAUAN";

type ProcessStageVariant = "verification" | "review";

interface DocumentProcessDetailProps {
  submission: AdminSubmission;
  docs: Document[];
  completed: boolean;
  phase: HistoryPhase;
  title: string;
  variant: ProcessStageVariant;
}

const DocumentProcessDetail = ({
  submission,
  docs,
  completed,
  phase,
  title,
  variant,
}: DocumentProcessDetailProps) => {
  const approvedCount = docs.filter((doc) => doc.status === "approved").length;
  const total = docs.length;
  const [openDocIndexes, setOpenDocIndexes] = useState<number[]>([]);

  useEffect(() => {
    setOpenDocIndexes([]);
  }, [submission.id, submission.lastUpdated, submission.timeline.length]);

  if (completed) {
    return (
      <ProcessCycleHistory
        submission={submission}
        phase={phase}
        title={title}
      />
    );
  }

  return (
    <div className={variant === "verification" ? "space-y-6" : "space-y-4"}>
      <ProcessProgressSummary
        approvedCount={approvedCount}
        total={total}
        variant={variant}
      />

      {total > 0 ? (
        <div className={variant === "verification" ? "space-y-3" : "space-y-2"}>
          {docs.map((doc, index) => {
            const isOpen = openDocIndexes.includes(index);

            return (
              <DocumentProcessCard
                key={`${phase}-${doc.name}-${index + 1}`}
                submissionId={submission.id}
                submissionTimeline={submission.timeline}
                doc={doc}
                documentNumber={index + 1}
                phase={phase}
                isOpen={isOpen}
                onToggle={() =>
                  setOpenDocIndexes((prev) =>
                    prev.includes(index)
                      ? prev.filter((item) => item !== index)
                      : [...prev, index]
                  )
                }
              />
            );
          })}
        </div>
      ) : null}

      <ProcessCycleHistory
        submission={submission}
        phase={phase}
        title={title}
      />
    </div>
  );
};

const ProcessProgressSummary = ({
  approvedCount,
  total,
  variant,
}: {
  approvedCount: number;
  total: number;
  variant: ProcessStageVariant;
}) => {
  const progressWidth = total ? (approvedCount / total) * 100 : 0;

  if (variant === "verification") {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-3.5 sm:flex-row sm:items-center sm:gap-4 sm:p-4">
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-secondary shadow-inner">
          <div
            className="h-full rounded-full bg-status-completed transition-all duration-1000 ease-out"
            style={{ width: `${progressWidth}%` }}
          />
        </div>
        <span className="self-start whitespace-nowrap rounded-xl border bg-white px-3 py-1.5 text-sm font-bold text-foreground shadow-sm sm:self-auto">
          <span className="text-status-completed">{approvedCount}</span> dari {total} dokumen sesuai persyaratan
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-status-completed transition-all"
          style={{ width: `${progressWidth}%` }}
        />
      </div>
      <span className="text-[14px] font-semibold text-slate-800">
        {approvedCount} dari {total} dokumen sesuai persyaratan
      </span>
    </div>
  );
};

const DocumentProcessCard = ({
  submissionId,
  submissionTimeline,
  doc,
  documentNumber,
  phase,
  isOpen,
  onToggle,
}: {
  submissionId: string;
  submissionTimeline: AdminSubmission["timeline"];
  doc: Document;
  documentNumber: number;
  phase: HistoryPhase;
  isOpen: boolean;
  onToggle: () => void;
}) => {
  const config = statusConfig[doc.status];
  const Icon = config.icon;
  const isLocked = doc.status === "locked";
  const appearance = getDocumentPanelClasses(doc.status);
  const isAwaitingAdminReview = doc.status === "revision_required"
    && hasUploadedRevisionAfterLatestRequest(submissionTimeline, documentNumber, phase);

  return (
    <div
      data-testid={`user-doc-${phase.toLowerCase()}-${documentNumber}`}
      className={`overflow-hidden rounded-[1.25rem] border ${appearance.cardClass} transition-all duration-300`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full flex-wrap items-start gap-3 p-3.5 text-left transition-colors sm:flex-nowrap sm:items-center sm:gap-4 sm:p-4"
      >
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-sm font-extrabold shadow-sm ${appearance.numberClass}`}>
          {documentNumber}
        </div>
        <div className="min-w-0 flex-1">
          <p className={`flex flex-wrap items-center gap-2 text-[15px] font-bold ${isLocked ? "text-slate-400" : "text-slate-800"}`}>
            <span className="truncate">{doc.name}</span>
            {isAwaitingAdminReview ? (
              <span className="app-badge-sm app-badge-neutral normal-case tracking-normal">
                Menunggu Pemeriksaan Ulang
              </span>
            ) : null}
          </p>
        </div>
        <span className={`${config.className} w-full justify-center py-1.5 text-[11px] font-bold shadow-sm sm:w-auto sm:justify-start sm:text-xs`}>
          <Icon className="w-3.5 h-3.5 stroke-[2.5]" />
          {config.label}
        </span>
        <div className={`rounded-full p-1 transition-colors ${isOpen ? "bg-slate-100" : "hover:bg-slate-100"}`}>
          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          )}
        </div>
      </button>

      {isOpen ? (
        <div className="animate-fade-in-up px-4 pb-4 pt-1 sm:px-5 sm:pb-5">
          {doc.status === "revision_required" ? (
            <div className="mt-4">
              <RevisionUploadPanel
                submissionId={submissionId}
                doc={doc}
                documentNumber={documentNumber}
                phase={phase}
                isAwaitingAdminReview={isAwaitingAdminReview}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

interface ProcessCycleHistoryProps {
  submission: AdminSubmission;
  phase: HistoryPhase;
  title: string;
}

const RevisionUploadPanel = ({
  submissionId,
  doc,
  documentNumber,
  phase,
  isAwaitingAdminReview,
}: {
  submissionId: string;
  doc: Document;
  documentNumber: number;
  phase: DocumentUploadPhase;
  isAwaitingAdminReview: boolean;
}) => {
  const { uploadRevisionDocument } = useSubmissions();
  const latestUpload = getLatestDocumentUpload(doc, phase);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [pendingUpload, setPendingUpload] = useState<{
    fileName: string;
    fileSizeBytes: number;
    file: File;
  } | null>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      toast.error("Dokumen perbaikan harus disampaikan dalam format PDF.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran dokumen perbaikan tidak boleh melebihi 5 MB.");
      return;
    }

    setPendingUpload({
      fileName: file.name,
      fileSizeBytes: file.size,
      file,
    });
    setIsConfirmDialogOpen(true);
  };

  const handleConfirmUpload = () => {
    if (!pendingUpload) return;

    uploadRevisionDocument(submissionId, phase, documentNumber, pendingUpload);
    setPendingUpload(null);
    setIsConfirmDialogOpen(false);

    toast.success("Dokumen perbaikan telah diunggah.", {
      description: "Dokumen sedang menunggu pemeriksaan ulang oleh admin.",
    });
  };

  return (
    <div className="mt-3 mb-4 rounded-xl border border-primary/10 bg-primary/5 p-3.5 sm:p-4">
      <label className="app-primary-button flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold">
        <Upload className="w-4 h-4" />
        {isAwaitingAdminReview ? "Unggah Ulang Dokumen Perbaikan" : "Unggah Dokumen Perbaikan"}
        <input
          type="file"
          accept="application/pdf,.pdf"
          onChange={handleFileChange}
          className="sr-only"
        />
      </label>
      <p className="text-xs text-muted-foreground mt-2 text-center text-balance">
        {isAwaitingAdminReview
          ? "Dokumen perbaikan telah diunggah dan sedang menunggu pemeriksaan ulang oleh admin. Anda masih dapat mengunggah ulang apabila diperlukan."
          : "Unggah kembali dokumen yang telah diperbaiki sesuai catatan pemeriksa. Format PDF dengan ukuran maksimal 5 MB."}
      </p>
      {latestUpload ? (
        <div className="mt-3 rounded-lg border border-white/70 bg-white/80 px-3 py-2.5">
          <p className="app-info-label text-[11px]">Unggahan Terakhir</p>
          <p className="text-[13px] font-medium text-slate-800 mt-1">
            {latestUpload.fileName} ({formatBytes(latestUpload.fileSizeBytes)})
          </p>
          <p className="text-[11.5px] text-slate-500 mt-1">
            Diupload pada {latestUpload.date}, {latestUpload.time}
          </p>
          {latestUpload.fileUrl ? (
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => downloadFileFromHref(latestUpload.fileUrl || "", latestUpload.fileName)}
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
              >
                <Download className="h-3.5 w-3.5" />
                Unduh
              </button>
              <button
                type="button"
                onClick={() => openPreviewWindow(latestUpload.fileUrl || "")}
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
              >
                <Eye className="h-3.5 w-3.5" />
                Lihat
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <FlowConfirmDialog
        open={isConfirmDialogOpen}
        onOpenChange={(open) => {
          setIsConfirmDialogOpen(open);
          if (!open) setPendingUpload(null);
        }}
        title={`Unggah dokumen perbaikan ${getWorkflowPhaseLabel(phase)}?`}
        description="Dokumen perbaikan akan disampaikan dan menunggu pemeriksaan ulang oleh admin."
        confirmLabel="Ya, Unggah Dokumen"
        onConfirm={handleConfirmUpload}
      />
    </div>
  );
};

const ProcessCycleHistory = ({ submission, phase, title }: ProcessCycleHistoryProps) => {
  const cycles = buildProcessCycles(submission, phase);
  const resetAccordionKey = `${phase}-${submission.id}-${submission.lastUpdated}-${submission.timeline.length}-${cycles.length}`;
  const defaultCycleKey = cycles.at(-1)?.key;
  if (cycles.length === 0) return null;

  return (
    <div className="rounded-[1.4rem] border border-slate-200/80 bg-slate-50/75 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)] sm:p-5 space-y-3.5">
      <div className="flex items-center gap-2.5">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm">
          <History className="w-4 h-4" />
        </span>
        <p className="text-[14px] font-semibold text-slate-800">
          {title} <span className="text-slate-400">({cycles.length})</span>
        </p>
      </div>
      <Accordion
        key={resetAccordionKey}
        type="single"
        collapsible
        defaultValue={defaultCycleKey}
        className="w-full space-y-2.5"
      >
        {cycles.map((cycle, cycleIndex) => {
          const isLatestCycle = cycleIndex === cycles.length - 1;

          return (
          <AccordionItem
            key={cycle.key}
            value={cycle.key}
            className="overflow-hidden rounded-[1.1rem] border border-slate-200/80 bg-white px-3.5 shadow-sm data-[state=open]:border-slate-300 sm:px-4"
          >
            <AccordionTrigger className="hover:no-underline py-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-semibold text-slate-800">{cycle.label}</span>
                  {isLatestCycle ? (
                    <span className="app-badge-sm app-badge-phase normal-case tracking-normal text-[10.5px] font-semibold">
                      Terbaru
                    </span>
                  ) : null}
                </div>
                <span className="app-badge-sm app-badge-neutral self-start normal-case tracking-normal text-[11.5px] font-medium sm:ml-auto">
                  {cycle.dateLabel}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-3.5 pt-0.5">
              <Accordion key={`${resetAccordionKey}-${cycle.key}`} type="single" collapsible className="space-y-2.5">
                {cycle.entries.map((entry) => (
                  <AccordionItem
                    key={`${cycle.key}-${entry.documentNumber}`}
                    value={`${cycle.key}-doc-${entry.documentNumber}`}
                    className="rounded-[1rem] border border-slate-200/70 bg-slate-50/65 px-3.5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.03)] data-[state=open]:border-slate-300/80 data-[state=open]:bg-white sm:px-4"
                  >
                    <AccordionTrigger className="hover:no-underline py-3">
                      <div className="flex items-start gap-3 w-full text-left">
                        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-500 shadow-sm">
                          {entry.documentNumber}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold leading-snug text-slate-800 sm:text-[13.5px]">
                            {entry.documentName}
                          </p>
                        </div>
                        <span
                          title={getDocumentStatusLabel(entry.status)}
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
                    <AccordionContent className="pb-3.5 pt-0.5">
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

interface CycleEntry {
  documentNumber: number;
  documentName: string;
  status: "approved" | "revision_required";
  note?: string;
  date: string;
}

interface CycleGroup {
  key: string;
  label: string;
  dateLabel: string;
  entries: CycleEntry[];
}

const buildProcessCycles = (submission: AdminSubmission, phase: HistoryPhase): CycleGroup[] => {
  type CycleDraft = {
    dateLabel: string;
    entries: Map<number, CycleEntry>;
  };

  const docs = phase === "VERIFIKASI" ? submission.documents : submission.reviewDocuments;
  const cycleMap = new Map<number, CycleDraft>();

  submission.timeline.forEach((event) => {
    if (event.phase !== phase) return;
    const cycle = event.sessionNumber || event.reviewCycle || 1;
    if (!cycle) return;

    const current = cycleMap.get(cycle) || {
      dateLabel: event.date,
      entries: new Map<number, CycleEntry>(),
    };

    if (Array.isArray(event.sessionEntries) && event.sessionEntries.length > 0) {
      event.sessionEntries.forEach((entry) => {
        current.entries.set(entry.documentNumber, {
          documentNumber: entry.documentNumber,
          documentName: entry.documentName || docs[entry.documentNumber - 1]?.name || `Dokumen ${entry.documentNumber}`,
          status: entry.status,
          note: entry.note,
          date: entry.date || event.date,
        });
      });
      cycleMap.set(cycle, current);
      return;
    }

    if (!event.decisionStatus || !event.documentNumber) {
      cycleMap.set(cycle, current);
      return;
    }

    current.entries.set(event.documentNumber, {
      documentNumber: event.documentNumber,
      documentName: docs[event.documentNumber - 1]?.name || `Dokumen ${event.documentNumber}`,
      status: event.decisionStatus,
      note: event.note,
      date: event.date,
    });
    cycleMap.set(cycle, current);
  });

  return Array.from(cycleMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([cycle, data]) => ({
      key: `${phase}-${cycle}`,
      label: `${phase === "VERIFIKASI" ? "Verifikasi Dokumen" : "Peninjauan Dokumen"} ke-${cycle}`,
      dateLabel: data.dateLabel || "-",
      entries: Array.from(data.entries.values()).sort((a, b) => a.documentNumber - b.documentNumber),
    }));
};

const PersetujuanDetail = ({ submission, completed }: { submission: AdminSubmission; completed: boolean }) => (
  <div className="space-y-3 text-sm">
    {completed ? (
      <>
        <InfoRow label="Tanggal Persetujuan" value={submission.approvalDate} />
        <InfoRow label="Nomor Izin PB UMKU" value={submission.licenseNumber || "-"} />
        {submission.skFileName ? (
          <div className="space-y-1.5">
            <p className="app-info-label">Izin PB UMKU</p>
            <UserFileAttachmentCard
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
                ],
              }))}
            />
          </div>
        ) : (
          <InfoRow label="Izin PB UMKU" value="-" />
        )}
      </>
    ) : (
      <p className="text-[14px] font-medium text-slate-500">Persetujuan belum diproses.</p>
    )}
  </div>
);

const IzinTerbitDetail = ({ submission, completed }: { submission: AdminSubmission; completed: boolean }) => (
  <div className="space-y-3 text-sm">
    {completed ? (
      <>
        <InfoRow label="Nomor Izin PB UMKU" value={submission.licenseNumber} />
        <InfoRow label="Tanggal Terbit" value={submission.licenseDate} />
        <InfoRow label="Status Izin" value={submission.licenseStatus || "-"} />
        {submission.skFileName ? (
          <div className="space-y-1.5">
            <p className="app-info-label">Izin PB UMKU</p>
            <UserFileAttachmentCard
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
                  `Tanggal Terbit: ${submission.licenseDate || "-"}`,
                  `Status Izin: ${submission.licenseStatus || "-"}`,
                ],
              }))}
            />
          </div>
        ) : (
          <InfoRow label="Izin PB UMKU" value="-" />
        )}
      </>
    ) : submission.approvalCompleted ? (
      <>
        <InfoRow label="Nomor Izin PB UMKU" value={submission.licenseNumber || "-"} />
        <InfoRow label="Status Izin" value="Menunggu Penetapan" />
        {submission.skFileName ? (
          <div className="space-y-1.5">
            <p className="app-info-label">Izin PB UMKU</p>
            <UserFileAttachmentCard
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
                  "Status Izin: Menunggu Penetapan",
                ],
              }))}
            />
          </div>
        ) : (
          <InfoRow label="Izin PB UMKU" value="-" />
        )}
      </>
    ) : (
      <p className="text-[14px] font-medium text-slate-500">Izin PB UMKU belum diterbitkan.</p>
    )}
  </div>
);

const InfoRow = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="app-surface-tile p-3.5 sm:p-4 block">
    <p className="app-info-label mb-1.5">{label}</p>
    <div className="font-medium text-slate-800 text-[14px] leading-snug">{value}</div>
  </div>
);

const UserFileAttachmentCard = ({
  fileName,
  fileSizeBytes,
  statusLabel,
  fileUrl,
  onPreview,
}: {
  fileName: string;
  fileSizeBytes: number;
  statusLabel: string;
  fileUrl?: string;
  onPreview?: () => void;
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
    </div>
  </div>
);

export default StageDetailUser;


