import crypto from "node:crypto";

const TOKEN_TTL_MS = 1000 * 60 * 60 * 2;
const TOKEN_PURPOSE = "revision-upload";

export type PublicRevisionUploadTokenPayload = {
  purpose: typeof TOKEN_PURPOSE;
  submissionId: string;
  phase: "VERIFIKASI" | "PENINJAUAN";
  documentNumber: number;
  exp: number;
};

const getSecret = () =>
  process.env.PUBLIC_ACTION_SECRET?.trim()
  || process.env.ADMIN_SESSION_SECRET?.trim()
  || "";

const base64UrlEncode = (value: string) =>
  Buffer.from(value, "utf8").toString("base64url");

const base64UrlDecode = (value: string) =>
  Buffer.from(value, "base64url").toString("utf8");

const sign = (payload: string) =>
  crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url");

export const createPublicRevisionUploadToken = ({
  submissionId,
  phase,
  documentNumber,
}: Pick<PublicRevisionUploadTokenPayload, "submissionId" | "phase" | "documentNumber">) => {
  if (!getSecret()) return "";

  const payload: PublicRevisionUploadTokenPayload = {
    purpose: TOKEN_PURPOSE,
    submissionId,
    phase,
    documentNumber,
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload)}`;
};

export const verifyPublicRevisionUploadToken = (
  token: unknown,
  expected: Pick<PublicRevisionUploadTokenPayload, "submissionId" | "phase" | "documentNumber">,
) => {
  if (typeof token !== "string" || !token || !getSecret()) return false;

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return false;

  const expectedSignature = sign(encodedPayload);
  if (expectedSignature.length !== signature.length) return false;

  const isValidSignature = crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(signature),
  );
  if (!isValidSignature) return false;

  try {
    const parsed = JSON.parse(base64UrlDecode(encodedPayload)) as Partial<PublicRevisionUploadTokenPayload>;
    return parsed.purpose === TOKEN_PURPOSE
      && parsed.submissionId === expected.submissionId
      && parsed.phase === expected.phase
      && parsed.documentNumber === expected.documentNumber
      && typeof parsed.exp === "number"
      && parsed.exp >= Date.now();
  } catch {
    return false;
  }
};
