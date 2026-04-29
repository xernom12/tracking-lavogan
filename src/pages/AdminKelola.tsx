import { useParams, useNavigate } from "react-router-dom";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { useSubmissions } from "@/contexts/useSubmissions";
import { deriveDisplayStatus, deriveLicenseStatusLabel, deriveStages, getActiveStageIndex } from "@/data/mockData";
import { ArrowLeft } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import ProgressStepper from "@/components/ProgressStepper";
import AppHeader from "@/components/AppHeader";
import SummaryCard from "@/components/SummaryCard";
import { Skeleton } from "@/components/ui/skeleton";

const StageDetailAdmin = lazy(() => import("@/components/StageDetailAdmin"));

const AdminKelola = () => {
  const { id } = useParams<{ id: string }>();
  const { getSubmission } = useSubmissions();
  const navigate = useNavigate();

  const submission = getSubmission(id || "");
  const displayStatus = submission ? deriveDisplayStatus(submission) : null;
  const stages = submission ? deriveStages(submission) : [];
  const [selectedStage, setSelectedStage] = useState(() =>
    submission ? getActiveStageIndex(submission) : 0
  );
  const [isStageLoading, setIsStageLoading] = useState(false);
  const stageTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!submission) return;
    setSelectedStage(getActiveStageIndex(submission));
    setIsStageLoading(false);
  }, [submission]);

  useEffect(() => {
    return () => {
      if (stageTimeoutRef.current) {
        window.clearTimeout(stageTimeoutRef.current);
      }
    };
  }, []);

  const handleStageClick = (index: number) => {
    if (!submission) return;
    const nextStage = stages[index];
    if (!nextStage || nextStage.status === "locked" || index === selectedStage) return;

    setSelectedStage(index);
    setIsStageLoading(true);

    if (stageTimeoutRef.current) {
      window.clearTimeout(stageTimeoutRef.current);
    }

    stageTimeoutRef.current = window.setTimeout(() => {
      setIsStageLoading(false);
    }, 180);
  };

  if (!submission) {
    return (
      <div className="min-h-screen bg-slate-50">
        <AppHeader variant="admin" />
        <main className="max-w-4xl mx-auto px-4 py-12 sm:py-16">
          <div className="app-surface-card p-6 sm:p-10">
            <EmptyState
              title="Data permohonan tidak ditemukan"
              description="Permohonan yang Anda buka tidak tersedia atau sudah tidak ada di daftar."
              action={(
                <button
                  type="button"
                  onClick={() => navigate("/admin")}
                  className="app-primary-button inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold"
                >
                  Kembali ke Dashboard Admin
                </button>
              )}
            />
          </div>
      </main>
    </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 relative overflow-clip">
      <div className="absolute inset-x-0 top-0 h-40 bg-white/45 pointer-events-none" />

      <AppHeader variant="admin" />

	      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 relative z-10">
          <div className="app-section-stack max-w-6xl mx-auto w-full">
	        <div className="flex items-center gap-4">
	          <button
	            type="button"
	            aria-label="Kembali ke dashboard admin"
	            onClick={() => navigate("/admin")}
	            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200/80 bg-white/80 text-slate-500 shadow-sm transition-colors hover:bg-white hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
	          >
	            <ArrowLeft className="w-5 h-5" />
	          </button>
	          <div className="max-w-2xl">
	            <h1 className="app-page-title text-2xl">Kelola Permohonan</h1>
	            <p className="mt-0.5 text-sm font-medium leading-relaxed text-slate-500">Pantau dan verifikasi setiap tahapan permohonan secara lebih detail.</p>
	          </div>
	        </div>

        <SummaryCard
          submissionNumber={submission.submissionNumber}
          submissionType={submission.submissionType}
          organizationName={submission.organizationName}
          kbli={submission.kbli}
          nib={submission.nib}
          currentStatus={displayStatus?.label || "-"}
          licenseStatus={deriveLicenseStatusLabel(submission)}
          lastUpdated={submission.lastUpdated}
        />

        {/* Stepper */}
        <ProgressStepper stages={stages} selectedIndex={selectedStage} onStageClick={handleStageClick} />

        {/* Stage Detail */}
        <div aria-busy={isStageLoading}>
          {isStageLoading ? (
            <AdminStageDetailSkeleton />
          ) : (
            <Suspense fallback={<AdminStageDetailSkeleton />}>
              <StageDetailAdmin submission={submission} stageIndex={selectedStage} stages={stages} />
            </Suspense>
          )}
        </div>
        </div>
      </main>
    </div>
  );
};

const AdminStageDetailSkeleton = () => (
  <div className="app-surface-card p-5 sm:p-8" aria-hidden="true">
    <Skeleton className="h-7 w-40 rounded-xl" />
    <div className="mt-6 space-y-4">
      <Skeleton className="h-20 w-full rounded-2xl" />
      <Skeleton className="h-20 w-full rounded-2xl" />
      <Skeleton className="h-20 w-full rounded-2xl" />
    </div>
  </div>
);

export default AdminKelola;

