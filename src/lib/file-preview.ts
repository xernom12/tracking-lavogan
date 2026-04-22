export interface MetadataPreviewInput {
  title: string;
  fileName: string;
  fileSizeBytes: number;
  extraLines?: string[];
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";

  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;

  return `${(kb / 1024).toFixed(2)} MB`;
};

export const buildMetadataPreviewHref = ({
  title,
  fileName,
  fileSizeBytes,
  extraLines = [],
}: MetadataPreviewInput) => {
  const lines = [
    fileName,
    `${formatBytes(fileSizeBytes)} | Terupload`,
    ...extraLines,
  ];

  const html = `<!doctype html><html><head><meta charset="utf-8" /><title>${escapeHtml(title)}</title><style>body{font-family:Segoe UI,Arial,sans-serif;padding:24px;color:#0f172a;background:#f8fafc} .card{max-width:720px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:20px;padding:24px;box-shadow:0 10px 30px rgba(15,23,42,.06)} h1{margin:0 0 16px;font-size:20px} pre{white-space:pre-wrap;line-height:1.7;margin:0;font-size:14px;color:#475569}</style></head><body><div class="card"><h1>${escapeHtml(title)}</h1><pre>${escapeHtml(lines.join("\n"))}</pre></div></body></html>`;

  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
};

export const buildTextDownloadHref = (lines: string[]) =>
  `data:text/plain;charset=utf-8,${encodeURIComponent(lines.join("\n"))}`;

export const openPreviewWindow = (href: string) => {
  if (!href || typeof window === "undefined") return;
  window.open(href, "_blank", "noopener,noreferrer");
};
