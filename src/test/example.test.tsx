import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import SummaryCard from "@/components/SummaryCard";
import { normalizeKbliCode } from "@/data/kbliOptions";

describe("example", () => {
  it("should pass", () => {
    expect(true).toBe(true);
  });

  it("shows overview field as status permohonan", () => {
    render(
      <SummaryCard
        submissionNumber="I-2026041300001"
        submissionType="Baru"
        organizationName="LPK Contoh"
        kbli="85493"
        nib="1234567890123"
        currentStatus="Memerlukan Perbaikan"
        licenseStatus="-"
        lastUpdated="13 April 2026"
      />,
    );

    expect(screen.getByText("Status Permohonan")).toBeInTheDocument();
    expect(screen.queryByText("Tahapan Saat Ini")).not.toBeInTheDocument();
  });

  it("normalizes KBLI values into a stable code", () => {
    expect(normalizeKbliCode("78425 - Pelatihan Kerja Bisnis dan Manajemen Swasta")).toBe("78425");
    expect(normalizeKbliCode(" 85493 ")).toBe("85493");
  });
});
