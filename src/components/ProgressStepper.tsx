import { Check, Pencil } from "lucide-react";
import type { Stage, StageStatus } from "@/data/mockData";

interface ProgressStepperProps {
  stages: Stage[];
  selectedIndex?: number;
  onStageClick?: (index: number) => void;
}

const ProgressStepper = ({ stages, selectedIndex, onStageClick }: ProgressStepperProps) => {
  const lastCompletedIndex = stages.reduce((acc, s, i) => s.status === "completed" ? i : acc, -1);
  const activeIndex = stages.findIndex((s) => s.status === "active");
  const fillUpTo = activeIndex >= 0 ? activeIndex : lastCompletedIndex;

  const totalSegments = stages.length - 1;
  const progressPct = totalSegments > 0 ? (fillUpTo / totalSegments) * 100 : 0;

  return (
    <div className="app-surface-card p-5 sm:p-8 relative overflow-hidden transition-shadow duration-300">
      <div className="absolute inset-x-0 top-0 h-px bg-slate-100 pointer-events-none" />

      <div className="flex items-start justify-between relative px-2 sm:px-8 mt-4 z-10 w-full h-[84px] sm:h-[90px]">
        {/* Track Line */}
        <div className="absolute top-[18px] left-[8%] right-[8%] h-[3px] bg-slate-100 rounded-full" />
        {/* Progress line */}
        <div
          className="absolute top-[18px] left-[8%] h-[3px] bg-primary transition-all duration-1000 ease-out rounded-full shadow-[0_0_8px_rgba(13,148,136,0.2)]"
          style={{ width: `calc((84%) * ${progressPct / 100})` }}
        />

        {stages.map((stage, i) => {
          const clickable = stage.status !== "locked";
          const isSelected = selectedIndex === i;
          return (
            <button
              key={i}
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onStageClick?.(i)}
              aria-label={`${stage.label}. Status ${stage.status === "completed" ? "selesai" : stage.status === "active" ? "aktif" : "belum diproses"}.`}
              aria-current={isSelected ? "step" : undefined}
              aria-pressed={isSelected}
              className={`relative flex flex-col items-center flex-1 bg-transparent border-0 p-0 group ${clickable ? "cursor-pointer" : "cursor-not-allowed opacity-70"}`}
            >
              <StepIcon status={stage.status} index={i} clickable={clickable} />
              <div className="flex flex-col items-center">
                <p className={`mt-3.5 sm:mt-4 text-[11px] sm:text-[12.5px] leading-snug text-center px-1 transition-all duration-300 max-w-[74px] sm:max-w-[110px] ${
                  stage.status === "completed" ? "text-slate-800 font-bold"
                  : stage.status === "active" ? "text-primary font-bold"
                  : "text-slate-400 font-semibold"
                }`}>
                  {stage.label}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const StepIcon = ({ status, index, clickable }: { status: StageStatus; index: number; clickable?: boolean }) => {
  if (status === "completed") {
    return (
      <div className="relative z-10 w-[38px] h-[38px] rounded-full bg-primary text-white flex items-center justify-center shadow-md transition-transform hover:scale-105 duration-300">
        <Check className="w-[18px] h-[18px] stroke-[3]" />
      </div>
    );
  }

  if (status === "active") {
    return (
      <div className="relative z-10 w-[38px] h-[38px] rounded-full bg-white border-[2.5px] border-primary text-primary flex items-center justify-center ring-[6px] ring-primary/20 transition-transform hover:scale-105 duration-300">
        <Pencil className="w-[16px] h-[16px] stroke-[2.5]" />
      </div>
    );
  }

  return (
    <div className={`relative z-10 w-[38px] h-[38px] rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-sm border border-slate-200 transition-colors ${clickable ? "group-hover:text-slate-500 group-hover:border-slate-300" : ""}`}>
      {index + 1}
    </div>
  );
};

export default ProgressStepper;
