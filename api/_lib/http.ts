type ApiResponseLike = {
  status: (code: number) => ApiResponseLike;
  setHeader: (name: string, value: string) => void;
  send: (body: string) => void;
};

type ApiRequestLike = {
  body?: unknown;
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
