import { AlertTriangle, Check, Clock3, FileText, Upload } from "lucide-react";
import { motion } from "framer-motion";
import { useMemo } from "react";
import type { SessionEntry, SubmissionData, TimelineEvent, WorkflowPhase } from "@/data/mockData";
import { getWorkflowPhaseLabel } from "@/data/mockData";
import EmptyState from "@/components/EmptyState";

interface TimelineProps {
  submission: SubmissionData;
  activePhase: WorkflowPhase;
}

interface TimelineHistoryItem {
  key: string;
  title: string;
  description?: string;
  date: string;
  time: string;
  tone: "waiting" | "success" | "revision" | "upload" | "info";
  note?: string;
  actorLabel?: string;
}

const monthMap: Record<string, number> = {
  jan: 0, januari: 0,
  feb: 1, februari: 1,
  mar: 2, maret: 2,
  apr: 3, april: 3,
  mei: 4, may: 4,
  jun: 5, juni: 5,
  jul: 6, juli: 6,
  agu: 7, agustus: 7, aug: 7,
  sep: 8, september: 8,
  okt: 9, oktober: 9, oct: 9,
  nov: 10, november: 10,
  des: 11, desember: 11, dec: 11,
};

const toneConfig = {
  waiting: {
    icon: Clock3,
    markerClass: "border-2 border-emerald-300 bg-white text-emerald-600 shadow-sm",
  },
  success: {
    icon: Check,
    markerClass: "border border-emerald-500 bg-emerald-500 text-white shadow-sm",
  },
  revision: {
    icon: AlertTriangle,
    markerClass: "border-2 border-amber-300 bg-white text-amber-600 shadow-sm",
  },
  upload: {
    icon: Upload,
    markerClass: "border-2 border-sky-300 bg-white text-sky-600 shadow-sm",
  },
  info: {
    icon: FileText,
    markerClass: "border-2 border-primary/25 bg-white text-primary shadow-sm",
  },
};

const parseTimelineDate = (date: string): { day: number; month: number; year: number } | null => {
  const normalizedDate = date.trim().toLowerCase().replace(/\./g, "");
  const dateParts = normalizedDate.split(/\s+/);
  if (dateParts.length < 3) return null;

  const day = Number(dateParts[0]);
  const month = monthMap[dateParts[1]];
  const year = Number(dateParts[2]);

  if (
    Number.isNaN(day)
    || month === undefined
    || Number.isNaN(year)
  ) {
    return null;
  }

  return { day, month, year };
};

const parseTimelineDateValue = (date: string): number => {
  const parsedDate = parseTimelineDate(date);
  if (!parsedDate) return 0;

  return new Date(parsedDate.year, parsedDate.month, parsedDate.day).getTime();
};

const parseTimelineTimeValue = (time: string): number => {
  if (!time || time === "-") return -1;

  const match = time.match(/(\d{1,2})[:.](\d{2})/);
  if (!match) return -1;

  return (Number(match[1]) * 60) + Number(match[2]);
};

const formatTimelineDateLabel = (date: string): string => {
  const parsedDate = parseTimelineDate(date);
  if (!parsedDate) return date;

  const day = String(parsedDate.day).padStart(2, "0");
  const month = String(parsedDate.month + 1).padStart(2, "0");
  return `${day}/${month}/${parsedDate.year}`;
};

const formatTimestampLabel = (date: string, time: string): string => {
  if (!time || time === "-") return date;

  const normalizedTime = time.replace(":", ".");
  return `${formatTimelineDateLabel(date)} ${normalizedTime} WIB`;
};

const sortEvents = (events: TimelineEvent[], direction: "asc" | "desc"): TimelineEvent[] => (
  events
    .map((event, index) => ({
      event,
      index,
      dateValue: parseTimelineDateValue(event.date),
      timeValue: parseTimelineTimeValue(event.time),
    }))
    .sort((left, right) => {
      if (left.dateValue !== right.dateValue) {
        return direction === "desc"
          ? right.dateValue - left.dateValue
          : left.dateValue - right.dateValue;
      }

      if (left.timeValue !== right.timeValue) {
        return direction === "desc"
          ? right.timeValue - left.timeValue
          : left.timeValue - right.timeValue;
      }

      return direction === "desc"
        ? right.index - left.index
        : left.index - right.index;
    })
    .map(({ event }) => event)
);

const buildActorLabel = (prefix: string, actor?: string): string | undefined => {
  if (!actor) return undefined;
  return `${prefix} ${actor}`;
};

const getActorDisplayName = (
  actor: string | undefined,
  context: "submission" | "confirmation" | "verification" | "review" | "upload" | "approval" | "issuance",
): string | undefined => {
  if (!actor) return undefined;

  if (actor === "Admin") {
    if (context === "verification") return "K/L - Verifikator";
    if (context === "review") return "K/L - Penelaah";
    if (context === "approval" || context === "issuance") return "Admin Perizinan";
    return "Admin";
  }

  if (actor === "Pemohon") {
    return "Pemohon";
  }

  return actor;
};

const isSessionSummaryEvent = (
  event: TimelineEvent,
  phase: "VERIFIKASI" | "PENINJAUAN",
): boolean => (
  event.phase === phase
  && Boolean(event.sessionNumber)
  && !event.documentNumber
  && !event.decisionStatus
);

const getRevisionEntries = (entries: SessionEntry[] = []): SessionEntry[] =>
  entries.filter((entry) => entry.status === "revision_required");

const formatRevisionNote = (entries: SessionEntry[]): string => {
  const revisions = getRevisionEntries(entries);
  if (revisions.length === 0) return "";

  return [
    `Perbaikan : ${revisions
      .map((entry, index) => `${index + 1}. ${entry.note || entry.documentName}`)
      .join("\n")}`,
  ].join("\n");
};

const findFirstEvent = (
  events: TimelineEvent[],
  predicate: (event: TimelineEvent) => boolean,
): TimelineEvent | undefined => events.find(predicate);

const findLastEvent = (
  events: TimelineEvent[],
  predicate: (event: TimelineEvent) => boolean,
): TimelineEvent | undefined => {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (predicate(events[index])) return events[index];
  }

  return undefined;
};

const getSessionEntries = (
  event: TimelineEvent,
  phaseEvents: TimelineEvent[],
  phaseDocs: SubmissionData["documents"],
): SessionEntry[] => {
  if (Array.isArray(event.sessionEntries) && event.sessionEntries.length > 0) {
    return event.sessionEntries;
  }

  const sessionNumber = event.sessionNumber || 1;

  return phaseEvents
    .filter((phaseEvent) =>
      phaseEvent.sessionNumber === sessionNumber
      && typeof phaseEvent.documentNumber === "number"
      && Boolean(phaseEvent.decisionStatus),
    )
    .sort((left, right) => (left.documentNumber || 0) - (right.documentNumber || 0))
    .map((phaseEvent) => ({
      documentNumber: phaseEvent.documentNumber || 0,
      documentName: phaseDocs[(phaseEvent.documentNumber || 1) - 1]?.name || `Dokumen ${phaseEvent.documentNumber || "-"}`,
      status: phaseEvent.decisionStatus!,
      note: phaseEvent.note,
      date: phaseEvent.date,
      time: phaseEvent.time,
    }));
};

const hasRevisionEntries = (entries: SessionEntry[]): boolean =>
  getRevisionEntries(entries).length > 0;

const buildPengajuanItems = (eventsAsc: TimelineEvent[]): TimelineHistoryItem[] => {
  const items: TimelineHistoryItem[] = [];

  const createdEvent = findFirstEvent(
    eventsAsc,
    (event) => event.phase === "PENGAJUAN" || (!event.phase && event.description.toLowerCase().includes("dibuat")),
  );

  if (createdEvent) {
    items.push({
      key: `pengajuan-created-${createdEvent.date}-${createdEvent.time}`,
      title: "Permohonan Dikirim",
      description: "",
      date: createdEvent.date,
      time: createdEvent.time,
      tone: "success",
      actorLabel: buildActorLabel("Dicatat oleh", getActorDisplayName(createdEvent.actor, "submission")),
    });
  }

  const confirmedEvent = findLastEvent(
    eventsAsc,
    (event) => event.phase === "PENGAJUAN" && event.description.toLowerCase().includes("dikonfirmasi"),
  );

  if (confirmedEvent) {
    items.push({
      key: `pengajuan-confirmed-${confirmedEvent.date}-${confirmedEvent.time}`,
      title: "Menunggu Verifikasi K/L",
      description: "Persyaratan sudah lengkap dan akan diverifikasi oleh K/L - Verifikator - Kementerian Ketenagakerjaan.",
      date: confirmedEvent.date,
      time: confirmedEvent.time,
      tone: "success",
      actorLabel: buildActorLabel("Dikonfirmasi oleh", getActorDisplayName(confirmedEvent.actor, "confirmation")),
    });
  }

  return items;
};

const buildVerificationSummaryItem = (
  event: TimelineEvent,
  sessionEntries: SessionEntry[],
): TimelineHistoryItem => {
  const hasRevision = hasRevisionEntries(sessionEntries);

  return {
    key: `verification-session-${event.sessionNumber || 1}-${event.date}-${event.time}`,
    title: hasRevision ? "Permohonan Perlu Diperbaiki" : "Verifikasi Dokumen Selesai",
    description: hasRevision
      ? "Pelaku Usaha perlu memperbaiki dokumen persyaratan sesuai catatan verifikator."
      : "Seluruh dokumen pada tahap verifikasi telah dinyatakan sesuai persyaratan dan proses dilanjutkan ke tahap peninjauan.",
    date: event.date,
    time: event.time,
    tone: hasRevision ? "revision" : "success",
    note: hasRevision ? formatRevisionNote(sessionEntries) : undefined,
    actorLabel: buildActorLabel("Diverifikasi oleh", getActorDisplayName(event.actor, "verification")),
  };
};

const buildReviewSummaryItem = (
  event: TimelineEvent,
  sessionEntries: SessionEntry[],
): TimelineHistoryItem => {
  const hasRevision = hasRevisionEntries(sessionEntries);

  return {
    key: `review-session-${event.sessionNumber || 1}-${event.date}-${event.time}`,
    title: hasRevision ? "Permohonan Perlu Diperbaiki" : "Peninjauan Dokumen Selesai",
    description: hasRevision
      ? "Pelaku Usaha perlu memperbaiki dokumen persyaratan sesuai catatan verifikator."
      : "Seluruh dokumen pada tahap peninjauan telah dinyatakan sesuai dan proses dilanjutkan ke tahap persetujuan.",
    date: event.date,
    time: event.time,
    tone: hasRevision ? "revision" : "success",
    note: hasRevision ? formatRevisionNote(sessionEntries) : undefined,
    actorLabel: buildActorLabel("Diverifikasi oleh", getActorDisplayName(event.actor, "verification")),
  };
};

const buildUploadItem = (
  event: TimelineEvent,
  phase: "VERIFIKASI" | "PENINJAUAN",
): TimelineHistoryItem => {
  if (phase === "VERIFIKASI") {
    return {
      key: `upload-${phase}-${event.documentNumber || 0}-${event.date}-${event.time}-${event.description}`,
      title: "Menunggu Verifikasi K/L",
      description: "Persyaratan sudah lengkap dan akan diverifikasi oleh K/L - Verifikator - Kementerian Ketenagakerjaan.",
      date: event.date,
      time: event.time,
      tone: "success",
      actorLabel: buildActorLabel("Diunggah oleh", getActorDisplayName(event.actor, "upload")),
    };
  }

  return {
    key: `upload-${phase}-${event.documentNumber || 0}-${event.date}-${event.time}-${event.description}`,
    title: "Menunggu Peninjauan Dokumen",
    description: "Dokumen perbaikan sudah lengkap dan menunggu peninjauan ulang oleh K/L - Verifikator.",
    date: event.date,
    time: event.time,
    tone: "success",
    actorLabel: buildActorLabel("Diunggah oleh", getActorDisplayName(event.actor, "upload")),
  };
};

const buildApprovalItem = (event: TimelineEvent, submission: SubmissionData): TimelineHistoryItem => ({
  key: `approval-${event.date}-${event.time}`,
  title: "Data Persetujuan Telah Disimpan",
  description: "Data persetujuan, nomor izin PB UMKU, dan draft SK telah disiapkan untuk proses penetapan pada tahap Izin Terbit.",
  date: event.date,
  time: event.time,
  tone: "success",
  note: [
    `Tanggal Persetujuan: ${submission.approvalDate || "-"}`,
    `Nomor Izin PB UMKU: ${submission.licenseNumber || "-"}`,
    `Draft SK: ${submission.skFileName || "-"}`,
  ].join("\n"),
  actorLabel: buildActorLabel("Diproses oleh", getActorDisplayName(event.actor, "approval")),
});

const buildIssuedItem = (event: TimelineEvent, submission: SubmissionData): TimelineHistoryItem => ({
  key: `issued-${event.date}-${event.time}`,
  title: "Izin PB UMKU Diterbitkan",
  description: `Izin PB UMKU telah diterbitkan dan status izin ditetapkan sebagai ${submission.licenseStatus || "-"}.`,
  date: event.date,
  time: event.time,
  tone: "success",
  note: [
    `Nomor Izin PB UMKU: ${submission.licenseNumber || "-"}`,
    `Tanggal Terbit: ${submission.licenseDate || "-"}`,
    `Status Izin: ${submission.licenseStatus || "-"}`,
  ].join("\n"),
  actorLabel: buildActorLabel("Ditetapkan oleh", getActorDisplayName(event.actor, "issuance")),
});

const buildStageStartItem = (
  phase: WorkflowPhase,
  sourceEvent: TimelineEvent | undefined,
): TimelineHistoryItem | null => {
  if (!sourceEvent) return null;

  if (phase === "VERIFIKASI") {
    return {
      key: `start-verification-${sourceEvent.date}-${sourceEvent.time}`,
      title: "Menunggu Verifikasi K/L",
      description: "Persyaratan sudah lengkap dan akan diverifikasi oleh K/L - Verifikator - Kementerian Ketenagakerjaan.",
      date: sourceEvent.date,
      time: sourceEvent.time,
      tone: "success",
      actorLabel: buildActorLabel("Dikonfirmasi oleh", getActorDisplayName(sourceEvent.actor, "confirmation")),
    };
  }

  if (phase === "PENINJAUAN") {
    return {
      key: `start-review-${sourceEvent.date}-${sourceEvent.time}`,
      title: "Menunggu Peninjauan Dokumen",
      description: "Tahap verifikasi telah selesai dan permohonan masuk ke proses peninjauan dokumen lanjutan.",
      date: sourceEvent.date,
      time: sourceEvent.time,
      tone: "success",
      actorLabel: buildActorLabel("Diteruskan oleh", getActorDisplayName(sourceEvent.actor, "verification")),
    };
  }

  if (phase === "PERSETUJUAN") {
    return {
      key: `start-approval-${sourceEvent.date}-${sourceEvent.time}`,
      title: "Menunggu Persetujuan",
      description: "Tahap peninjauan telah selesai dan data persetujuan sedang disiapkan untuk penetapan izin.",
      date: sourceEvent.date,
      time: sourceEvent.time,
      tone: "success",
      actorLabel: buildActorLabel("Diteruskan oleh", getActorDisplayName(sourceEvent.actor, "review")),
    };
  }

  if (phase === "IZIN_TERBIT") {
    return {
      key: `start-issued-${sourceEvent.date}-${sourceEvent.time}`,
      title: "Menunggu Penetapan Izin",
      description: "Draft izin telah tersedia dan sedang menunggu penetapan status izin pada tahap akhir proses permohonan.",
      date: sourceEvent.date,
      time: sourceEvent.time,
      tone: "success",
      actorLabel: buildActorLabel("Diproses oleh", getActorDisplayName(sourceEvent.actor, "approval")),
    };
  }

  return null;
};

const sortHistoryItems = (items: TimelineHistoryItem[]): TimelineHistoryItem[] => (
  [...items].sort((left, right) => {
    const leftDate = parseTimelineDateValue(left.date);
    const rightDate = parseTimelineDateValue(right.date);
    if (leftDate !== rightDate) return rightDate - leftDate;

    const leftTime = parseTimelineTimeValue(left.time);
    const rightTime = parseTimelineTimeValue(right.time);
    if (leftTime !== rightTime) return rightTime - leftTime;

    return 0;
  })
);

const buildPhaseHistoryItems = (
  submission: SubmissionData,
  activePhase: WorkflowPhase,
): TimelineHistoryItem[] => {
  const eventsAsc = sortEvents(submission.timeline, "asc");

  if (activePhase === "PENGAJUAN") {
    return sortHistoryItems(buildPengajuanItems(eventsAsc));
  }

  const items: TimelineHistoryItem[] = [];
  const phaseEvents = eventsAsc.filter((event) => event.phase === activePhase);
  const phaseDocs = activePhase === "VERIFIKASI"
    ? submission.documents
    : activePhase === "PENINJAUAN"
      ? submission.reviewDocuments
      : submission.documents;

  const stageStartSource =
    activePhase === "VERIFIKASI"
      ? findLastEvent(
        eventsAsc,
        (event) => event.phase === "PENGAJUAN" && event.description.toLowerCase().includes("verifikasi"),
      )
      : activePhase === "PENINJAUAN"
        ? findLastEvent(
          eventsAsc,
          (event) => {
            if (!isSessionSummaryEvent(event, "VERIFIKASI")) return false;
            const sessionEntries = getSessionEntries(event, eventsAsc.filter((item) => item.phase === "VERIFIKASI"), submission.documents);
            return !hasRevisionEntries(sessionEntries);
          },
        )
        : activePhase === "PERSETUJUAN"
          ? findLastEvent(
            eventsAsc,
            (event) => {
              if (!isSessionSummaryEvent(event, "PENINJAUAN")) return false;
              const sessionEntries = getSessionEntries(event, eventsAsc.filter((item) => item.phase === "PENINJAUAN"), submission.reviewDocuments);
              return !hasRevisionEntries(sessionEntries);
            },
          )
          : findLastEvent(eventsAsc, (event) => event.phase === "PERSETUJUAN");

  const stageStartItem = buildStageStartItem(activePhase, stageStartSource);
  const createdEvent = findFirstEvent(
    eventsAsc,
    (event) => event.phase === "PENGAJUAN" || (!event.phase && event.description.toLowerCase().includes("dibuat")),
  );

  if (createdEvent) {
    items.push({
      key: `pengajuan-created-${createdEvent.date}-${createdEvent.time}`,
      title: "Permohonan Dikirim",
      description: "",
      date: createdEvent.date,
      time: createdEvent.time,
      tone: "success",
      actorLabel: buildActorLabel("Dicatat oleh", getActorDisplayName(createdEvent.actor, "submission")),
    });
  }

  if (stageStartItem) items.push(stageStartItem);

  if (activePhase === "VERIFIKASI" || activePhase === "PENINJAUAN") {
    phaseEvents.forEach((event) => {
      if (event.actor === "Pemohon" && event.type === "info") {
        items.push(buildUploadItem(event, activePhase));
        return;
      }

      if (isSessionSummaryEvent(event, activePhase)) {
        const sessionEntries = getSessionEntries(event, phaseEvents, phaseDocs);
        items.push(
          activePhase === "VERIFIKASI"
            ? buildVerificationSummaryItem(event, sessionEntries)
            : buildReviewSummaryItem(event, sessionEntries),
        );
      }
    });
  }

  if (activePhase === "PERSETUJUAN") {
    const approvalEvent = findLastEvent(eventsAsc, (event) => event.phase === "PERSETUJUAN");
    if (approvalEvent) {
      items.push(buildApprovalItem(approvalEvent, submission));
    }
  }

  if (activePhase === "IZIN_TERBIT") {
    const issuedEvent = findLastEvent(eventsAsc, (event) => event.phase === "IZIN_TERBIT");
    if (issuedEvent) {
      items.push(buildIssuedItem(issuedEvent, submission));
    }
  }

  return sortHistoryItems(items);
};

const Timeline = ({ submission, activePhase }: TimelineProps) => {
  const items = useMemo(
    () => buildPhaseHistoryItems(submission, activePhase),
    [activePhase, submission],
  );

  if (items.length === 0) {
    return (
      <div className="app-surface-card p-4 sm:p-6 transition-shadow duration-300">
        <h2 className="app-section-title text-lg sm:text-xl mb-4 flex items-center gap-2">
          <Clock3 className="w-5 h-5 text-primary" />
          Riwayat Permohonan
        </h2>
        <EmptyState
          icon={Clock3}
          title="Belum ada riwayat proses pada tahap ini"
          description={`Riwayat untuk tahap ${getWorkflowPhaseLabel(activePhase)} akan ditampilkan setelah terdapat proses yang relevan.`}
          compact
          className="rounded-2xl border border-slate-200 bg-slate-50/60"
        />
      </div>
    );
  }

  return (
    <div className="app-surface-card relative flex max-h-[520px] flex-col self-start overflow-hidden p-4 transition-shadow duration-300 sm:max-h-[620px] sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/10">
          <Clock3 className="h-4 w-4" />
        </span>
        <h2 className="app-section-title text-lg sm:text-xl">Riwayat Permohonan</h2>
      </div>

      <div className="mb-4 flex items-center gap-2 text-xs font-medium text-slate-500">
        <span>Diurutkan dari terbaru ke terlama</span>
      </div>

      <div className="relative flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar">
        <div className="relative pl-1">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.08 },
              },
            }}
            className="space-y-6"
          >
            {items.map((item, itemIndex) => {
              const config = toneConfig[item.tone];
              const shouldShowNoteBox = item.tone === "revision" && Boolean(item.note);
              const isLastItem = itemIndex === items.length - 1;

              return (
                <motion.article
                  key={item.key}
                  variants={{
                    hidden: { opacity: 0, y: 12 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.24 } },
                  }}
                  className="relative pl-11"
                >
                  {!isLastItem ? (
                    <span
                      aria-hidden="true"
                      className="absolute -bottom-6 left-[15px] top-9 w-px bg-status-completed/50"
                    />
                  ) : null}
                  <div className={`absolute left-0 top-0.5 flex h-8 w-8 items-center justify-center rounded-full ${config.markerClass}`}>
                    <config.icon className="h-4 w-4 stroke-[2.4]" />
                  </div>

                  <div>
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <h3 className="text-sm font-semibold leading-snug text-slate-800">
                          {item.title}
                        </h3>
                        <span className="text-xs font-medium text-slate-500">
                          {formatTimestampLabel(item.date, item.time)}
                        </span>
                      </div>

                      {item.description ? (
                        <p className="text-sm leading-relaxed text-slate-600">
                          {item.description}
                        </p>
                      ) : null}
                    </div>

                    {shouldShowNoteBox ? (
                      <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-none">
                        <p className="text-xs font-medium text-slate-700">
                          Catatan:
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                          {item.note}
                        </p>
                        {item.actorLabel ? (
                          <div className="mt-3 border-t border-slate-200 pt-3 text-xs font-medium text-slate-500">
                            {item.actorLabel}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </motion.article>
              );
            })}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Timeline;
