export type ApiResponseLike = {
  status: (code: number) => ApiResponseLike;
  setHeader: (name: string, value: string) => void;
  send: (body: string) => void;
};

type ApiRequestLike = {
  body?: unknown;
  headers?: Record<string, unknown>;
};

export type ApiRequestWithHeaders = ApiRequestLike & {
  method?: string;
  url?: string;
  query?: Record<string, unknown>;
};

export const sendJson = (res: ApiResponseLike, status: number, payload: unknown) => {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.send(JSON.stringify(payload));
};

export const sendError = (res: ApiResponseLike, status: number, message: string, details?: unknown) =>
  sendJson(res, status, {
    error: message,
    ...(details ? { details } : {}),
  });

export const readJsonBody = (req: ApiRequestLike) => {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
};

export const setCommonHeaders = (res: ApiResponseLike) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
};

export const getClientIp = (req: ApiRequestWithHeaders) => {
  const forwardedFor = req.headers?.["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = req.headers?.["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim()) return realIp.trim();

  return "unknown";
};

export const getUserAgent = (req: ApiRequestWithHeaders) => {
  const userAgent = req.headers?.["user-agent"];
  return typeof userAgent === "string" ? userAgent.slice(0, 500) : "";
};
