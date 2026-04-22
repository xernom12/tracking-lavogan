import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Timeline from "@/components/Timeline";
import { initialSubmissions } from "@/data/initialSubmissions";

describe("Timeline", () => {
  it("shows only relevant verification history for the active phase", () => {
    render(
      <Timeline
        submission={initialSubmissions[0]}
        activePhase="VERIFIKASI"
      />,
    );

    expect(screen.getByRole("heading", { name: "Riwayat Permohonan" })).toBeInTheDocument();
    expect(screen.queryByText("Tahapan: Verifikasi Dokumen")).not.toBeInTheDocument();
    expect(screen.queryByText(/Nomor Permohonan:/i)).not.toBeInTheDocument();
    expect(screen.getByText("Menunggu Verifikasi K/L")).toBeInTheDocument();
    expect(screen.getByText("Permohonan Perlu Diperbaiki")).toBeInTheDocument();
    expect(screen.getByText("Permohonan Dikirim")).toBeInTheDocument();
    expect(screen.getByText(/Sertifikat sudah kadaluarsa/i)).toBeInTheDocument();
    expect(screen.getByText("Diverifikasi oleh K/L - Verifikator")).toBeInTheDocument();

    expect(
      screen.queryByText("Dokumen Surat Permohonan Izin dinyatakan sesuai persyaratan."),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Data Persetujuan Disimpan")).not.toBeInTheDocument();
  });

  it("shows issuance history for the izin terbit phase", () => {
    render(
      <Timeline
        submission={initialSubmissions[2]}
        activePhase="IZIN_TERBIT"
      />,
    );

    expect(screen.getByText("Menunggu Penetapan Izin")).toBeInTheDocument();
    expect(screen.getByText("Izin PB UMKU Diterbitkan")).toBeInTheDocument();
    expect(screen.getByText("Permohonan Dikirim")).toBeInTheDocument();
    expect(screen.queryByText(/Status Izin: Aktif/i)).not.toBeInTheDocument();
  });
});
