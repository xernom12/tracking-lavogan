import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Index from "@/pages/Index";
import { SubmissionProvider } from "@/contexts/SubmissionContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { useSubmissions } from "@/contexts/useSubmissions";

describe("public live sync", () => {
  it("refreshes tracked submission details without auto-scrolling the public page", async () => {
    const scrollIntoView = vi.fn();

    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });

    let api: ReturnType<typeof useSubmissions> | null = null;

    const Capture = () => {
      api = useSubmissions();
      return null;
    };

    render(
      <MemoryRouter>
        <AuthProvider>
          <SubmissionProvider>
            <Capture />
            <Index />
          </SubmissionProvider>
        </AuthProvider>
      </MemoryRouter>,
    );

    const searchInput = screen.getByLabelText(/nomor permohonan/i);
    const searchButton = screen.getByRole("button", { name: /lacak permohonan/i });

    fireEvent.change(searchInput, {
      target: { value: "I-202602041419000683202" },
    });
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(document.getElementById("tracking-result-summary")).not.toBeNull();
    }, { timeout: 5000 });

    expect(scrollIntoView).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole("button", { name: /salinan akreditasi/i })[0]);

    await waitFor(() => {
      expect(screen.getByText(/unggah dokumen perbaikan/i)).toBeInTheDocument();
    });

    act(() => {
      api!.uploadRevisionDocument("1", "VERIFIKASI", 3, {
        fileName: "Revisi-Akreditasi.pdf",
        fileSizeBytes: 204800,
      });
    });

    fireEvent.click(screen.getAllByRole("button", { name: /salinan akreditasi/i })[0]);

    await waitFor(() => {
      expect(screen.getByText(/unggahan terakhir/i)).toBeInTheDocument();
      expect(screen.getByText(/Revisi-Akreditasi\.pdf/i)).toBeInTheDocument();
    });

    expect(scrollIntoView).not.toHaveBeenCalled();
  }, 10000);
});
