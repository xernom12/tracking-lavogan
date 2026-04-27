import { boolean, index, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import type { AdminSubmission } from "../src/lib/submission-types.js";

export const admins = pgTable(
  "admins",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    fullName: varchar("full_name", { length: 255 }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    emailIdx: index("admins_email_idx").on(table.email),
  }),
);

export const submissionSnapshots = pgTable(
  "submission_snapshots",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    submissionNumber: varchar("submission_number", { length: 120 }).notNull().unique(),
    submissionType: varchar("submission_type", { length: 32 }).notNull(),
    organizationName: varchar("organization_name", { length: 255 }).notNull(),
    nib: varchar("nib", { length: 32 }).notNull(),
    kbli: varchar("kbli", { length: 16 }).notNull(),
    ossStatus: varchar("oss_status", { length: 120 }).notNull(),
    licenseIssued: boolean("license_issued").notNull().default(false),
    licenseStatus: varchar("license_status", { length: 32 }).notNull().default(""),
    lastUpdatedLabel: varchar("last_updated_label", { length: 120 }).notNull(),
    payload: jsonb("payload").$type<AdminSubmission>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    organizationIdx: index("submission_snapshots_organization_idx").on(table.organizationName),
    nibIdx: index("submission_snapshots_nib_idx").on(table.nib),
    statusIdx: index("submission_snapshots_status_idx").on(table.ossStatus),
    updatedIdx: index("submission_snapshots_updated_idx").on(table.updatedAt),
  }),
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    actor: varchar("actor", { length: 255 }).notNull(),
    action: varchar("action", { length: 120 }).notNull(),
    targetType: varchar("target_type", { length: 64 }).notNull(),
    targetId: varchar("target_id", { length: 120 }).notNull().default(""),
    ipAddress: varchar("ip_address", { length: 64 }).notNull().default("unknown"),
    userAgent: varchar("user_agent", { length: 500 }).notNull().default(""),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    actorIdx: index("audit_logs_actor_idx").on(table.actor),
    actionIdx: index("audit_logs_action_idx").on(table.action),
    targetIdx: index("audit_logs_target_idx").on(table.targetType, table.targetId),
    createdIdx: index("audit_logs_created_idx").on(table.createdAt),
  }),
);
