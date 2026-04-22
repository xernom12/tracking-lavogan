import type {
  AdminSubmission,
  ApprovalFinalizeInput,
  LicenseIssuanceInput,
  NewSubmissionInput,
  RevisionUploadInput,
  SessionDecisionInput,
} from "@/lib/submission-types";
import { AUTH_TOKEN_STORAGE_KEY, buildApiUrl } from "@/lib/submission-env";

const getAuthToken = () => {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || "";
};

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const headers = new Headers(init?.headers || {});
  const authToken = getAuthToken();
  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  const response = await fetch(buildApiUrl(path), {
    ...init,
    headers,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || "Permintaan API gagal diproses.");
  }

  return payload as T;
};

const fileToBase64 = async (file: File) => {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary);
};

export const fetchRemoteSubmissions = async () => {
  const payload = await request<{ submissions: AdminSubmission[] }>("/api/submissions");
  return payload.submissions;
};

export const createRemoteSubmission = async (input: NewSubmissionInput) => {
  const payload = await request<{ submission: AdminSubmission }>("/api/submissions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return payload.submission;
};

export const updateRemoteSubmission = async (id: string, input: NewSubmissionInput) => {
  const payload = await request<{ submission: AdminSubmission }>(`/api/submissions/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return payload.submission;
};

export const deleteRemoteSubmission = async (id: string) => {
  await request(`/api/submissions/${id}`, {
    method: "DELETE",
  });
};

const uploadRemoteFile = async (folder: string, file: File) => {
  const dataBase64 = await fileToBase64(file);
  const payload = await request<{
    url: string;
    pathname: string;
    size: number;
  }>("/api/files/upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      folder,
      fileName: file.name,
      contentType: file.type || "application/pdf",
      dataBase64,
    }),
  });

  return payload;
};

export const runRemoteSubmissionAction = async (
  id: string,
  type:
    | "confirmPengajuan"
    | "uploadRevisionDocument"
    | "submitVerificationSession"
    | "submitReviewSession"
    | "finalizeApproval"
    | "issueLicense",
  payload:
    | undefined
    | {
      phase: "VERIFIKASI" | "PENINJAUAN";
      documentNumber: number;
      input: RevisionUploadInput;
    }
    | { decisions: SessionDecisionInput[] }
    | ApprovalFinalizeInput
    | LicenseIssuanceInput,
) => {
  let nextPayload = payload;

  if (type === "uploadRevisionDocument" && payload && "input" in payload && payload.input.file) {
    const uploadedFile = await uploadRemoteFile(
      `revision/${id}/${payload.phase.toLowerCase()}`,
      payload.input.file,
    );

    nextPayload = {
      ...payload,
      input: {
        ...payload.input,
        fileUrl: uploadedFile.url,
        blobPath: uploadedFile.pathname,
        fileSizeBytes: uploadedFile.size,
      },
    };
  }

  if (type === "finalizeApproval" && payload && "approvalDate" in payload && payload.file) {
    const uploadedFile = await uploadRemoteFile(`approval/${id}`, payload.file);
    nextPayload = {
      ...payload,
      skFileUrl: uploadedFile.url,
      skBlobPath: uploadedFile.pathname,
      skFileSizeBytes: uploadedFile.size,
    };
  }

  const response = await request<{ submission: AdminSubmission }>(`/api/submissions/${id}/actions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type,
      payload: nextPayload,
    }),
  });

  return response.submission;
};
