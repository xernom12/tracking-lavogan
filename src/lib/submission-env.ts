export const REMOTE_API_FLAG = "VITE_ENABLE_REMOTE_STORAGE";
export const API_BASE_URL_FLAG = "VITE_API_BASE_URL";

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export const getApiBaseUrl = () => trimTrailingSlash(import.meta.env[API_BASE_URL_FLAG] || "");

export const isRemoteStorageEnabled = () =>
  import.meta.env.MODE !== "test"
  && import.meta.env[REMOTE_API_FLAG] === "true";

export const buildApiUrl = (path: string) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const baseUrl = getApiBaseUrl();
  return `${baseUrl}${normalizedPath}`;
};
