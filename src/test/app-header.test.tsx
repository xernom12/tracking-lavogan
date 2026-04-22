import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import AppHeader from "@/components/AppHeader";
import { AuthProvider } from "@/contexts/AuthContext";

describe("AppHeader", () => {
  it("runs the public logo callback when the Kemnaker logo is clicked", () => {
    const onLogoClick = vi.fn();

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <AppHeader variant="public" onLogoClick={onLogoClick} />
        </AuthProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByLabelText("Kembali ke beranda"));

    expect(onLogoClick).toHaveBeenCalledTimes(1);
  });
});
