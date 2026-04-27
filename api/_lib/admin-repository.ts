import crypto from "node:crypto";
import { count, eq } from "drizzle-orm";
import { admins } from "../../db/schema.js";
import { ensureSchemaReady, getDb, isDatabaseConfigured } from "./db.js";

const PASSWORD_HASH_ALGORITHM = "sha256";
const PASSWORD_HASH_ITERATIONS = 120000;
const PASSWORD_HASH_KEY_LENGTH = 32;

type AdminAccount = {
  id: string;
  email: string;
  fullName: string | null;
  passwordHash: string;
  isActive: boolean;
};

const createAdminId = () =>
  `admin_${crypto.randomUUID().replace(/-/g, "")}`;

export const normalizeAdminEmail = (email: string) =>
  email.trim().toLowerCase();

export const hashAdminPassword = (password: string) => {
  const salt = crypto.randomBytes(16).toString("base64url");
  const hash = crypto
    .pbkdf2Sync(password, salt, PASSWORD_HASH_ITERATIONS, PASSWORD_HASH_KEY_LENGTH, PASSWORD_HASH_ALGORITHM)
    .toString("base64url");

  return `pbkdf2_${PASSWORD_HASH_ALGORITHM}$${PASSWORD_HASH_ITERATIONS}$${salt}$${hash}`;
};

export const verifyAdminPassword = (password: string, storedHash: string) => {
  const [algorithmName, iterationsValue, salt, expectedHash] = storedHash.split("$");
  const algorithm = algorithmName?.replace("pbkdf2_", "");
  const iterations = Number(iterationsValue);

  if (algorithm !== PASSWORD_HASH_ALGORITHM || !iterations || !salt || !expectedHash) {
    return false;
  }

  const hash = crypto
    .pbkdf2Sync(password, salt, iterations, PASSWORD_HASH_KEY_LENGTH, algorithm)
    .toString("base64url");

  const expected = Buffer.from(expectedHash);
  const actual = Buffer.from(hash);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
};

export const countAdminAccounts = async () => {
  if (!isDatabaseConfigured()) return 0;

  await ensureSchemaReady();
  const db = getDb();
  const rows = await db.select({ value: count() }).from(admins);
  return Number(rows[0]?.value || 0);
};

export const findAdminByEmail = async (email: string): Promise<AdminAccount | null> => {
  if (!isDatabaseConfigured()) return null;

  await ensureSchemaReady();
  const db = getDb();
  const rows = await db
    .select()
    .from(admins)
    .where(eq(admins.email, normalizeAdminEmail(email)))
    .limit(1);

  const admin = rows[0];
  if (!admin?.passwordHash) return null;

  return {
    id: admin.id,
    email: admin.email,
    fullName: admin.fullName || null,
    passwordHash: admin.passwordHash,
    isActive: admin.isActive,
  };
};

export const createAdminAccount = async (input: {
  email: string;
  password: string;
  fullName?: string;
}) => {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL belum dikonfigurasi.");
  }

  await ensureSchemaReady();
  const now = new Date();
  const normalizedEmail = normalizeAdminEmail(input.email);
  const db = getDb();
  const rows = await db
    .insert(admins)
    .values({
      id: createAdminId(),
      email: normalizedEmail,
      passwordHash: hashAdminPassword(input.password),
      fullName: input.fullName?.trim() || null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    .returning({
      id: admins.id,
      email: admins.email,
      fullName: admins.fullName,
      isActive: admins.isActive,
    });

  return rows[0];
};
