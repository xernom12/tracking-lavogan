import { put } from "@vercel/blob";

const slugify = (value: string) =>
  value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");

const decodeBase64Content = (value: string) => {
  const normalized = value.includes(",") ? value.split(",").pop() || "" : value;
  return Buffer.from(normalized, "base64");
};

export const uploadPdfToBlob = async ({
  folder,
  fileName,
  contentType,
  dataBase64,
}: {
  folder: string;
  fileName: string;
  contentType: string;
  dataBase64: string;
}) => {
  const safeFileName = slugify(fileName.replace(/\.pdf$/i, "")) || "dokumen";
  const pathname = `${folder}/${Date.now()}-${safeFileName}.pdf`;
  const buffer = decodeBase64Content(dataBase64);

  const blob = await put(pathname, buffer, {
    access: "public",
    contentType: contentType || "application/pdf",
    addRandomSuffix: false,
  });

  return {
    url: blob.url,
    pathname: blob.pathname,
    size: buffer.byteLength,
  };
};
