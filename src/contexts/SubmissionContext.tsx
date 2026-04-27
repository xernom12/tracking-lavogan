import { useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { SubmissionContext } from "@/contexts/submission-context.shared";
import { initialSubmissions } from "@/data/initialSubmissions";
import { findSubmissionBySubmissionNumber, getCurrentActor } from "@/lib/submission-domain";
import {
  createSubmissionRecord,
  deleteSubmissionRecord,
  finalizeApprovalSubmission,
  issueLicenseSubmission,
  submitReviewSubmissionSession,
  submitVerificationSubmissionSession,
  updatePengajuanSubmission,
  uploadRevisionSubmissionDocument,
  confirmPengajuanSubmission,
} from "@/lib/submission-operations";
import {
  createRemoteSubmission,
  deleteRemoteSubmission,
  fetchPublicSubmissionByNumber,
  fetchPublicSubmissions,
  fetchRemoteSubmissions,
  runRemoteSubmissionAction,
  updateRemoteSubmission,
} from "@/lib/submission-api";
import { isRemoteStorageEnabled } from "@/lib/submission-env";
import { AuthContext } from "@/contexts/auth-context.shared";
import type {
  AdminSubmission,
  ApprovalFinalizeInput,
  LicenseIssuanceInput,
  NewSubmissionInput,
  RevisionUploadInput,
  SessionDecisionInput,
} from "@/lib/submission-types";
import { loadStoredSubmissions } from "@/lib/submission-storage";

export type {
  AdminSubmission,
  ApprovalFinalizeInput,
  LicenseIssuanceInput,
  NewSubmissionInput,
  RevisionUploadInput,
  SessionDecisionInput,
} from "@/lib/submission-types";

const SUBMISSION_STORAGE_KEY = "tracking-os-submissions";
const DEFAULT_OSS_STATUS = "Menunggu Verifikasi K/L";
const AUTH_USER_STORAGE_KEY = "tracking-os-auth-user";
const REMOTE_POLL_INTERVAL_MS = 5000;

const remoteModeEnabled = isRemoteStorageEnabled();

const readStoredSubmissions = () =>
  loadStoredSubmissions(SUBMISSION_STORAGE_KEY, initialSubmissions, DEFAULT_OSS_STATUS);

const mergeUpdatedSubmission = (
  submissions: AdminSubmission[],
  updatedSubmission: AdminSubmission,
) => [updatedSubmission, ...submissions.filter((submission) => submission.id !== updatedSubmission.id)];

export const SubmissionProvider = ({ children }: { children: ReactNode }) => {
  const auth = useContext(AuthContext);
  const isLoggedIn = auth?.isLoggedIn ?? false;
  const isCheckingSession = auth?.isCheckingSession ?? false;
  const [submissions, setSubmissions] = useState<AdminSubmission[]>(() =>
    remoteModeEnabled ? [] : readStoredSubmissions(),
  );
  const remoteSyncInFlightRef = useRef(false);
  const submissionsRef = useRef(submissions);

  useEffect(() => {
    submissionsRef.current = submissions;
  }, [submissions]);

  const syncFromRemote = useCallback(async (showErrorToast = false) => {
    if (!remoteModeEnabled || remoteSyncInFlightRef.current) return;

    remoteSyncInFlightRef.current = true;
    try {
      const remoteSubmissions = isLoggedIn
        ? await fetchRemoteSubmissions()
        : await fetchPublicSubmissions();
      setSubmissions(remoteSubmissions);
    } catch (error) {
      if (showErrorToast) {
        toast.error(error instanceof Error ? error.message : "Gagal mengambil data terbaru dari server.");
      }
    } finally {
      remoteSyncInFlightRef.current = false;
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (!remoteModeEnabled || isCheckingSession) return;

    void syncFromRemote(true);
    if (!isLoggedIn) return;

    const intervalId = window.setInterval(() => {
      void syncFromRemote(false);
    }, REMOTE_POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [isCheckingSession, isLoggedIn, syncFromRemote]);

  useEffect(() => {
    if (remoteModeEnabled || typeof window === "undefined") return;
    window.localStorage.setItem(SUBMISSION_STORAGE_KEY, JSON.stringify(submissions));
  }, [submissions]);

  useEffect(() => {
    if (remoteModeEnabled || typeof window === "undefined") return;

    const onStorage = (event: StorageEvent) => {
      if (event.key !== SUBMISSION_STORAGE_KEY) return;
      setSubmissions(readStoredSubmissions());
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const getSubmission = (id: string) => submissions.find((submission) => submission.id === id);

  const findBySubmissionNumber = async (submissionNumber: string) => {
    const fromState = findSubmissionBySubmissionNumber(submissions, submissionNumber);
    if (fromState) return fromState;

    if (!remoteModeEnabled && typeof window !== "undefined") {
      const fromStorage = findSubmissionBySubmissionNumber(readStoredSubmissions(), submissionNumber);
      if (fromStorage) return fromStorage;
    }

    if (remoteModeEnabled) {
      try {
        const publicSubmission = await fetchPublicSubmissionByNumber(submissionNumber);
        setSubmissions((currentSubmissions) => mergeUpdatedSubmission(currentSubmissions, publicSubmission));
        return publicSubmission;
      } catch {
        return undefined;
      }
    }

    return undefined;
  };

  const applyRemoteMutation = async (
    optimisticSubmissions: AdminSubmission[],
    remoteTask: () => Promise<AdminSubmission | void>,
  ) => {
    submissionsRef.current = optimisticSubmissions;
    setSubmissions(optimisticSubmissions);

    if (!remoteModeEnabled) return;

    try {
      const updatedSubmission = await remoteTask();
      if (updatedSubmission) {
        setSubmissions((currentSubmissions) => mergeUpdatedSubmission(currentSubmissions, updatedSubmission));
        return;
      }

      await syncFromRemote(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sinkronisasi data ke server gagal.");
      await syncFromRemote(false);
    }
  };

  const addSubmission = (input: NewSubmissionInput) => {
    const actor = getCurrentActor(AUTH_USER_STORAGE_KEY);
    const currentSubmissions = submissionsRef.current;
    const payload = {
      ...input,
      id: input.id?.trim() || String(Date.now()),
    };
    const optimisticSubmissions = createSubmissionRecord(currentSubmissions, payload, actor);

    void applyRemoteMutation(optimisticSubmissions, async () => createRemoteSubmission(payload));
  };

  const updatePengajuanData = (id: string, input: NewSubmissionInput) => {
    const optimisticSubmissions = updatePengajuanSubmission(submissionsRef.current, id, input);

    void applyRemoteMutation(optimisticSubmissions, async () => updateRemoteSubmission(id, input));
  };

  const deleteSubmission = (id: string) => {
    const optimisticSubmissions = deleteSubmissionRecord(submissionsRef.current, id);

    void applyRemoteMutation(optimisticSubmissions, async () => {
      await deleteRemoteSubmission(id);
    });
  };

  const confirmPengajuan = (id: string) => {
    const actor = getCurrentActor(AUTH_USER_STORAGE_KEY);
    const optimisticSubmissions = confirmPengajuanSubmission(submissionsRef.current, id, actor);

    void applyRemoteMutation(optimisticSubmissions, async () =>
      runRemoteSubmissionAction(id, "confirmPengajuan", undefined));
  };

  const uploadRevisionDocument = (
    id: string,
    phase: "VERIFIKASI" | "PENINJAUAN",
    documentNumber: number,
    input: RevisionUploadInput,
  ) => {
    const optimisticSubmissions = uploadRevisionSubmissionDocument(
      submissionsRef.current,
      id,
      phase,
      documentNumber,
      input,
    );

    void applyRemoteMutation(optimisticSubmissions, async () =>
      runRemoteSubmissionAction(id, "uploadRevisionDocument", {
        phase,
        documentNumber,
        input,
      }));
  };

  const submitVerificationSession = (id: string, decisions: SessionDecisionInput[]) => {
    const actor = getCurrentActor(AUTH_USER_STORAGE_KEY);
    const optimisticSubmissions = submitVerificationSubmissionSession(submissionsRef.current, id, decisions, actor);

    void applyRemoteMutation(optimisticSubmissions, async () =>
      runRemoteSubmissionAction(id, "submitVerificationSession", { decisions }));
  };

  const submitReviewSession = (id: string, decisions: SessionDecisionInput[]) => {
    const actor = getCurrentActor(AUTH_USER_STORAGE_KEY);
    const optimisticSubmissions = submitReviewSubmissionSession(submissionsRef.current, id, decisions, actor);

    void applyRemoteMutation(optimisticSubmissions, async () =>
      runRemoteSubmissionAction(id, "submitReviewSession", { decisions }));
  };

  const finalizeApproval = (id: string, input: ApprovalFinalizeInput) => {
    const actor = getCurrentActor(AUTH_USER_STORAGE_KEY);
    const currentSubmissions = submissionsRef.current;
    const existingSubmission = currentSubmissions.find((submission) => submission.id === id);
    const optimisticInput = {
      ...input,
      skFileUrl: input.skFileUrl || existingSubmission?.skFileUrl || "",
      skBlobPath: input.skBlobPath || existingSubmission?.skBlobPath || "",
    };
    const optimisticSubmissions = finalizeApprovalSubmission(currentSubmissions, id, optimisticInput, actor);

    void applyRemoteMutation(optimisticSubmissions, async () =>
      runRemoteSubmissionAction(id, "finalizeApproval", optimisticInput));
  };

  const issueLicense = (id: string, input: LicenseIssuanceInput) => {
    const actor = getCurrentActor(AUTH_USER_STORAGE_KEY);
    const optimisticSubmissions = issueLicenseSubmission(submissionsRef.current, id, input, actor);

    void applyRemoteMutation(optimisticSubmissions, async () =>
      runRemoteSubmissionAction(id, "issueLicense", input));
  };

  return (
    <SubmissionContext.Provider value={{
      submissions,
      getSubmission,
      findBySubmissionNumber,
      addSubmission,
      updatePengajuanData,
      deleteSubmission,
      confirmPengajuan,
      uploadRevisionDocument,
      submitVerificationSession,
      submitReviewSession,
      finalizeApproval,
      issueLicense,
    }}>
      {children}
    </SubmissionContext.Provider>
  );
};
