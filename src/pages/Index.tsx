import { Suspense, lazy, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import SearchSection from "@/components/SearchSection";
import AppHeader from "@/components/AppHeader";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdminSubmission } from "@/contexts/SubmissionContext";
import { useSubmissions } from "@/contexts/useSubmissions";
import { deriveStages, deriveDisplayStatus, deriveLicenseStatusLabel, getActiveStageIndex } from "@/data/mockData";

const SummaryCard = lazy(() => import("@/components/SummaryCard"));
const ProgressStepper = lazy(() => import("@/components/ProgressStepper"));
const StageDetailUser = lazy(() => import("@/components/StageDetailUser"));
const Timeline = lazy(() => import("@/components/Timeline"));
const PublishedTable = lazy(() => import("@/components/PublishedTable"));
const STAGE_PHASES = ["PENGAJUAN", "VERIFIKASI", "PENINJAUAN", "PERSETUJUAN", "IZIN_TERBIT"] as const;

const Index = () => {
  const [trackedSubmissionId, setTrackedSubmissionId] = useState<string | null>(null);
  const [selectedStage, setSelectedStage] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [resultScrollKey, setResultScrollKey] = useState(0);
  const [searchResetKey, setSearchResetKey] = useState(0);
  const { findBySubmissionNumber, getSubmission } = useSubmissions();
  const submission = trackedSubmissionId ? getSubmission(trackedSubmissionId) || null : null;

  const handleSearch = async (nextQuery: string) => {
    const normalizedQuery = nextQuery.trim();
    if (!normalizedQuery) {
      return;
    }

    const found = findBySubmissionNumber(normalizedQuery);

    if (found) {
      setTrackedSubmissionId(found.id);
      setSelectedStage(getActiveStageIndex(found));
      setResultScrollKey((current) => current + 1);
    } else {
      setTrackedSubmissionId(null);
    }

    return !!found;
  };

  useEffect(() => {
    if (isSearching || !submission || resultScrollKey === 0) return undefined;

    const timeoutIds: number[] = [];
    const scrollToResult = (attempt = 0) => {
      const resultSummary = document.getElementById("tracking-result-summary");

      if (resultSummary) {
        resultSummary.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        return;
      }

      if (attempt >= 12) return;
      timeoutIds.push(window.setTimeout(() => scrollToResult(attempt + 1), 100));
    };

    timeoutIds.push(window.setTimeout(() => scrollToResult(), 80));

    return () => timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
  }, [isSearching, resultScrollKey, submission]);

  const scrollToStageDetails = () => {
    window.setTimeout(() => {
      document.getElementById("stage-details")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  };

  const handleHomeReset = () => {
    setTrackedSubmissionId(null);
    setSelectedStage(0);
    setIsSearching(false);
    setResultScrollKey(0);
    setSearchResetKey((current) => current + 1);
  };

  const handleStageClick = (index: number) => {
    if (!submission) return;
    const stages = deriveStages(submission);
    if (stages[index].status !== "locked") {
      setSelectedStage(index);
      scrollToStageDetails();
    }
  };

  const stages = submission ? deriveStages(submission) : [];
  const displayStatus = submission ? deriveDisplayStatus(submission) : null;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="public" onLogoClick={handleHomeReset} />

      <SearchSection
        key={searchResetKey}
        onSearch={handleSearch}
        onSearchingChange={setIsSearching}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pb-10" aria-busy={isSearching}>

        <AnimatePresence mode="wait">
          {isSearching ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="app-content-stack pt-0 max-w-6xl mx-auto"
            >
              <SearchResultSkeleton />
            </motion.div>
          ) : submission && displayStatus ? (
            <Suspense fallback={<SearchResultSkeleton />}>
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="app-content-stack pt-0 max-w-6xl mx-auto"
              >
                <div id="tracking-result-summary" className="scroll-mt-24">
                  <SummaryCard
                    submissionNumber={submission.submissionNumber}
                    submissionType={submission.submissionType}
                    organizationName={submission.organizationName}
                    kbli={submission.kbli}
                    nib={submission.nib}
                    currentStatus={displayStatus.label}
                    licenseStatus={deriveLicenseStatusLabel(submission)}
                    lastUpdated={submission.lastUpdated}
                  />
                </div>
                <ProgressStepper stages={stages} selectedIndex={selectedStage} onStageClick={handleStageClick} />
                <div id="stage-details" className="grid grid-cols-1 gap-6 scroll-mt-6 lg:grid-cols-5">
                  <div className="lg:col-span-3 min-w-0">
                    <StageDetailUser submission={submission} stageIndex={selectedStage} stages={stages} />
                  </div>
                  <div className="lg:col-span-2 min-w-0 lg:self-start">
                    <Timeline
                      submission={submission}
                      activePhase={STAGE_PHASES[selectedStage] || "PENGAJUAN"}
                    />
                  </div>
                </div>
              </motion.div>
            </Suspense>
          ) : (
            <Suspense fallback={<PublishedTableSkeleton />}>
              <div key="empty" className="pt-0">
                <PublishedTable />
              </div>
            </Suspense>
          )}
        </AnimatePresence>
      </main>

      <footer className="mt-8 border-t border-border py-6">
        <p className="text-center text-xs text-muted-foreground">Hak Cipta 2026 Kementerian Ketenagakerjaan Republik Indonesia. Seluruh hak dilindungi.</p>
      </footer>
    </div>
  );
};

const SearchResultSkeleton = () => (
  <div className="max-w-6xl mx-auto space-y-6" aria-hidden="true">
    <div className="app-surface-card p-5 sm:p-8">
      <div className="mb-5 flex items-center gap-3 sm:mb-6">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-7 w-64 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="app-surface-tile p-3.5 sm:p-4">
            <Skeleton className="h-3 w-24 rounded-full" />
            <Skeleton className="mt-3 h-4 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>

    <div className="app-surface-card p-5 sm:p-8">
      <div className="flex gap-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex flex-1 flex-col items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-full" />
            <Skeleton className="h-3 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>

    <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
      <div className="app-surface-card lg:col-span-3 p-5 sm:p-8">
        <Skeleton className="h-7 w-40 rounded-xl" />
        <Skeleton className="mt-6 h-24 w-full rounded-2xl" />
        <div className="mt-4 space-y-3">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      </div>
      <div className="app-surface-card lg:col-span-2 p-4 sm:p-6">
        <Skeleton className="h-7 w-36 rounded-xl" />
        <div className="mt-4 space-y-3">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  </div>
);

const PublishedTableSkeleton = () => (
  <div className="max-w-6xl mx-auto" aria-hidden="true">
    <div className="app-surface-card overflow-hidden">
      <div className="border-b border-slate-100 px-6 py-5">
        <Skeleton className="h-7 w-72 rounded-xl" />
      </div>
      <div className="space-y-3 px-6 py-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-14 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  </div>
);

export default Index;
