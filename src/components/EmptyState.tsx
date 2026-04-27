import type { ReactNode } from "react";
import { Search } from "lucide-react";

interface EmptyStateProps {
  icon?: React.ElementType;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

const EmptyState = ({
  icon: Icon = Search,
  title,
  description,
  action,
  className = "",
  compact = false,
}: EmptyStateProps) => {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center whitespace-normal animate-fade-in-up ${compact ? "p-5 sm:p-6" : "p-6 sm:p-8"} ${className}`}
    >
      <div
        className={`flex items-center justify-center rounded-2xl bg-slate-100/80 mb-5 shadow-sm border border-slate-200/50 relative ${
          compact ? "w-12 h-12 sm:w-14 sm:h-14 mb-4" : "w-20 h-20"
        }`}
      >
        {/* Decorative blur blob */}
        <div className="absolute inset-0 bg-primary/10 rounded-2xl blur-[12px] -z-10" />
        <Icon className={`${compact ? "w-5 h-5 sm:w-6 sm:h-6" : "w-10 h-10"} text-slate-400 stroke-[1.5]`} />
      </div>
      <h3
        className={`font-heading font-black text-slate-800 ${
          compact ? "text-base sm:text-lg mb-1" : "text-xl sm:text-2xl mb-2"
        }`}
      >
        {title}
      </h3>
      <p
        className={`text-slate-500 font-medium max-w-md mx-auto ${
          compact ? "text-[12.5px] sm:text-[13px] leading-relaxed max-w-sm" : "text-[14px] sm:text-[15px] leading-relaxed"
        }`}
      >
        {description}
      </p>
      {action ? <div className={`${compact ? "mt-4 sm:mt-5" : "mt-6 sm:mt-8"}`}>{action}</div> : null}
    </div>
  );
};

export default EmptyState;
