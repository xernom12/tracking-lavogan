import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/useAuth";
import { LogIn } from "lucide-react";

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(email, password)) {
      navigate("/admin");
    } else {
      setError("Email dan password wajib diisi.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 right-0 w-full md:w-1/2 h-full bg-primary/5 rounded-l-[100px] pointer-events-none transform translate-x-1/3 md:translate-x-1/4" />
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-primary/10 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute -bottom-32 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[80px] pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-[1200px] mx-auto px-4 md:px-8 py-12 flex flex-col md:flex-row items-center justify-between gap-12 lg:gap-24 relative z-10">

        {/* Left Side - Brand / Info (Hidden on small screens) */}
        <div className="hidden md:flex flex-col flex-1 max-w-lg">
          <div className="inline-flex items-center gap-3 bg-white px-4 py-2 rounded-full shadow-sm w-fit mb-8 border border-slate-100">
            <img src="/logo/kemnaker.png" alt="Logo Kemnaker" className="h-6 w-auto" />
            <span className="text-sm font-bold text-slate-700">Kementerian Ketenagakerjaan Republik Indonesia</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-heading font-black text-slate-900 leading-[1.15] tracking-tight mb-6">
            Portal Admin <br />
            <span className="text-primary relative">
              PB UMKU
              <svg className="absolute w-full h-3 -bottom-1 left-0 text-primary/30" viewBox="0 0 100 10" preserveAspectRatio="none">
                <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="4" fill="transparent" strokeLinecap="round" />
              </svg>
            </span>
          </h1>
          <p className="text-slate-600 text-lg leading-relaxed mb-10">
            Kelola dan pantau seluruh permohonan PB UMKU dengan lebih mudah.
          </p>
          <div className="flex gap-4">
            <button
              onClick={() => navigate("/")}
              className="app-secondary-button rounded-xl px-6 py-3 text-sm font-bold"
            >
              Kembali ke Beranda Publik
            </button>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="flex-1 w-full max-w-md mx-auto md:mx-0">
          {/* Mobile Header (Visible only on small screens) */}
          <div className="md:hidden flex flex-col items-center mb-8 text-center">
            <div className="inline-flex items-center gap-2 bg-white px-3 py-1.5 rounded-full shadow-sm mb-4 border border-slate-100">
              <img src="/logo/kemnaker.png" alt="Logo Kemnaker" className="h-5 w-auto" />
            </div>
            <h1 className="text-2xl font-heading font-black text-slate-900 mb-2">Portal Admin</h1>
            <p className="text-slate-600 text-sm">Masuk untuk mengelola permohonan PB UMKU</p>
          </div>

          {/* Login Card */}
          <div className="bg-white/80 backdrop-blur-xl border border-white shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] rounded-[2rem] p-8 sm:p-10 relative overflow-hidden">
            {/* Inner Decorative element */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/20 to-transparent rounded-bl-full pointer-events-none opacity-50" />

            <div className="mb-8 p-1">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-teal-600 flex items-center justify-center mb-6 shadow-lg shadow-primary/30">
                <LogIn className="w-6 h-6 text-white stroke-[2.5]" />
              </div>
              <h2 className="text-2xl font-heading font-bold text-slate-900 mb-1.5">Selamat Datang</h2>
              <p className="text-sm text-slate-500 font-medium">Masuk ke akun admin untuk melanjutkan.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-slate-700 tracking-wide">Email</label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError("");
                    }}
                    placeholder="admin@kemnaker.go.id"
                    className="app-form-field h-12 bg-slate-50/70 text-[15px]"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-slate-700 tracking-wide">Password</label>
                <div className="relative">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError("");
                    }}
                    placeholder="********"
                    className="app-form-field h-12 bg-slate-50/70 text-[15px]"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-xl border border-status-revision/20 bg-status-revision/10 p-3 text-sm font-semibold text-status-revision animate-in fade-in slide-in-from-top-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="app-primary-button mt-2 inline-flex h-11 w-full items-center justify-center rounded-xl text-sm font-semibold"
              >
                Masuk
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-400">
              <p>Sistem Pelacakan PB UMKU</p>
              <p>Versi 2.0</p>
            </div>

            <button
              onClick={() => navigate("/")}
              className="md:hidden w-full mt-4 p-3 text-slate-500 font-bold text-sm text-center hover:text-slate-800 transition-colors"
            >
              Kembali ke Beranda
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
