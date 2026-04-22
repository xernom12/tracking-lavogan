import type {
  DecisionStatus,
  Document,
  SessionEntry,
  TimelineEvent,
  WorkflowPhase,
} from "@/data/mockData";
import {
  formatDecisionDescription,
  formatSessionSummaryDescription,
} from "@/lib/submission-domain";

export interface SessionDecisionValidationOptions {
  requireRevisionNote: boolean;
  requireRevisionNoteForDocNumbers?: number[];
}

export interface NormalizedSessionDecision {
  status: DecisionStatus;
  note?: string;
}

export const normalizeSessionDecisions = (
  decisions: NormalizedSessionDecision[],
  expectedLength: number,
  options: SessionDecisionValidationOptions,
): NormalizedSessionDecision[] | null => {
  if (!Array.isArray(decisions) || decisions.length !== expectedLength) {
    return null;
  }

  const requiredNoteDocNumbers = new Set(options.requireRevisionNoteForDocNumbers || []);
  const normalized: NormalizedSessionDecision[] = [];

  for (let index = 0; index < decisions.length; index += 1) {
    const decision = decisions[index];
    if (decision.status !== "approved" && decision.status !== "revision_required") {
      return null;
    }

    const cleanNote = decision.note?.trim();
    const docNumber = index + 1;
    const requiresNote = options.requireRevisionNote || requiredNoteDocNumbers.has(docNumber);

    if (requiresNote && decision.status === "revision_required" && !cleanNote) {
      return null;
    }

    normalized.push({
      status: decision.status,
      note: cleanNote || undefined,
    });
  }

  return normalized;
};

export const getNextSessionNumber = (
  timeline: TimelineEvent[],
  phase: WorkflowPhase,
): number => {
  const maxSession = timeline.reduce((max, event) => {
    if (event.phase !== phase) return max;

    const session = event.sessionNumber || event.reviewCycle || 1;
    return Math.max(max, session);
  }, 0);

  return maxSession + 1;
};

export const createSessionDecisionEvents = (
  phase: "VERIFIKASI" | "PENINJAUAN",
  sessionNumber: number,
  decisions: NormalizedSessionDecision[],
  docs: Document[],
  timestamp: { date: string; time: string },
  actor: string,
): TimelineEvent[] =>
  decisions.map((decision, index) => ({
    date: timestamp.date,
    time: timestamp.time,
    actor,
    phase,
    sessionNumber,
    documentNumber: index + 1,
    decisionStatus: decision.status,
    note: decision.note,
    description: formatDecisionDescription(docs[index].name, decision.status, decision.note),
    type: decision.status === "approved" ? "success" : "error",
  }));

export const createSessionSnapshotEntries = (
  decisions: NormalizedSessionDecision[],
  docs: Document[],
  timestamp: { date: string; time: string },
): SessionEntry[] =>
  decisions.map((decision, index) => ({
    documentNumber: index + 1,
    documentName: docs[index].name,
    status: decision.status,
    note: decision.note,
    date: timestamp.date,
    time: timestamp.time,
  }));

export const createSessionSummaryEvent = (
  phase: "VERIFIKASI" | "PENINJAUAN",
  sessionNumber: number,
  decisions: NormalizedSessionDecision[],
  docs: Document[],
  timestamp: { date: string; time: string },
  actor: string,
  hasRevision: boolean,
): TimelineEvent => ({
  date: timestamp.date,
  time: timestamp.time,
  actor,
  phase,
  sessionNumber,
  sessionEntries: createSessionSnapshotEntries(decisions, docs, timestamp),
  description: formatSessionSummaryDescription(phase, sessionNumber, hasRevision),
  type: hasRevision ? "warning" : "success",
});
