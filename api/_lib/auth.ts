import crypto from "node:crypto";
import { sendError } from "./http.js";

const TOKEN_TTL_MS = 1000 * 60 * 60 * 12;

const getSecret = () => process.env.ADMIN_SESSION_SECRET?.trim() || "";

const base64UrlEncode = (value: string) =>
  Buffer.from(value, "utf8").toString("base64url");

const base64UrlDecode = (value: string) =>
  Buffer.from(value, "base64url").toString("utf8");

const sign = (payload: string) =>
  crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url");

export const isAdminAuthConfigured = () =>
  Boolean(
    process.env.ADMIN_EMAIL?.trim()
    && process.env.ADMIN_PASSWORD?.trim()
    && getSecret(),
  );

export const validateAdminCredentials = (email: string, password: string) => {
  const configuredEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const configuredPassword = process.env.ADMIN_PASSWORD?.trim();

  return Boolean(
    configuredEmail
    && configuredPassword
    && email.trim().toLowerCase() === configuredEmail
    && password.trim() === configuredPassword,
  );
};

export const createAdminSessionToken = (email: string) => {
  const payload = JSON.stringify({
    email: email.trim().toLowerCase(),
    exp: Date.now() + TOKEN_TTL_MS,
  });
  const encodedPayload = base64UrlEncode(payload);
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
};

export const verifyAdminSessionToken = (token?: string | null) => {
  if (!token || !getSecret()) return null;

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = sign(encodedPayload);
  const isSameLength = expectedSignature.length === signature.length;
  if (!isSameLength) return null;

  const isValidSignature = crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(signature),
  );
  if (!isValidSignature) return null;

  try {
    const parsed = JSON.parse(base64UrlDecode(encodedPayload)) as {
      email?: string;
      exp?: number;
    };
    if (!parsed.email || !parsed.exp || parsed.exp < Date.now()) return null;
    return {
      email: parsed.email,
      expiresAt: parsed.exp,
    };
  } catch {
    return null;
  }
};

export const getBearerToken = (req) => {
  const authorization = req.headers.authorization || req.headers.Authorization;
  if (typeof authorization === "string" && authorization.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim();
  }

  const fallbackHeader = req.headers["x-admin-token"];
  if (typeof fallbackHeader === "string") return fallbackHeader.trim();

  return "";
};

export const requireAdminSession = (req, res) => {
  if (!isAdminAuthConfigured()) {
    sendError(res, 500, "Konfigurasi admin backend belum lengkap.");
    return null;
  }

  const session = verifyAdminSessionToken(getBearerToken(req));
  if (!session) {
    sendError(res, 401, "Sesi admin tidak valid atau sudah kedaluwarsa.");
    return null;
  }

  return session;
};
