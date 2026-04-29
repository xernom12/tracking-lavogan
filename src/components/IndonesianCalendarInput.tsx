import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { id as indonesianLocale } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface IndonesianCalendarInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  hasError?: boolean;
  max?: string;
  placeholder?: string;
}

const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const getTodayDateInputValue = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const parseDateInputValue = (value: string): Date | undefined => {
  if (!DATE_INPUT_PATTERN.test(value)) return undefined;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return Number.isNaN(date.getTime()) ? undefined : date;
};

const formatDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const formatIndonesianDisplayDate = (value: string) => {
  const date = parseDateInputValue(value);
  if (!date) return "";

  const day = String(date.getDate()).padStart(2, "0");
  const month = date.toLocaleDateString("id-ID", { month: "long" });
  const year = date.getFullYear();

  return `${day} ${month} ${year}`;
};

const IndonesianCalendarInput = ({
  id,
  value,
  onChange,
  className = "",
  hasError = false,
  max = getTodayDateInputValue(),
  placeholder = "Pilih tanggal",
}: IndonesianCalendarInputProps) => {
  const [open, setOpen] = useState(false);
  const selectedDate = useMemo(() => parseDateInputValue(value), [value]);
  const maxDate = useMemo(() => parseDateInputValue(max), [max]);
  const displayValue = formatIndonesianDisplayDate(value);

  const handleSelect = (date?: Date) => {
    if (!date) return;
    onChange(formatDateInputValue(date));
    setOpen(false);
  };

  const handleToday = () => {
    onChange(max);
    setOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setOpen(false);
  };

  return (
    <div className="relative">
      <input
        id={`${id}-native`}
        type="date"
        lang="id-ID"
        max={max}
        value={value}
        onChange={(event) => {
          const nextValue = event.target.value;
          if (nextValue && nextValue.split("-")[0].length > 4) return;
          onChange(nextValue);
        }}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            className={`${className} ${hasError ? "app-form-field-error" : ""} flex items-center justify-between gap-3 text-left`}
            aria-label={displayValue ? `Tanggal terpilih ${displayValue}` : placeholder}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-invalid={hasError}
          >
            <span className={displayValue ? "text-slate-800" : "text-slate-400"}>
              {displayValue || placeholder}
            </span>
            <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto rounded-[1.25rem] border-slate-200 p-0 shadow-elevated">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            locale={indonesianLocale}
            disabled={maxDate ? { after: maxDate } : undefined}
            initialFocus
            classNames={{
              caption_label: "text-sm font-semibold capitalize text-slate-900",
              head_cell: "w-9 rounded-md text-[0.78rem] font-semibold text-slate-500",
              day: "h-9 w-9 p-0 font-medium aria-selected:opacity-100",
              day_today: "bg-primary/10 text-primary",
            }}
          />
          <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2.5">
            <button
              type="button"
              onClick={handleClear}
              className="text-xs font-semibold text-slate-500 transition-colors hover:text-slate-800"
            >
              Hapus
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="text-xs font-semibold text-primary transition-colors hover:text-primary/80"
            >
              Hari ini
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default IndonesianCalendarInput;
