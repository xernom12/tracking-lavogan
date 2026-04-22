import { useEffect } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import StageDetailAdmin from "@/components/StageDetailAdmin";
import StageDetailUser from "@/components/StageDetailUser";
import AdminDashboard from "@/pages/AdminDashboard";
import { SubmissionProvider, type AdminSubmission, type SessionDecisionInput } from "@/contexts/SubmissionContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { deriveStages } from "@/data/mockData";
import { MemoryRouter } from "react-router-dom";
import { useSubmissions } from "@/contexts/useSubmissions";

const buildApprovedDecisions = (): SessionDecisionInput[] =>
  Array.from({ length: 8 }, () => ({ status: "approved" as const }));

describe("session flow", () => {
  const SUBMISSION_STORAGE_KEY = "tracking-os-submissions";

  beforeEach(() => {
    window.localStorage.clear();
  });

  it("rejects verification session when revision note is missing", () => {
    let api: ReturnType<typeof useSubmissions> | null = null;
    const Capture = () => {
      api = useSubmissions();
      return null;
    };

    render(
      <SubmissionProvider>
        <Capture />
      </SubmissionProvider>,
    );

    act(() => {
      api!.confirmPengajuan("4");
    });

    const invalidDecisions = buildApprovedDecisions();
    invalidDecisions[2] = { status: "revision_required" };

    act(() => {
      api!.submitVerificationSession("4", invalidDecisions);
    });

    const updated = api!.getSubmission("4")!;
    expect(updated.documents.every((doc) => doc.status === "locked")).toBe(true);
    expect(updated.timeline.some((event) => event.phase === "VERIFIKASI" && event.sessionNumber === 1)).toBe(false);
  });

  it("keeps stage at verification when a session has revision", () => {
    let api: ReturnType<typeof useSubmissions> | null = null;
    const Capture = () => {
      api = useSubmissions();
      return null;
    };

    render(
      <SubmissionProvider>
        <Capture />
      </SubmissionProvider>,
    );

    act(() => {
      api!.confirmPengajuan("4");
    });

    const decisions = buildApprovedDecisions();
    decisions[2] = { status: "revision_required", note: "Perbaiki masa berlaku dokumen." };

    act(() => {
      api!.submitVerificationSession("4", decisions);
    });

    const updated = api!.getSubmission("4")!;
    expect(updated.verificationCompleted).toBe(false);
    expect(updated.documents[2].status).toBe("revision_required");
    expect(updated.timeline.some((event) => event.phase === "VERIFIKASI" && event.sessionNumber === 1)).toBe(true);
    const summaryEvent = updated.timeline.find(
      (event) => event.phase === "VERIFIKASI"
        && event.sessionNumber === 1
        && Array.isArray(event.sessionEntries),
    );
    expect(summaryEvent?.sessionEntries).toHaveLength(8);
    expect(summaryEvent?.sessionEntries?.map((entry) => entry.documentNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(summaryEvent?.sessionEntries?.[2]?.status).toBe("revision_required");
  });

  it("completes review stage immediately when all decisions are approved", () => {
    let api: ReturnType<typeof useSubmissions> | null = null;
    const Capture = () => {
      api = useSubmissions();
      return null;
    };

    render(
      <SubmissionProvider>
        <Capture />
      </SubmissionProvider>,
    );

    act(() => {
      api!.submitReviewSession("2", buildApprovedDecisions());
    });

    const updated = api!.getSubmission("2")!;
    expect(updated.reviewCompleted).toBe(true);
    expect(updated.reviewDocuments.every((doc) => doc.status === "approved")).toBe(true);
    const summaryEvent = updated.timeline.find(
      (event) => event.phase === "PENINJAUAN"
        && event.sessionNumber === 2
        && Array.isArray(event.sessionEntries),
    );
    expect(summaryEvent?.description).toContain("proses dilanjutkan ke Persetujuan");
    expect(summaryEvent?.sessionEntries).toHaveLength(8);
  });

  it("allows re-evaluating previously approved documents in verification follow-up session", () => {
    let api: ReturnType<typeof useSubmissions> | null = null;
    const Capture = () => {
      api = useSubmissions();
      return null;
    };

    render(
      <SubmissionProvider>
        <Capture />
      </SubmissionProvider>,
    );

    act(() => {
      api!.confirmPengajuan("4");
    });

    const firstSession = buildApprovedDecisions();
    firstSession[2] = { status: "revision_required", note: "Perbaiki dokumen 3." };

    act(() => {
      api!.submitVerificationSession("4", firstSession);
    });

    const secondSession = buildApprovedDecisions();
    secondSession[0] = { status: "revision_required", note: "Dokumen 1 perlu disesuaikan kembali." };

    act(() => {
      api!.submitVerificationSession("4", secondSession);
    });

    const updated = api!.getSubmission("4")!;
    expect(updated.documents[0].status).toBe("revision_required");
    expect(updated.documents[2].status).toBe("approved");
    expect(updated.verificationCompleted).toBe(false);
    const sessionTwoSummary = updated.timeline.find(
      (event) => event.phase === "VERIFIKASI"
        && event.sessionNumber === 2
        && Array.isArray(event.sessionEntries),
    );
    expect(sessionTwoSummary?.sessionEntries?.[0]?.status).toBe("revision_required");
    expect(sessionTwoSummary?.description).toContain("tahapan tetap pada Verifikasi Dokumen");
  });

  it("accepts review revision without note and keeps stage in peninjauan", () => {
    let api: ReturnType<typeof useSubmissions> | null = null;
    const Capture = () => {
      api = useSubmissions();
      return null;
    };

    render(
      <SubmissionProvider>
        <Capture />
      </SubmissionProvider>,
    );

    const decisions = buildApprovedDecisions();
    decisions[2] = { status: "revision_required" };

    act(() => {
      api!.submitReviewSession("2", decisions);
    });

    const updated = api!.getSubmission("2")!;
    expect(updated.reviewCompleted).toBe(false);
    expect(updated.reviewDocuments[2].status).toBe("revision_required");
    const summaryEvent = updated.timeline.find(
      (event) => event.phase === "PENINJAUAN"
        && event.sessionNumber === 2
        && Array.isArray(event.sessionEntries),
    );
    expect(summaryEvent).toBeTruthy();
    expect(summaryEvent?.sessionEntries?.[2]?.note).toBeUndefined();
  });

  it("rejects review session when reuploaded revision is marked revision again without note", () => {
    let api: ReturnType<typeof useSubmissions> | null = null;
    const Capture = () => {
      api = useSubmissions();
      return null;
    };

    render(
      <SubmissionProvider>
        <Capture />
      </SubmissionProvider>,
    );

    act(() => {
      api!.uploadRevisionDocument("2", "PENINJAUAN", 3, {
        fileName: "Akreditasi-Revisi.pdf",
        fileSizeBytes: 321456,
      });
    });

    const before = api!.getSubmission("2")!;
    const beforeTimelineLength = before.timeline.length;

    const decisions = buildApprovedDecisions();
    decisions[2] = { status: "revision_required" };

    act(() => {
      api!.submitReviewSession("2", decisions);
    });

    const updated = api!.getSubmission("2")!;
    expect(updated.reviewCompleted).toBe(false);
    expect(updated.reviewDocuments[2].status).toBe("revision_required");
    expect(updated.timeline).toHaveLength(beforeTimelineLength);
  });

  it("stores applicant revision upload metadata and timeline for verification documents", () => {
    let api: ReturnType<typeof useSubmissions> | null = null;
    const Capture = () => {
      api = useSubmissions();
      return null;
    };

    render(
      <SubmissionProvider>
        <Capture />
      </SubmissionProvider>,
    );

    act(() => {
      api!.confirmPengajuan("4");
    });

    const decisions = buildApprovedDecisions();
    decisions[2] = { status: "revision_required", note: "Perbaiki dokumen akreditasi." };

    act(() => {
      api!.submitVerificationSession("4", decisions);
    });

    act(() => {
      api!.uploadRevisionDocument("4", "VERIFIKASI", 3, {
        fileName: "Akreditasi-Revisi.pdf",
        fileSizeBytes: 321456,
      });
    });

    const updated = api!.getSubmission("4")!;
    expect(updated.documents[2].uploads?.at(-1)).toMatchObject({
      fileName: "Akreditasi-Revisi.pdf",
      fileSizeBytes: 321456,
      phase: "VERIFIKASI",
    });
    expect(updated.timeline.at(-1)).toMatchObject({
      actor: "Pemohon",
      phase: "VERIFIKASI",
      documentNumber: 3,
      type: "info",
    });
  });

  it("ignores applicant upload when the document is not in revision state", () => {
    let api: ReturnType<typeof useSubmissions> | null = null;
    const Capture = () => {
      api = useSubmissions();
      return null;
    };

    render(
      <SubmissionProvider>
        <Capture />
      </SubmissionProvider>,
    );

    const before = api!.getSubmission("4")!;
    const beforeTimelineLength = before.timeline.length;

    act(() => {
      api!.uploadRevisionDocument("4", "VERIFIKASI", 1, {
        fileName: "Surat-Permohonan.pdf",
        fileSizeBytes: 204800,
      });
    });

    const updated = api!.getSubmission("4")!;
    expect(updated.documents[0].uploads).toEqual([]);
    expect(updated.timeline).toHaveLength(beforeTimelineLength);
  });

  it("moves approval to izin terbit and finalizes only after status izin is selected", () => {
    let api: ReturnType<typeof useSubmissions> | null = null;
    const Capture = () => {
      api = useSubmissions();
      return null;
    };

    render(
      <SubmissionProvider>
        <Capture />
      </SubmissionProvider>,
    );

    act(() => {
      api!.submitReviewSession("2", buildApprovedDecisions());
    });

    act(() => {
      api!.finalizeApproval("2", {
        approvalDate: "10 Maret 2026",
        pbUmkuNumber: "PB-UMKU-2026-00077",
        skFileName: "SK-PB-UMKU-2026-00077.pdf",
        skFileSizeBytes: 2405120,
      });
    });

    const drafted = api!.getSubmission("2")!;
    expect(drafted.approvalCompleted).toBe(true);
    expect(drafted.approvalDate).toBe("10 Maret 2026");
    expect(drafted.licenseIssued).toBe(false);
    expect(drafted.licenseStatus).toBe("");
    expect(drafted.licenseNumber).toBe("PB-UMKU-2026-00077");
    expect(drafted.licenseDate).toBe("");
    expect(drafted.skFileName).toBe("SK-PB-UMKU-2026-00077.pdf");
    expect(drafted.skFileSizeBytes).toBe(2405120);
    expect(deriveStages(drafted)[4].status).toBe("active");
    expect(drafted.timeline.at(-1)?.phase).toBe("PERSETUJUAN");

    act(() => {
      api!.issueLicense("2", {
        status: "Aktif",
      });
    });

    const updated = api!.getSubmission("2")!;
    expect(updated.licenseIssued).toBe(true);
    expect(updated.licenseStatus).toBe("Aktif");
    expect(updated.licenseDate).toBe(new Date().toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }));
    expect(updated.timeline.at(-1)?.phase).toBe("IZIN_TERBIT");
  });

  it("rejects approval finalization when nomor izin is duplicated", () => {
    let api: ReturnType<typeof useSubmissions> | null = null;
    const Capture = () => {
      api = useSubmissions();
      return null;
    };

    render(
      <SubmissionProvider>
        <Capture />
      </SubmissionProvider>,
    );

    act(() => {
      api!.submitReviewSession("2", buildApprovedDecisions());
    });

    act(() => {
      api!.finalizeApproval("2", {
        approvalDate: "10 Maret 2026",
        pbUmkuNumber: "PB-UMKU-2026-00123",
        skFileName: "SK-PB-UMKU-2026-00077.pdf",
        skFileSizeBytes: 2405120,
      });
    });

    const updated = api!.getSubmission("2")!;
    expect(updated.approvalCompleted).toBe(false);
    expect(updated.licenseNumber).toBe("");
  });

  it("accepts approval finalization with flexible nomor izin format", () => {
    let api: ReturnType<typeof useSubmissions> | null = null;
    const Capture = () => {
      api = useSubmissions();
      return null;
    };

    render(
      <SubmissionProvider>
        <Capture />
      </SubmissionProvider>,
    );

    act(() => {
      api!.submitReviewSession("2", buildApprovedDecisions());
      api!.finalizeApproval("2", {
        approvalDate: "10 Maret 2026",
        pbUmkuNumber: "IZIN/UMKU/2026/77-A",
        skFileName: "SK-Izin-2026-77-A.pdf",
        skFileSizeBytes: 2405120,
      });
    });

    const updated = api!.getSubmission("2")!;
    expect(updated.approvalCompleted).toBe(true);
    expect(updated.licenseNumber).toBe("IZIN/UMKU/2026/77-A");
  });

  it("rejects izin terbit when approval draft is incomplete in stored state", () => {
    let api: ReturnType<typeof useSubmissions> | null = null;
    const Capture = () => {
      api = useSubmissions();
      return null;
    };

    const firstRender = render(
      <SubmissionProvider>
        <Capture />
      </SubmissionProvider>,
    );

    act(() => {
      api!.submitReviewSession("2", buildApprovedDecisions());
      api!.finalizeApproval("2", {
        approvalDate: "10 Maret 2026",
        pbUmkuNumber: "PB-UMKU-2026-00077",
        skFileName: "SK-PB-UMKU-2026-00077.pdf",
        skFileSizeBytes: 2405120,
      });
    });

    const stored = JSON.parse(window.localStorage.getItem(SUBMISSION_STORAGE_KEY) || "[]");
    const malformed = stored.map((submission: Record<string, unknown>) => {
      if (submission.id !== "2") return submission;
      return {
        ...submission,
        approvalCompleted: true,
        approvalDate: "",
        licenseNumber: "",
        skFileName: "",
        skFileSizeBytes: 0,
      };
    });
    window.localStorage.setItem(SUBMISSION_STORAGE_KEY, JSON.stringify(malformed));
    firstRender.unmount();

    render(
      <SubmissionProvider>
        <Capture />
      </SubmissionProvider>,
    );

    act(() => {
      api!.issueLicense("2", {
        status: "Aktif",
      });
    });

    const updated = api!.getSubmission("2")!;
    expect(updated.licenseIssued).toBe(false);
    expect(updated.timeline.at(-1)?.phase).not.toBe("IZIN_TERBIT");
  });

  it("updates pengajuan data without adding timeline history", () => {
    let api: ReturnType<typeof useSubmissions> | null = null;
    const Capture = () => {
      api = useSubmissions();
      return null;
    };

    render(
      <SubmissionProvider>
        <Capture />
      </SubmissionProvider>,
    );

    const before = api!.getSubmission("4")!;
    const beforeTimelineLength = before.timeline.length;

    act(() => {
      api!.updatePengajuanData("4", {
        submissionNumber: "I-202603050001111111111",
        submissionType: "Perpanjangan",
        organizationName: "LPK Harapan Bangsa Sejahtera",
        nib: "1234567890999",
        kbli: "78425",
        pengajuanDate: "5 Maret 2026",
      });
    });

    const updated = api!.getSubmission("4")!;
    expect(updated.submissionNumber).toBe("I-202603050001111111111");
    expect(updated.submissionType).toBe("Perpanjangan");
    expect(updated.organizationName).toBe("LPK Harapan Bangsa Sejahtera");
    expect(updated.nib).toBe("1234567890999");
    expect(updated.kbli).toBe("78425");
    expect(updated.timeline).toHaveLength(beforeTimelineLength);
  });

  it("shows dynamic final action button text as Lanjut/Perlu Perbaikan", async () => {
    const StageHarness = () => {
      const { getSubmission, confirmPengajuan } = useSubmissions();

      useEffect(() => {
        confirmPengajuan("4");
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);

      const submission = getSubmission("4");
      if (!submission) return null;
      return (
        <StageDetailAdmin
          submission={submission}
          stageIndex={1}
          stages={deriveStages(submission)}
        />
      );
    };

    render(
      <SubmissionProvider>
        <StageHarness />
      </SubmissionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Lanjut" })).toBeInTheDocument();
    });

    fireEvent.change(screen.getAllByRole("combobox")[0], {
      target: { value: "revision_required" },
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Perlu Perbaikan" })).toBeInTheDocument();
    });
  });

  it("saves and restores document inspection draft before clearing it after final submit", async () => {
    const draftNote = "Catatan pemeriksaan cukup panjang agar admin dapat melanjutkan pekerjaan tanpa mengulang isian dari awal.";

    const StageHarness = () => {
      const { getSubmission, confirmPengajuan } = useSubmissions();
      const submission = getSubmission("4");

      useEffect(() => {
        if (!submission?.pengajuanConfirmed) confirmPengajuan("4");
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);

      const latestSubmission = getSubmission("4");
      if (!latestSubmission) return null;
      return (
        <StageDetailAdmin
          submission={latestSubmission}
          stageIndex={1}
          stages={deriveStages(latestSubmission)}
        />
      );
    };

    const firstRender = render(
      <SubmissionProvider>
        <StageHarness />
      </SubmissionProvider>,
    );

    const firstDocCard = await screen.findByTestId("session-editor-doc-1");
    const saveDraftButton = screen.getByRole("button", { name: "Simpan Draft" });
    expect(saveDraftButton).toBeDisabled();

    fireEvent.change(within(firstDocCard).getByRole("combobox"), {
      target: { value: "revision_required" },
    });
    fireEvent.change(within(firstDocCard).getByPlaceholderText("Tulis catatan perbaikan"), {
      target: { value: draftNote },
    });

    expect(saveDraftButton).toBeEnabled();
    fireEvent.click(saveDraftButton);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Simpan Draft Pemeriksaan?" })).toBeInTheDocument();
    });
    expect(window.localStorage.getItem("tracking-os-session-drafts")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Ya, Simpan Draft" }));

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Simpan Draft Pemeriksaan?" })).not.toBeInTheDocument();
    });
    expect(window.localStorage.getItem("tracking-os-session-drafts")).toContain(draftNote);

    firstRender.unmount();

    render(
      <SubmissionProvider>
        <StageHarness />
      </SubmissionProvider>,
    );

    const restoredFirstDocCard = await screen.findByTestId("session-editor-doc-1");
    expect(within(restoredFirstDocCard).getByRole("combobox")).toHaveValue("revision_required");
    expect(within(restoredFirstDocCard).getByDisplayValue(draftNote)).toBeInTheDocument();

    for (let index = 1; index <= 8; index += 1) {
      const docCard = await screen.findByTestId(`session-editor-doc-${index}`);
      fireEvent.change(within(docCard).getByRole("combobox"), {
        target: { value: "approved" },
      });
    }

    fireEvent.click(screen.getByRole("button", { name: "Lanjut" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Lanjut ke Tahapan Peninjauan Dokumen?" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Ya, Simpan & Lanjut" }));

    await waitFor(() => {
      expect(window.localStorage.getItem("tracking-os-session-drafts")).toBeNull();
    });
  }, 10000);

  it("preserves unsaved inspection selections when refreshed remote data re-renders the same session", async () => {
    const StageHarness = ({ refreshVersion }: { refreshVersion: number }) => {
      const { getSubmission, confirmPengajuan } = useSubmissions();
      const submission = getSubmission("4");

      useEffect(() => {
        if (!submission?.pengajuanConfirmed) confirmPengajuan("4");
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);

      const latestSubmission = getSubmission("4");
      if (!latestSubmission) return null;

      const refreshedSubmission: AdminSubmission = {
        ...latestSubmission,
        documents: latestSubmission.documents.map((doc) => ({
          ...doc,
          history: doc.history ? [...doc.history] : undefined,
          uploads: doc.uploads ? [...doc.uploads] : undefined,
        })),
        reviewDocuments: latestSubmission.reviewDocuments.map((doc) => ({
          ...doc,
          history: doc.history ? [...doc.history] : undefined,
          uploads: doc.uploads ? [...doc.uploads] : undefined,
        })),
        timeline: [...latestSubmission.timeline],
      };

      return (
        <div data-refresh-version={refreshVersion}>
          <StageDetailAdmin
            submission={refreshedSubmission}
            stageIndex={1}
            stages={deriveStages(refreshedSubmission)}
          />
        </div>
      );
    };

    const { rerender } = render(
      <SubmissionProvider>
        <StageHarness refreshVersion={0} />
      </SubmissionProvider>,
    );

    const firstDocCard = await screen.findByTestId("session-editor-doc-1");
    const firstSelect = within(firstDocCard).getByRole("combobox");

    fireEvent.change(firstSelect, {
      target: { value: "approved" },
    });

    expect(firstSelect).toHaveValue("approved");

    rerender(
      <SubmissionProvider>
        <StageHarness refreshVersion={1} />
      </SubmissionProvider>,
    );

    const refreshedFirstDocCard = await screen.findByTestId("session-editor-doc-1");
    expect(within(refreshedFirstDocCard).getByRole("combobox")).toHaveValue("approved");
  });

  it("shows persetujuan as the next stage label in peninjauan confirmation dialog", async () => {
    const StageHarness = () => {
      const { getSubmission } = useSubmissions();
      const submission = getSubmission("2");
      if (!submission) return null;
      return (
        <StageDetailAdmin
          submission={submission}
          stageIndex={2}
          stages={deriveStages(submission)}
        />
      );
    };

    render(
      <SubmissionProvider>
        <StageHarness />
      </SubmissionProvider>,
    );

    for (let index = 1; index <= 8; index += 1) {
      const docCard = await screen.findByTestId(`session-editor-doc-${index}`);
      const select = within(docCard).getByRole("combobox");
      fireEvent.change(select, {
        target: { value: "approved" },
      });
    }

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Lanjut" })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Lanjut" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Lanjut ke Tahapan Persetujuan?" })).toBeInTheDocument();
    });

    expect(screen.queryByRole("heading", { name: "Lanjut ke Tahapan Persetujuan Permohonan?" })).not.toBeInTheDocument();
  }, 10000);

  it("shows approval form error when nomor izin PB UMKU is duplicated", async () => {
    const StageHarness = () => {
      const { getSubmission, submitReviewSession } = useSubmissions();

      useEffect(() => {
        submitReviewSession("2", buildApprovedDecisions());
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);

      const submission = getSubmission("2");
      if (!submission) return null;
      return (
        <StageDetailAdmin
          submission={submission}
          stageIndex={3}
          stages={deriveStages(submission)}
        />
      );
    };

    const { container } = render(
      <SubmissionProvider>
        <StageHarness />
      </SubmissionProvider>,
    );

    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
    expect(dateInput).toBeTruthy();

    fireEvent.change(dateInput, {
      target: { value: "2026-03-10" },
    });

    fireEvent.change(screen.getByPlaceholderText("Masukkan nomor izin PB UMKU"), {
      target: { value: "PB-UMKU-2026-00123" },
    });

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    fireEvent.change(fileInput, {
      target: {
        files: [new File(["pdf"], "SK-PB-UMKU-2026-00077.pdf", { type: "application/pdf" })],
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Simpan Persetujuan & Lanjut" }));

    await waitFor(() => {
      expect(screen.getByText("Nomor Izin PB UMKU sudah digunakan.")).toBeInTheDocument();
    });

    expect(screen.queryByRole("heading", { name: "Simpan Persetujuan & Lanjut ke Izin Terbit?" })).not.toBeInTheDocument();
  });

  it("shows izin terbit error when approval draft is incomplete", async () => {
    const malformedSubmission: AdminSubmission = {
      id: "2",
      submissionNumber: "I-202602051530000194811",
      submissionType: "Perpanjangan",
      organizationName: "LPK Nusantara Global",
      nib: "8120341452554",
      kbli: "85493",
      ossStatus: "Izin Terbit",
      lastUpdated: "10 Maret 2026",
      pengajuanConfirmed: true,
      verificationCompleted: true,
      pengajuanDate: "18 Februari 2026",
      documents: Array.from({ length: 8 }, (_, index) => ({
        name: `Dokumen ${index + 1}`,
        status: "approved" as const,
      })),
      reviewNotes: "Seluruh dokumen pada tahap peninjauan dinyatakan sesuai persyaratan.",
      reviewCompleted: true,
      approvalCompleted: true,
      approvalDate: "",
      licenseIssued: false,
      licenseStatus: "",
      licenseNumber: "",
      licenseDate: "",
      skFileName: "",
      skFileSizeBytes: 0,
      reviewCycle: 1,
      reviewDocuments: Array.from({ length: 8 }, (_, index) => ({
        name: `Dokumen ${index + 1}`,
        status: "approved" as const,
      })),
      verificationWorklistDocNumbers: [],
      timeline: [],
    };

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <SubmissionProvider>
          <StageDetailAdmin
            submission={malformedSubmission}
            stageIndex={4}
            stages={deriveStages(malformedSubmission)}
          />
        </SubmissionProvider>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "Aktif" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Simpan Izin Terbit" }));

    await waitFor(() => {
      expect(screen.getByText("Tanggal persetujuan belum tersedia.")).toBeInTheDocument();
    });
  });

  it("opens izin terbit confirmation even when status is saved and submitted immediately", async () => {
    const readySubmission: AdminSubmission = {
      id: "izin-terbit-ready",
      submissionNumber: "I-READY-202604220001",
      submissionType: "Baru",
      organizationName: "LPK Siap Terbit",
      nib: "1234567890123",
      kbli: "78425",
      ossStatus: "Izin Terbit",
      lastUpdated: "22 April 2026",
      pengajuanConfirmed: true,
      verificationCompleted: true,
      pengajuanDate: "20 April 2026",
      documents: Array.from({ length: 8 }, (_, index) => ({
        name: `Dokumen ${index + 1}`,
        status: "approved" as const,
      })),
      reviewNotes: "Seluruh dokumen dinyatakan sesuai.",
      reviewCompleted: true,
      approvalCompleted: true,
      approvalDate: "22 April 2026",
      licenseIssued: false,
      licenseStatus: "",
      licenseNumber: "PB-UMKU-READY-001",
      licenseDate: "",
      skFileName: "SK-PB-UMKU-READY-001.pdf",
      skFileSizeBytes: 1024,
      skFileUrl: "https://example.com/sk-pb-umku-ready-001.pdf",
      reviewCycle: 1,
      reviewDocuments: Array.from({ length: 8 }, (_, index) => ({
        name: `Dokumen ${index + 1}`,
        status: "approved" as const,
      })),
      verificationWorklistDocNumbers: [],
      timeline: [],
    };

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <SubmissionProvider>
          <StageDetailAdmin
            submission={readySubmission}
            stageIndex={4}
            stages={deriveStages(readySubmission)}
          />
        </SubmissionProvider>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "Aktif" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Simpan Izin Terbit" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Simpan Izin Terbit?" })).toBeInTheDocument();
    });
  });

  it("keeps previous revision marker visible while current session decision changes and expands only the latest session by default", async () => {
    const StageHarness = () => {
      const { getSubmission, confirmPengajuan, submitVerificationSession } = useSubmissions();

      useEffect(() => {
        confirmPengajuan("4");
        const decisions = buildApprovedDecisions();
        decisions[1] = { status: "revision_required", note: "Perbaiki dokumen 2." };
        submitVerificationSession("4", decisions);
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);

      const submission = getSubmission("4");
      if (!submission) return null;
      return (
        <StageDetailAdmin
          submission={submission}
          stageIndex={1}
          stages={deriveStages(submission)}
        />
      );
    };

    render(
      <SubmissionProvider>
        <StageHarness />
      </SubmissionProvider>,
    );

    const firstDocCard = await screen.findByTestId("session-editor-doc-1");
    const revisedDocCard = await screen.findByTestId("session-editor-doc-2");

    await waitFor(() => {
      expect(within(revisedDocCard).getAllByText("Memerlukan Perbaikan").length).toBeGreaterThan(0);
    });

    expect(screen.queryByText("Perbaiki dokumen 2.")).not.toBeInTheDocument();
    expect(firstDocCard).toHaveClass("border-slate-200");
    expect(revisedDocCard).toHaveClass("border-status-revision");
    expect(screen.getAllByTitle("Memerlukan Perbaikan").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /Salinan Izin Usaha/i }));
    expect(screen.getByText("Perbaiki dokumen 2.")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByTitle("Status belum dipilih").length).toBeGreaterThan(0);
    });

    fireEvent.change(screen.getAllByRole("combobox")[1], {
      target: { value: "approved" },
    });

    expect(screen.queryByText("Sebelumnya: Sesuai")).not.toBeInTheDocument();
    expect(screen.queryByText("Sebelumnya: Memerlukan Perbaikan")).not.toBeInTheDocument();
    expect(within(revisedDocCard).getAllByText("Memerlukan Perbaikan").length).toBeGreaterThan(0);
    expect(revisedDocCard).toHaveClass("border-status-completed");
    expect(revisedDocCard).not.toHaveClass("border-status-revision");
    expect(screen.getAllByTitle("Sesuai Persyaratan").length).toBeGreaterThan(0);

    fireEvent.change(screen.getAllByRole("combobox")[0], {
      target: { value: "revision_required" },
    });

    const firstDocNoteInput = within(firstDocCard).getByPlaceholderText("Tulis catatan perbaikan");
    fireEvent.change(firstDocNoteInput, {
      target: { value: "Perbaiki dokumen 1." },
    });

    expect(firstDocCard).toHaveClass("border-status-revision");
    expect(within(firstDocCard).getByText("Catatan perbaikan wajib diisi.")).toBeInTheDocument();
    expect(screen.getAllByTitle("Memerlukan Perbaikan").length).toBeGreaterThan(0);
  });

  it("does not keep approved green border from a previous follow-up session", async () => {
    const StageHarness = () => {
      const { getSubmission, confirmPengajuan, submitVerificationSession } = useSubmissions();

      useEffect(() => {
        confirmPengajuan("4");

        const firstSession = buildApprovedDecisions();
        firstSession[1] = { status: "revision_required", note: "Perbaiki dokumen 2." };
        submitVerificationSession("4", firstSession);

        const secondSession = buildApprovedDecisions();
        secondSession[0] = { status: "revision_required", note: "Perbaiki dokumen 1." };
        secondSession[1] = { status: "approved" };
        submitVerificationSession("4", secondSession);
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);

      const submission = getSubmission("4");
      if (!submission) return null;
      return (
        <StageDetailAdmin
          submission={submission}
          stageIndex={1}
          stages={deriveStages(submission)}
        />
      );
    };

    render(
      <SubmissionProvider>
        <StageHarness />
      </SubmissionProvider>,
    );

    const stillRevisedDocCard = await screen.findByTestId("session-editor-doc-1");
    const previouslyApprovedDocCard = await screen.findByTestId("session-editor-doc-2");

    expect(stillRevisedDocCard).toHaveClass("border-status-revision");
    expect(previouslyApprovedDocCard).toHaveClass("border-slate-200");
    expect(previouslyApprovedDocCard).not.toHaveClass("border-status-completed");
  });

  it("shows reupload-ready marker for admin when applicant has uploaded revision", async () => {
    const StageHarness = () => {
      const { getSubmission, confirmPengajuan, submitVerificationSession, uploadRevisionDocument } = useSubmissions();

      useEffect(() => {
        confirmPengajuan("4");
        const decisions = buildApprovedDecisions();
        decisions[0] = { status: "revision_required", note: "Perbaiki dokumen 1." };
        submitVerificationSession("4", decisions);
        uploadRevisionDocument("4", "VERIFIKASI", 1, {
          fileName: "Dokumen-Perbaikan.pdf",
          fileSizeBytes: 204800,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);

      const submission = getSubmission("4");
      if (!submission) return null;
      return (
        <StageDetailAdmin
          submission={submission}
          stageIndex={1}
          stages={deriveStages(submission)}
        />
      );
    };

    render(
      <SubmissionProvider>
        <StageHarness />
      </SubmissionProvider>,
    );

    const revisedDocCard = await screen.findByTestId("session-editor-doc-1");

    expect(within(revisedDocCard).getAllByText("Memerlukan Perbaikan").length).toBeGreaterThan(0);
    expect(within(revisedDocCard).getByText("Siap Diperiksa Ulang")).toBeInTheDocument();
    expect(within(revisedDocCard).getByText(/Dokumen perbaikan terbaru sudah diunggah/i)).toBeInTheDocument();
    expect(screen.getAllByText("Siap Diperiksa Ulang")).toHaveLength(1);
  });

  it("shows only the latest verification history with terbaru badge when verification is completed", async () => {
    const StageHarness = () => {
      const { getSubmission } = useSubmissions();
      const submission = getSubmission("2");
      if (!submission) return null;
      return (
        <StageDetailAdmin
          submission={submission}
          stageIndex={1}
          stages={deriveStages(submission)}
        />
      );
    };

    render(
      <SubmissionProvider>
        <StageHarness />
      </SubmissionProvider>,
    );

    expect(screen.getByRole("heading", { name: /Riwayat Verifikasi Dokumen/i })).toBeInTheDocument();
    expect(screen.getByText("Terbaru")).toBeInTheDocument();
    expect(screen.queryByText("Verifikasi Dokumen")).not.toBeInTheDocument();
  });

  it("shows terbaru badge on the latest verification history for public completed stage", async () => {
    const StageHarness = () => {
      const { getSubmission } = useSubmissions();
      const submission = getSubmission("2");
      if (!submission) return null;
      return (
        <StageDetailUser
          submission={submission}
          stageIndex={1}
          stages={deriveStages(submission)}
        />
      );
    };

    render(
      <SubmissionProvider>
        <StageHarness />
      </SubmissionProvider>,
    );

    expect(screen.getByText(/Riwayat Verifikasi Dokumen/i)).toBeInTheDocument();
    expect(screen.getByText("Terbaru")).toBeInTheDocument();
    expect(screen.queryByText("8 dari 8 dokumen sesuai persyaratan")).not.toBeInTheDocument();
  });

  it("disables save button on pengajuan edit when no changes and saves directly when changed", async () => {
    const StageHarness = () => {
      const { getSubmission } = useSubmissions();
      const submission = getSubmission("4");
      if (!submission) return null;
      return (
        <StageDetailAdmin
          submission={submission}
          stageIndex={0}
          stages={deriveStages(submission)}
        />
      );
    };

    render(
      <SubmissionProvider>
        <StageHarness />
      </SubmissionProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit data permohonan" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Edit data permohonan" })).toBeInTheDocument();
    });

    const saveButton = screen.getByRole("button", { name: "Simpan Perubahan" });
    expect(saveButton).toBeDisabled();

    fireEvent.change(screen.getByDisplayValue("I-202602071200000880944"), {
      target: { value: "I-202602071200000880945" },
    });

    expect(saveButton).not.toBeDisabled();
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Edit data permohonan" })).not.toBeInTheDocument();
    });
  });

  it("requires confirmation before advancing pengajuan to verification", async () => {
    let api: ReturnType<typeof useSubmissions> | null = null;
    const Capture = () => {
      api = useSubmissions();
      return null;
    };

    const StageHarness = () => {
      const { getSubmission } = useSubmissions();
      const submission = getSubmission("4");
      if (!submission) return null;
      return (
        <StageDetailAdmin
          submission={submission}
          stageIndex={0}
          stages={deriveStages(submission)}
        />
      );
    };

    render(
      <SubmissionProvider>
        <Capture />
        <StageHarness />
      </SubmissionProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Konfirmasi Pengajuan" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Lanjut ke Verifikasi Dokumen?" })).toBeInTheDocument();
    });

    expect(deriveStages(api!.getSubmission("4")!)[1].status).toBe("locked");

    fireEvent.click(screen.getByRole("button", { name: "Ya, Konfirmasi & Lanjut" }));

    await waitFor(() => {
      expect(deriveStages(api!.getSubmission("4")!)[1].status).toBe("active");
    });
  });

  it("requires confirmation before applicant revision upload is stored", async () => {
    let api: ReturnType<typeof useSubmissions> | null = null;
    const Capture = () => {
      api = useSubmissions();
      return null;
    };

    const StageHarness = () => {
      const { getSubmission, confirmPengajuan, submitVerificationSession } = useSubmissions();

      useEffect(() => {
        confirmPengajuan("4");
        const decisions = buildApprovedDecisions();
        decisions[0] = { status: "revision_required", note: "Perbaiki dokumen 1." };
        submitVerificationSession("4", decisions);
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);

      const submission = getSubmission("4");
      if (!submission) return null;
      return (
        <StageDetailUser
          submission={submission}
          stageIndex={1}
          stages={deriveStages(submission)}
        />
      );
    };

    const { container } = render(
      <SubmissionProvider>
        <Capture />
        <StageHarness />
      </SubmissionProvider>,
    );

    fireEvent.click(screen.getAllByRole("button")[0]);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    fireEvent.change(fileInput, {
      target: {
        files: [new File(["pdf"], "Dokumen-Perbaikan.pdf", { type: "application/pdf" })],
      },
    });

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Unggah dokumen perbaikan Verifikasi Dokumen?" })).toBeInTheDocument();
    });

    expect(api!.getSubmission("4")!.documents[0].uploads).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: "Ya, Unggah Dokumen" }));

    await waitFor(() => {
      expect(api!.getSubmission("4")!.documents[0].uploads).toHaveLength(1);
    });

    await waitFor(() => {
      expect(screen.getByText("Menunggu Pemeriksaan Ulang")).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("button", { name: /Surat Permohonan Izin/i })[0]);

    await waitFor(() => {
      expect(screen.getByText("Unggah Ulang Dokumen Perbaikan")).toBeInTheDocument();
    });
  }, 10000);

  it("shows revision upload only for documents that require revision in user verification detail", async () => {
    const StageHarness = () => {
      const { getSubmission, confirmPengajuan, submitVerificationSession } = useSubmissions();

      useEffect(() => {
        confirmPengajuan("4");
        const decisions = buildApprovedDecisions();
        decisions[0] = { status: "revision_required", note: "Perbaiki dokumen 1." };
        submitVerificationSession("4", decisions);
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);

      const submission = getSubmission("4");
      if (!submission) return null;
      return (
        <StageDetailUser
          submission={submission}
          stageIndex={1}
          stages={deriveStages(submission)}
        />
      );
    };

    render(
      <SubmissionProvider>
        <StageHarness />
      </SubmissionProvider>,
    );

    fireEvent.click(screen.getAllByRole("button", { name: /Surat Permohonan Izin/i })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: /Salinan Izin Usaha/i })[0]);

    await waitFor(() => {
      expect(screen.getAllByText("Unggah Dokumen Perbaikan")).toHaveLength(1);
    });

    expect(screen.getAllByText("Unggah Dokumen Perbaikan")).toHaveLength(1);
  });

  it("shows approval data in completed public persetujuan detail", () => {
    const StageHarness = () => {
      const { getSubmission } = useSubmissions();
      const submission = getSubmission("3");
      if (!submission) return null;
      return (
        <StageDetailUser
          submission={submission}
          stageIndex={3}
          stages={deriveStages(submission)}
        />
      );
    };

    render(
      <SubmissionProvider>
        <StageHarness />
      </SubmissionProvider>,
    );

    expect(screen.getByText("18 Februari 2026")).toBeInTheDocument();
    expect(screen.getByText("PB-UMKU-2026-00123")).toBeInTheDocument();
    expect(screen.getByText("SK-PB-UMKU-2026-00123.pdf")).toBeInTheDocument();
  });

  it("requires confirmation before creating a new submission from admin dashboard", async () => {
    let api: ReturnType<typeof useSubmissions> | null = null;
    const Capture = () => {
      api = useSubmissions();
      return null;
    };

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <SubmissionProvider>
            <Capture />
            <AdminDashboard />
          </SubmissionProvider>
        </AuthProvider>
      </MemoryRouter>,
    );

    const initialCount = api!.submissions.length;

    fireEvent.click(screen.getByRole("button", { name: "Buat Permohonan Baru" }));

    const formDialog = await screen.findByRole("dialog", { name: "Buat Permohonan Baru" });
    const dateInput = formDialog.querySelector('input[type="date"]') as HTMLInputElement;
    const selects = formDialog.querySelectorAll("select");

    fireEvent.change(dateInput, { target: { value: "2026-04-05" } });
    fireEvent.change(within(formDialog).getByPlaceholderText("Masukkan nomor permohonan"), {
      target: { value: "I-202604050000000999999" },
    });
    fireEvent.change(within(formDialog).getByPlaceholderText("Masukkan nama perusahaan/LPK"), {
      target: { value: "LPK Masa Depan" },
    });
    fireEvent.change(within(formDialog).getByPlaceholderText("Masukkan NIB"), {
      target: { value: "9988776655443" },
    });
    fireEvent.change(selects[0], {
      target: { value: "78425" },
    });
    fireEvent.change(selects[1], {
      target: { value: "Baru" },
    });

    fireEvent.click(within(formDialog).getByRole("button", { name: "Buat Permohonan" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Buat Permohonan Baru?" })).toBeInTheDocument();
    });

    expect(api!.submissions).toHaveLength(initialCount);

    fireEvent.click(screen.getByRole("button", { name: "Ya, Buat Permohonan" }));

    await waitFor(() => {
      expect(api!.submissions).toHaveLength(initialCount + 1);
    });
  });

  it("shows dashboard summary counts from the same submissions shown in the table", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <SubmissionProvider>
            <AdminDashboard />
          </SubmissionProvider>
        </AuthProvider>
      </MemoryRouter>,
    );

    const expectations = [
      ["Pengajuan", "1"],
      ["Verifikasi Dokumen", "1"],
      ["Peninjauan", "1"],
      ["Persetujuan", "0"],
      ["Izin Terbit", "1"],
    ];

    expectations.forEach(([label, count]) => {
      const card = screen.getByRole("button", { name: new RegExp(label, "i") });
      expect(within(card).getByText(count)).toBeInTheDocument();
    });
  });

  it("keeps submissions empty after deleting all data and remounting provider", async () => {
    let api: ReturnType<typeof useSubmissions> | null = null;
    const Capture = () => {
      api = useSubmissions();
      return null;
    };

    const firstRender = render(
      <SubmissionProvider>
        <Capture />
      </SubmissionProvider>,
    );

    act(() => {
      api!.submissions.forEach((submission) => {
        api!.deleteSubmission(submission.id);
      });
    });

    expect(api!.submissions).toHaveLength(0);
    await waitFor(() => {
      expect(window.localStorage.getItem(SUBMISSION_STORAGE_KEY)).toBe("[]");
    });

    firstRender.unmount();

    render(
      <SubmissionProvider>
        <Capture />
      </SubmissionProvider>,
    );

    expect(api!.submissions).toHaveLength(0);
  });
});
