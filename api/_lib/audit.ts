import { auditLogs } from "../../db/schema.js";
import { ensureSchemaReady, getDb, isDatabaseConfigured } from "./db.js";
import { getClientIp, getUserAgent, type ApiRequestWithHeaders } from "./http.js";

type AuditInput = {
  actor: string;
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
};

const createAuditId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const sanitizeMetadata = (metadata: Record<string, unknown> = {}) => {
  const blockedKeys = new Set(["password", "token", "publicActionToken", "dataBase64"]);

  return Object.fromEntries(
    Object.entries(metadata).filter(([key]) => !blockedKeys.has(key)),
  );
};

export const writeAuditLog = async (
  req: ApiRequestWithHeaders,
  input: AuditInput,
) => {
  if (!isDatabaseConfigured()) return;

  try {
    await ensureSchemaReady();
    const db = getDb();
    await db.insert(auditLogs).values({
      id: createAuditId(),
      actor: input.actor.slice(0, 255) || "unknown",
      action: input.action.slice(0, 120),
      targetType: input.targetType.slice(0, 64),
      targetId: (input.targetId || "").slice(0, 120),
      ipAddress: getClientIp(req).slice(0, 64),
      userAgent: getUserAgent(req),
      metadata: sanitizeMetadata(input.metadata),
    });
  } catch (error) {
    console.warn("Audit log write failed", error);
  }
};
