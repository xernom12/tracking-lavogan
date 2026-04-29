import type { MouseEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "@/contexts/useAuth";

interface AppHeaderProps {
  variant?: "public" | "admin";
  onLogoClick?: () => void;
}

const AppHeader = ({ variant = "public", onLogoClick }: AppHeaderProps) => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogoClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    onLogoClick?.();
    const targetUrl = variant === "admin" ? "/admin" : "/";
    navigate(targetUrl);
  };

  return (
    <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-white/50 shadow-sm py-4 px-6 sm:px-12 lg:px-20 transition-all duration-300">
      <div className="w-full max-w-[1800px] mx-auto flex items-center justify-between">
        <Link
          to={variant === "admin" ? "/admin" : "/"}
          onClick={handleLogoClick}
          className="flex items-center"
          aria-label={variant === "admin" ? "Kembali ke dashboard admin" : "Kembali ke beranda"}
        >
          <img
            src="/logo/kemnaker.png"
            alt="Logo Kementerian Ketenagakerjaan"
            className="h-10 sm:h-12 w-auto object-contain drop-shadow-sm"
          />
        </Link>

        <div className="flex items-center gap-2 sm:gap-2.5">
          {variant === "public" && (
            <>
              <button
                onClick={() => navigate("/admin/login")}
                aria-label="Masuk ke dashboard admin"
                className="app-secondary-button inline-flex h-10 min-w-[4.75rem] items-center justify-center rounded-xl px-3 text-sm font-semibold text-slate-950 sm:h-12 sm:min-w-[6.25rem] sm:px-5 sm:text-base"
              >
                Masuk
              </button>
              <button
                onClick={() => navigate("/admin/login?mode=register")}
                aria-label="Daftar akun admin"
                className="app-primary-button inline-flex h-10 min-w-[4.75rem] items-center justify-center rounded-xl px-3 text-sm font-semibold sm:h-12 sm:min-w-[6.25rem] sm:px-5 sm:text-base"
              >
                Daftar
              </button>
            </>
          )}

          {variant === "admin" && (
            <>
              <button
                onClick={() => { logout(); navigate("/"); }}
                aria-label="Keluar dari dashboard admin"
                className="app-secondary-button inline-flex h-10 min-w-[5.5rem] items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-950 sm:h-12 sm:min-w-[6.5rem] sm:px-5 sm:text-base"
              >
                <LogOut className="h-4 w-4" />
                Keluar
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
