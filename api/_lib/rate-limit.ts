import type { ApiRequestWithHeaders, ApiResponseLike } from "./http.js";
import { getClientIp, sendError } from "./http.js";

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitBucket>();

export const enforceRateLimit = (
  req: ApiRequestWithHeaders,
  res: ApiResponseLike,
  {
    key,
    limit,
    windowMs,
  }: {
    key: string;
    limit: number;
    windowMs: number;
  },
) => {
  const now = Date.now();
  const clientKey = `${key}:${getClientIp(req)}`;
  const currentBucket = buckets.get(clientKey);

  if (!currentBucket || currentBucket.resetAt <= now) {
    buckets.set(clientKey, {
      count: 1,
      resetAt: now + windowMs,
    });
    return true;
  }

  if (currentBucket.count >= limit) {
    res.setHeader("Retry-After", String(Math.ceil((currentBucket.resetAt - now) / 1000)));
    sendError(res, 429, "Terlalu banyak permintaan. Silakan coba beberapa saat lagi.");
    return false;
  }

  currentBucket.count += 1;
  return true;
};
