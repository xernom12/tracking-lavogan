import { Loader2, Search } from "lucide-react";
import { useRef, useState } from "react";

interface SearchSectionProps {
  onSearch: (query: string) => boolean | Promise<boolean>;
  onSearchingChange?: (isSearching: boolean) => void;
}

const SearchSection = ({ onSearch, onSearchingChange }: SearchSectionProps) => {
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      setError("Nomor permohonan wajib diisi.");
      inputRef.current?.focus();
      return;
    }

    if (isSearching) return;

    setError("");
    setIsSearching(true);
    onSearchingChange?.(true);

    try {
      const [found] = await Promise.all([
        Promise.resolve(onSearch(normalizedQuery)),
        new Promise((resolve) => setTimeout(resolve, 250)),
      ]);

      if (found === false) {
        setError("Nomor permohonan tidak ditemukan. Periksa kembali nomor permohonan Anda.");
      }
    } finally {
      setIsSearching(false);
      onSearchingChange?.(false);
    }
  };

  return (
    <section className="bg-gradient-to-b from-primary/5 via-background to-background pt-20 sm:pt-24 pb-6 sm:pb-10 px-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl h-[500px] bg-primary/10 blur-[100px] pointer-events-none rounded-full mix-blend-multiply" />
      <div className="absolute top-20 -left-20 w-72 h-72 bg-primary/10 blur-[80px] pointer-events-none rounded-full mix-blend-multiply" />
      <div className="absolute top-40 -right-20 w-80 h-80 bg-teal-400/10 blur-[80px] pointer-events-none rounded-full mix-blend-multiply" />

      <div className="relative max-w-5xl mx-auto text-center z-10 animate-fade-in-up">
        <div className="inline-flex items-center gap-2 bg-white/60 rounded-full px-4 sm:px-5 py-2 mb-5 sm:mb-8 shadow-sm border border-white/80 backdrop-blur-md">
          <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse-soft shadow-[0_0_10px_rgba(37,99,235,0.5)]" />
          <span className="text-secondary-foreground text-xs font-bold tracking-widest uppercase">
            Sistem Pelacakan Permohonan
          </span>
        </div>

        <h1 className="text-[2rem] sm:text-4xl md:text-5xl lg:text-6xl font-heading font-black text-foreground mb-4 sm:mb-6 tracking-tighter py-1 mx-auto leading-[1.15]">
          <span className="block">PB UMKU/OSS Penyelenggaraan</span>
          <span className="block">Pemagangan Luar Negeri</span>
        </h1>

        <p className="text-slate-600 font-medium mb-7 sm:mb-12 max-w-2xl mx-auto text-[14px] sm:text-lg leading-relaxed px-2 sm:px-0">
          Pantau status pengajuan Perizinan PB UMKU/OSS Penyelenggaraan Pemagangan Luar Negeri untuk Kepentingan Perusahaan melalui OSS.
        </p>

        <form
          onSubmit={handleSubmit}
          className={`flex flex-col sm:flex-row items-stretch sm:items-center p-2 max-w-2xl mx-auto relative z-20 bg-white/90 backdrop-blur-xl shadow-elevated rounded-2xl border border-white transition-all duration-300 ${error
            ? "border-destructive/50 ring-4 ring-destructive/10"
            : "hover:border-primary/30 focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/15"
            }`}
          aria-busy={isSearching}
        >
          <div className="flex-1 flex items-center pl-4 sm:pl-5">
            <Search className={`w-6 h-6 shrink-0 transition-colors ${error ? "text-destructive" : "text-primary/60"}`} />
            <label htmlFor="submission-search" className="sr-only">
              Nomor permohonan
            </label>
            <input
              id="submission-search"
              ref={inputRef}
              type="text"
              autoComplete="off"
              spellCheck="false"
              placeholder="Masukkan nomor permohonan"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setQuery("");
                  setError("");
                  inputRef.current?.focus();
                }
              }}
              aria-invalid={!!error}
              aria-describedby={error ? "search-error" : undefined}
              className="w-full bg-transparent border-none outline-none focus:ring-0 text-foreground font-medium placeholder:text-slate-400 placeholder:font-normal px-3 sm:px-4 py-3 sm:py-4 text-[15px] sm:text-lg"
            />
          </div>
          <button
            type="submit"
            disabled={isSearching}
            className="app-primary-button inline-flex h-12 w-full min-w-[140px] shrink-0 items-center justify-center whitespace-nowrap rounded-xl px-6 text-sm font-semibold sm:w-auto"
          >
            {isSearching ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Mencari...</span>
              </span>
            ) : (
              <>
                <span className="text-[15px] sm:text-base">Lacak Permohonan</span>
              </>
            )}
          </button>
        </form>

        <div className="max-w-2xl mx-auto mt-2.5 sm:mt-3 px-2 text-left min-h-6" aria-live="polite">
          {isSearching ? (
            <p className="text-[13.5px] font-semibold text-slate-500 animate-fade-in-up">
              Mencari data permohonan...
            </p>
          ) : error ? (
            <p id="search-error" className="text-[13.5px] font-semibold text-destructive animate-fade-in-up">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
};

export default SearchSection;
