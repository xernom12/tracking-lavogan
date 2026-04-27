import crypto from "node:crypto";
import { sendError } from "./http.js";

const TOKEN_TTL_MS = 1000 * 60 * 60 * 12;
const TOKEN_TTL_SECONDS = TOKEN_TTL_MS / 1000;
const ADMIN_SESSION_COOKIE_NAME = "tracking_os_admin_session";

const getSecret = () => process.env.ADMIN_SESSION_SECRET?.trim() || "";

type AdminCredential = {
  email: string;
  password: string;
};

const base64UrlEncode = (value: string) =>
  Buffer.from(value, "utf8").toString("base64url");

const base64UrlDecode = (value: string) =>
  Buffer.from(value, "base64url").toString("utf8");

const sign = (payload: string) =>
  crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url");

const getConfiguredAdminCredentials = (): AdminCredential[] => {
  const credentials: AdminCredential[] = [];

  const appendCredential = (emailKey: string, passwordKey: string) => {
    const email = process.env[emailKey]?.trim().toLowerCase() || "";
    const password = process.env[passwordKey]?.trim() || "";
    if (!email || !password) return;

    credentials.push({ email, password });
  };

  appendCredential("ADMIN_EMAIL", "ADMIN_PASSWORD");

  Object.keys(process.env)
    .filter((key) => /^ADMIN_EMAIL_\d+$/.test(key))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
    .forEach((emailKey) => {
      const suffix = emailKey.replace("ADMIN_EMAIL_", "");
      appendCredential(emailKey, `ADMIN_PASSWORD_${suffix}`);
    });

  return credentials;
};

export const isAdminAuthConfigured = () =>
  Boolean(getConfiguredAdminCredentials().length > 0 && getSecret());

export const validateAdminCredentials = (email: string, password: string) => {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPassword = password.trim();

  return getConfiguredAdminCredentials().some(
    (credential) =>
      credential.email === normalizedEmail
      && credential.password === normalizedPassword,
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

const parseCookies = (cookieHeader: unknown): Record<string, string> => {
  if (typeof cookieHeader !== "string" || !cookieHeader.trim()) return {};

  return cookieHeader.split(";").reduce<Record<string, string>>((cookies, entry) => {
    const [rawName, ...rawValueParts] = entry.trim().split("=");
    if (!rawName) return cookies;

    cookies[rawName] = decodeURIComponent(rawValueParts.join("=") || "");
    return cookies;
  }, {});
};

const getCookieToken = (req) => {
  const cookies = parseCookies(req.headers.cookie || req.headers.Cookie);
  return cookies[ADMIN_SESSION_COOKIE_NAME] || "";
};

export const getAdminSessionToken = (req) => {
  const cookieToken = getCookieToken(req);
  if (cookieToken) return cookieToken;

  const authorization = req.headers.authorization || req.headers.Authorization;
  if (typeof authorization === "string" && authorization.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim();
  }

  const fallbackHeader = req.headers["x-admin-token"];
  if (typeof fallbackHeader === "string") return fallbackHeader.trim();

  return "";
};

export const setAdminSessionCookie = (res, token: string) => {
  const secure = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
  res.setHeader(
    "Set-Cookie",
    [
      `${ADMIN_SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      `Max-Age=${TOKEN_TTL_SECONDS}`,
      secure ? "Secure" : "",
    ].filter(Boolean).join("; "),
  );
};

export const clearAdminSessionCookie = (res) => {
  const secure = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
  res.setHeader(
    "Set-Cookie",
    [
      `${ADMIN_SESSION_COOKIE_NAME}=`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      "Max-Age=0",
      secure ? "Secure" : "",
    ].filter(Boolean).join("; "),
  );
};

export const requireAdminSession = (req, res) => {
  if (!isAdminAuthConfigured()) {
    sendError(res, 500, "Konfigurasi admin backend belum lengkap.");
    return null;
  }

  const session = verifyAdminSessionToken(getAdminSessionToken(req));
  if (!session) {
    sendError(res, 401, "Sesi admin tidak valid atau sudah kedaluwarsa.");
    return null;
  }

  return session;
};
