import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const submissionTypeEnum = pgEnum("submission_type", ["Baru", "Perpanjangan"]);
export const workflowPhaseEnum = pgEnum("workflow_phase", [
  "PENGAJUAN",
  "VERIFIKASI",
  "PENINJAUAN",
  "PERSETUJUAN",
  "IZIN_TERBIT",
]);
export const documentPhaseEnum = pgEnum("document_phase", ["VERIFIKASI", "PENINJAUAN"]);
export const documentStatusEnum = pgEnum("document_status", ["approved", "revision_required", "locked"]);
export const decisionStatusEnum = pgEnum("decision_status", ["approved", "revision_required"]);
export const licenseStatusEnum = pgEnum("license_status", ["Aktif", "Tidak Aktif"]);
export const timelineEventTypeEnum = pgEnum("timeline_event_type", ["info", "warning", "success", "error"]);
export const actorTypeEnum = pgEnum("actor_type", ["SYSTEM", "ADMIN", "PEMOHON"]);

export const admins = pgTable(
  "admins",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    fullName: varchar("full_name", { length: 255 }),
    passwordHash: text("password_hash"),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    emailUnique: uniqueIndex("admins_email_unique").on(table.email),
  }),
);

export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    submissionNumber: varchar("submission_number", { length: 64 }).notNull(),
    submissionType: submissionTypeEnum("submission_type").notNull(),
    organizationName: varchar("organization_name", { length: 255 }).notNull(),
    nib: varchar("nib", { length: 32 }).notNull(),
    kbli: varchar("kbli", { length: 16 }).notNull(),
    ossStatus: varchar("oss_status", { length: 100 }).notNull(),
    pengajuanDate: timestamp("pengajuan_date", { withTimezone: true }).notNull(),
    lastUpdatedAt: timestamp("last_updated_at", { withTimezone: true }).notNull().defaultNow(),
    pengajuanConfirmed: boolean("pengajuan_confirmed").notNull().default(false),
    verificationCompleted: boolean("verification_completed").notNull().default(false),
    reviewCompleted: boolean("review_completed").notNull().default(false),
    approvalCompleted: boolean("approval_completed").notNull().default(false),
    approvalDate: timestamp("approval_date", { withTimezone: true }),
    licenseIssued: boolean("license_issued").notNull().default(false),
    licenseStatus: licenseStatusEnum("license_status"),
    licenseNumber: varchar("license_number", { length: 100 }),
    licenseDate: timestamp("license_date", { withTimezone: true }),
    skFileName: varchar("sk_file_name", { length: 255 }),
    skFileSizeBytes: integer("sk_file_size_bytes"),
    reviewCycle: integer("review_cycle").notNull().default(1),
    reviewNotes: text("review_notes").notNull().default(""),
    verificationWorklistDocNumbers: jsonb("verification_worklist_doc_numbers")
      .$type<number[]>()
      .notNull()
      .default([]),
    lastRevisionCarryover: jsonb("last_revision_carryover").$type<{
      fromReviewCycle: number;
      worklistDocNumbers: number[];
      carriedAt: string;
    } | null>(),
    createdByAdminId: uuid("created_by_admin_id").references(() => admins.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    submissionNumberUnique: uniqueIndex("submissions_submission_number_unique").on(table.submissionNumber),
    nibIdx: index("submissions_nib_idx").on(table.nib),
    organizationIdx: index("submissions_organization_name_idx").on(table.organizationName),
    statusIdx: index("submissions_oss_status_idx").on(table.ossStatus),
  }),
);

export const submissionDocuments = pgTable(
  "submission_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    phase: documentPhaseEnum("phase").notNull(),
    documentNumber: integer("document_number").notNull(),
    documentName: varchar("document_name", { length: 255 }).notNull(),
    currentStatus: documentStatusEnum("current_status").notNull().default("locked"),
    currentNote: text("current_note"),
    isRequired: boolean("is_required").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    submissionPhaseDocUnique: uniqueIndex("submission_documents_submission_phase_doc_unique").on(
      table.submissionId,
      table.phase,
      table.documentNumber,
    ),
    phaseIdx: index("submission_documents_phase_idx").on(table.phase),
    statusIdx: index("submission_documents_status_idx").on(table.currentStatus),
  }),
);

export const documentStatusHistories = pgTable(
  "document_status_histories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    submissionDocumentId: uuid("submission_document_id")
      .notNull()
      .references(() => submissionDocuments.id, { onDelete: "cascade" }),
    status: documentStatusEnum("status").notNull(),
    note: text("note"),
    changedByAdminId: uuid("changed_by_admin_id").references(() => admins.id, {
      onDelete: "set null",
    }),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    documentChangedAtIdx: index("document_status_histories_changed_at_idx").on(table.changedAt),
  }),
);

export const revisionUploads = pgTable(
  "revision_uploads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    submissionDocumentId: uuid("submission_document_id")
      .notNull()
      .references(() => submissionDocuments.id, { onDelete: "cascade" }),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    phase: documentPhaseEnum("phase").notNull(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    fileSizeBytes: integer("file_size_bytes").notNull(),
    uploadedByActorType: actorTypeEnum("uploaded_by_actor_type").notNull().default("PEMOHON"),
    uploadedByAdminId: uuid("uploaded_by_admin_id").references(() => admins.id, {
      onDelete: "set null",
    }),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    submissionIdx: index("revision_uploads_submission_idx").on(table.submissionId),
    documentIdx: index("revision_uploads_document_idx").on(table.submissionDocumentId),
  }),
);

export const reviewSessions = pgTable(
  "review_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    phase: documentPhaseEnum("phase").notNull(),
    sessionNumber: integer("session_number").notNull(),
    hasRevision: boolean("has_revision").notNull().default(false),
    summaryDescription: text("summary_description"),
    reviewedByAdminId: uuid("reviewed_by_admin_id").references(() => admins.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    submissionPhaseSessionUnique: uniqueIndex("review_sessions_submission_phase_session_unique").on(
      table.submissionId,
      table.phase,
      table.sessionNumber,
    ),
    submissionPhaseIdx: index("review_sessions_submission_phase_idx").on(table.submissionId, table.phase),
  }),
);

export const reviewSessionEntries = pgTable(
  "review_session_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reviewSessionId: uuid("review_session_id")
      .notNull()
      .references(() => reviewSessions.id, { onDelete: "cascade" }),
    submissionDocumentId: uuid("submission_document_id")
      .notNull()
      .references(() => submissionDocuments.id, { onDelete: "cascade" }),
    documentNumber: integer("document_number").notNull(),
    documentName: varchar("document_name", { length: 255 }).notNull(),
    decisionStatus: decisionStatusEnum("decision_status").notNull(),
    note: text("note"),
    decidedAt: timestamp("decided_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    reviewSessionDocumentUnique: uniqueIndex("review_session_entries_session_document_unique").on(
      table.reviewSessionId,
      table.submissionDocumentId,
    ),
    statusIdx: index("review_session_entries_status_idx").on(table.decisionStatus),
  }),
);

export const approvalFinalizations = pgTable(
  "approval_finalizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    approvalDate: timestamp("approval_date", { withTimezone: true }).notNull(),
    pbUmkuNumber: varchar("pb_umku_number", { length: 100 }).notNull(),
    skFileName: varchar("sk_file_name", { length: 255 }).notNull(),
    skFileSizeBytes: integer("sk_file_size_bytes").notNull(),
    finalizedByAdminId: uuid("finalized_by_admin_id").references(() => admins.id, {
      onDelete: "set null",
    }),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    submissionUnique: uniqueIndex("approval_finalizations_submission_unique").on(table.submissionId),
    pbUmkuNumberUnique: uniqueIndex("approval_finalizations_pb_umku_number_unique").on(table.pbUmkuNumber),
  }),
);

export const licenseIssuances = pgTable(
  "license_issuances",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    status: licenseStatusEnum("status").notNull(),
    issuedByAdminId: uuid("issued_by_admin_id").references(() => admins.id, {
      onDelete: "set null",
    }),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    submissionUnique: uniqueIndex("license_issuances_submission_unique").on(table.submissionId),
  }),
);

export const timelineEvents = pgTable(
  "timeline_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    actorType: actorTypeEnum("actor_type").notNull().default("SYSTEM"),
    actorAdminId: uuid("actor_admin_id").references(() => admins.id, {
      onDelete: "set null",
    }),
    actorLabel: varchar("actor_label", { length: 255 }),
    phase: workflowPhaseEnum("phase"),
    sessionNumber: integer("session_number"),
    documentNumber: integer("document_number"),
    decisionStatus: decisionStatusEnum("decision_status"),
    reviewCycle: integer("review_cycle"),
    eventType: timelineEventTypeEnum("event_type").notNull(),
    description: text("description").notNull(),
    note: text("note"),
    happenedAt: timestamp("happened_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    submissionHappenedAtIdx: index("timeline_events_submission_happened_at_idx").on(
      table.submissionId,
      table.happenedAt,
    ),
    phaseIdx: index("timeline_events_phase_idx").on(table.phase),
  }),
);

export const adminsRelations = relations(admins, ({ many }) => ({
  submissionsCreated: many(submissions),
  documentStatusChanges: many(documentStatusHistories),
  uploadedRevisions: many(revisionUploads),
  reviewedSessions: many(reviewSessions),
  approvalFinalizations: many(approvalFinalizations),
  licenseIssuances: many(licenseIssuances),
  timelineEvents: many(timelineEvents),
}));

export const submissionsRelations = relations(submissions, ({ one, many }) => ({
  createdByAdmin: one(admins, {
    fields: [submissions.createdByAdminId],
    references: [admins.id],
  }),
  documents: many(submissionDocuments),
  reviewSessions: many(reviewSessions),
  revisionUploads: many(revisionUploads),
  approvalFinalization: one(approvalFinalizations, {
    fields: [submissions.id],
    references: [approvalFinalizations.submissionId],
  }),
  licenseIssuance: one(licenseIssuances, {
    fields: [submissions.id],
    references: [licenseIssuances.submissionId],
  }),
  timelineEvents: many(timelineEvents),
}));

export const submissionDocumentsRelations = relations(submissionDocuments, ({ one, many }) => ({
  submission: one(submissions, {
    fields: [submissionDocuments.submissionId],
    references: [submissions.id],
  }),
  statusHistories: many(documentStatusHistories),
  revisionUploads: many(revisionUploads),
  reviewSessionEntries: many(reviewSessionEntries),
}));

export const documentStatusHistoriesRelations = relations(documentStatusHistories, ({ one }) => ({
  submissionDocument: one(submissionDocuments, {
    fields: [documentStatusHistories.submissionDocumentId],
    references: [submissionDocuments.id],
  }),
  changedByAdmin: one(admins, {
    fields: [documentStatusHistories.changedByAdminId],
    references: [admins.id],
  }),
}));

export const revisionUploadsRelations = relations(revisionUploads, ({ one }) => ({
  submission: one(submissions, {
    fields: [revisionUploads.submissionId],
    references: [submissions.id],
  }),
  submissionDocument: one(submissionDocuments, {
    fields: [revisionUploads.submissionDocumentId],
    references: [submissionDocuments.id],
  }),
  uploadedByAdmin: one(admins, {
    fields: [revisionUploads.uploadedByAdminId],
    references: [admins.id],
  }),
}));

export const reviewSessionsRelations = relations(reviewSessions, ({ one, many }) => ({
  submission: one(submissions, {
    fields: [reviewSessions.submissionId],
    references: [submissions.id],
  }),
  reviewedByAdmin: one(admins, {
    fields: [reviewSessions.reviewedByAdminId],
    references: [admins.id],
  }),
  entries: many(reviewSessionEntries),
}));

export const reviewSessionEntriesRelations = relations(reviewSessionEntries, ({ one }) => ({
  reviewSession: one(reviewSessions, {
    fields: [reviewSessionEntries.reviewSessionId],
    references: [reviewSessions.id],
  }),
  submissionDocument: one(submissionDocuments, {
    fields: [reviewSessionEntries.submissionDocumentId],
    references: [submissionDocuments.id],
  }),
}));

export const approvalFinalizationsRelations = relations(approvalFinalizations, ({ one }) => ({
  submission: one(submissions, {
    fields: [approvalFinalizations.submissionId],
    references: [submissions.id],
  }),
  finalizedByAdmin: one(admins, {
    fields: [approvalFinalizations.finalizedByAdminId],
    references: [admins.id],
  }),
}));

export const licenseIssuancesRelations = relations(licenseIssuances, ({ one }) => ({
  submission: one(submissions, {
    fields: [licenseIssuances.submissionId],
    references: [submissions.id],
  }),
  issuedByAdmin: one(admins, {
    fields: [licenseIssuances.issuedByAdminId],
    references: [admins.id],
  }),
}));

export const timelineEventsRelations = relations(timelineEvents, ({ one }) => ({
  submission: one(submissions, {
    fields: [timelineEvents.submissionId],
    references: [submissions.id],
  }),
  actorAdmin: one(admins, {
    fields: [timelineEvents.actorAdminId],
    references: [admins.id],
  }),
}));
