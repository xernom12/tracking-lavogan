import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/useAuth";

const AdminLogin = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialMode = searchParams.get("mode") === "register" ? "register" : "login";
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [registrationCode, setRegistrationCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const isRegisterMode = mode === "register";
  const clearError = () => {
    if (error) setError("");
  };

  const switchMode = (nextMode: "login" | "register") => {
    setMode(nextMode);
    setSearchParams(nextMode === "register" ? { mode: "register" } : {}, { replace: true });
    setError("");
    setPassword("");
    setConfirmPassword("");
    setRegistrationCode("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;

    const normalizedEmail = email.trim();
    if (isRegisterMode && !fullName.trim()) {
      setError("Nama lengkap wajib diisi.");
      return;
    }

    if (!normalizedEmail || !password.trim()) {
      setError("Email dan password wajib diisi.");
      return;
    }

    if (isRegisterMode) {
      if (password.length < 8) {
        setError("Password minimal 8 karakter.");
        return;
      }

      if (password !== confirmPassword) {
        setError("Konfirmasi password tidak sama.");
        return;
      }
    }

    setError("");
    setIsSubmitting(true);

    try {
      const isSuccess = isRegisterMode
        ? await register({
          fullName,
          email: normalizedEmail,
          password,
          registrationCode,
        })
        : await login(normalizedEmail, password);

      if (isSuccess) {
        navigate("/admin");
        return;
      }

      setError(isRegisterMode
        ? "Pendaftaran gagal. Periksa data dan kode pendaftaran Anda."
        : "Email atau password admin tidak valid.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col items-center justify-center">
        <section
          className={`w-full rounded-lg border border-slate-200/90 bg-white px-6 py-9 shadow-[0_22px_60px_rgba(15,23,42,0.10),0_2px_8px_rgba(15,23,42,0.05)] sm:px-10 sm:py-11 ${
            isRegisterMode ? "max-w-[480px]" : "max-w-[420px]"
          }`}
          aria-labelledby="admin-auth-title"
        >
          <div className="mb-8">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="mb-8 inline-flex items-center"
              aria-label="Kembali ke beranda publik"
            >
              <img src="/logo/kemnaker.png" alt="Logo Kemnaker" className="h-8 w-auto" />
            </button>
            <p className="mb-2 text-[15px] font-semibold text-slate-500">
              {isRegisterMode ? "Silakan isi data akun" : "Silakan masukkan detail akun"}
            </p>
            <h1 id="admin-auth-title" className="font-heading text-3xl font-black leading-tight text-slate-900 sm:text-[2rem]">
              {isRegisterMode ? "Daftar akun admin" : "Selamat datang"}
            </h1>
            <p className="mt-3 text-sm font-medium leading-6 text-slate-500">
              {isRegisterMode
                ? "Gunakan kode pendaftaran internal untuk membuat akses admin baru."
                : "Masuk ke Portal Admin PB UMKU untuk melanjutkan pengelolaan permohonan."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {isRegisterMode && (
              <>
                <label htmlFor="admin-full-name" className="sr-only">Nama lengkap</label>
                <input
                  id="admin-full-name"
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    clearError();
                  }}
                  placeholder="Nama lengkap"
                  className="app-form-field h-12 rounded-lg bg-white px-4 text-[15px] font-medium shadow-[0_1px_2px_rgba(15,23,42,0.04)] focus:shadow-[0_8px_20px_rgba(13,148,136,0.10)]"
                />
              </>
            )}

            <label htmlFor="admin-email" className="sr-only">Email</label>
            <input
              id="admin-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearError();
              }}
              placeholder="Email admin"
              className="app-form-field h-12 rounded-lg bg-white px-4 text-[15px] font-medium shadow-[0_1px_2px_rgba(15,23,42,0.04)] focus:shadow-[0_8px_20px_rgba(13,148,136,0.10)]"
            />

            <label htmlFor="admin-password" className="sr-only">Password</label>
            <input
              id="admin-password"
              type="password"
              autoComplete={isRegisterMode ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearError();
              }}
              placeholder="Password"
              className="app-form-field h-12 rounded-lg bg-white px-4 text-[15px] font-medium shadow-[0_1px_2px_rgba(15,23,42,0.04)] focus:shadow-[0_8px_20px_rgba(13,148,136,0.10)]"
            />

            {isRegisterMode && (
              <>
                <label htmlFor="admin-confirm-password" className="sr-only">Konfirmasi password</label>
                <input
                  id="admin-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    clearError();
                  }}
                  placeholder="Konfirmasi password"
                  className="app-form-field h-12 rounded-lg bg-white px-4 text-[15px] font-medium shadow-[0_1px_2px_rgba(15,23,42,0.04)] focus:shadow-[0_8px_20px_rgba(13,148,136,0.10)]"
                />

                <label htmlFor="admin-registration-code" className="sr-only">Kode pendaftaran</label>
                <input
                  id="admin-registration-code"
                  type="password"
                  autoComplete="one-time-code"
                  value={registrationCode}
                  onChange={(e) => {
                    setRegistrationCode(e.target.value);
                    clearError();
                  }}
                  placeholder="Kode pendaftaran"
                  className="app-form-field h-12 rounded-lg bg-white px-4 text-[15px] font-medium shadow-[0_1px_2px_rgba(15,23,42,0.04)] focus:shadow-[0_8px_20px_rgba(13,148,136,0.10)]"
                />
              </>
            )}

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-status-revision/20 bg-status-revision/10 p-3 text-sm font-semibold text-status-revision animate-in fade-in slide-in-from-top-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="app-primary-button mt-4 inline-flex h-12 w-full items-center justify-center rounded-lg text-sm font-semibold shadow-[0_12px_26px_rgba(13,148,136,0.22),0_2px_6px_rgba(15,23,42,0.08)] hover:shadow-[0_16px_34px_rgba(13,148,136,0.28),0_2px_8px_rgba(15,23,42,0.08)]"
            >
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memproses...
                </span>
              ) : (
                isRegisterMode ? "Daftar dan Masuk" : "Masuk"
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-5 text-center">
            <p className="text-sm font-medium text-slate-500">
              {isRegisterMode ? "Sudah memiliki akun admin?" : "Belum memiliki akun admin?"}{" "}
              <button
                type="button"
                onClick={() => switchMode(isRegisterMode ? "login" : "register")}
                className="font-bold text-primary underline-offset-4 transition-colors hover:text-primary/80 hover:underline"
              >
                {isRegisterMode ? "Masuk" : "Daftar akun"}
              </button>
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate("/")}
            className="mt-5 w-full text-center text-xs font-bold text-slate-400 transition-colors hover:text-slate-700"
          >
            Kembali ke beranda publik
          </button>
        </section>
      </div>
    </main>
  );
};

export default AdminLogin;
