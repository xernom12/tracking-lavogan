import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Compass } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import EmptyState from "@/components/EmptyState";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404: Pengguna mencoba mengakses rute yang tidak tersedia:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="public" />
      <main className="px-4 sm:px-6 py-16 sm:py-24">
        <div className="app-surface-card mx-auto max-w-3xl p-6 sm:p-10">
          <EmptyState
            icon={Compass}
            title="Halaman tidak ditemukan"
            description={`Halaman ${location.pathname} tidak tersedia atau alamat yang dibuka tidak valid.`}
            action={(
              <Link
                to="/"
                className="app-primary-button inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold"
              >
                Kembali ke Beranda
              </Link>
            )}
          />
        </div>
      </main>
    </div>
  );
};

export default NotFound;
