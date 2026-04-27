import { useState, useMemo, useEffect } from "react";
import { useSubmissions } from "@/contexts/useSubmissions";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, FileText } from "lucide-react";
import EmptyState from "@/components/EmptyState";

type SortOption = "terbaru" | "terlama";

const monthMap: Record<string, number> = {
    januari: 0, februari: 1, maret: 2, april: 3, mei: 4, juni: 5,
    juli: 6, agustus: 7, september: 8, oktober: 9, november: 10, desember: 11,
};

const parseIndonesianDate = (dateStr: string): number => {
    if (!dateStr) return 0;
    const parts = dateStr.trim().split(" ");
    if (parts.length < 3) return 0;
    const day = parseInt(parts[0], 10);
    const month = monthMap[parts[1].toLowerCase()];
    const year = parseInt(parts[2], 10);
    if (isNaN(day) || month === undefined || isNaN(year)) return 0;
    return new Date(year, month, day).getTime();
};

const PublishedTable = () => {
    const { submissions } = useSubmissions();
    const [sortOption, setSortOption] = useState<SortOption>("terbaru");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(5);

    const publishedSubmissions = useMemo(() => {
        const filtered = submissions.filter((s) => s.licenseIssued);

        return filtered.sort((a, b) => {
            if (sortOption === "terbaru") {
                return parseIndonesianDate(b.licenseDate) - parseIndonesianDate(a.licenseDate);
            } else if (sortOption === "terlama") {
                return parseIndonesianDate(a.licenseDate) - parseIndonesianDate(b.licenseDate);
            }
            return 0;
        });
    }, [submissions, sortOption]);

    const totalRows = publishedSubmissions.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / itemsPerPage));
    const paginatedSubmissions = publishedSubmissions.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage,
    );
    const visibleRowsCount = paginatedSubmissions.length;

    useEffect(() => {
        setCurrentPage(1);
    }, [sortOption, itemsPerPage]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    return (
        <div className="app-surface-card w-full overflow-hidden rounded-[1.5rem] transition-shadow duration-300 hover:shadow-glass-hover animate-fade-in-up">
            <div className="border-b border-slate-100 bg-white/55 px-6 py-5 sm:px-8">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                        <h2 className="app-section-title flex items-center gap-2 text-lg text-foreground sm:text-xl">
                            <span className="app-section-icon">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><path d="m9 15 2 2 4-4" /></svg>
                            </span>
                            Daftar Izin PB UMKU Terbit
                        </h2>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                aria-label="Urutkan daftar izin PB UMKU terbit"
                                className="app-secondary-button group inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold sm:w-auto"
                            >
                                <ArrowUpDown className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
                                Urutkan
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[200px] bg-white border border-slate-100 shadow-elevated rounded-xl z-50 p-2">
                            <DropdownMenuRadioGroup value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)}>
                                <DropdownMenuRadioItem value="terbaru" className="cursor-pointer py-2.5 pl-8 pr-4 text-sm hover:bg-slate-50 rounded-lg data-[state=checked]:bg-primary/5 data-[state=checked]:text-primary transition-colors font-semibold">
                                    Terbaru
                                </DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="terlama" className="cursor-pointer py-2.5 pl-8 pr-4 text-sm hover:bg-slate-50 rounded-lg data-[state=checked]:bg-primary/5 data-[state=checked]:text-primary transition-colors font-semibold mt-1">
                                    Terlama
                                </DropdownMenuRadioItem>
                            </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto bg-white">
                <table className="min-w-[940px] w-full text-left text-sm whitespace-nowrap">
                    <colgroup>
                        <col className="w-[80px]" />
                        <col className="w-[180px]" />
                        <col className="w-[300px]" />
                        <col className="w-[190px]" />
                        <col className="w-[160px]" />
                        <col className="w-[96px]" />
                    </colgroup>
                    <thead className="border-y border-slate-100 bg-slate-50/80">
                        <tr>
                            <th className="app-table-head-label px-4 sm:px-6 py-3.5 sm:py-4 align-middle text-center">No.</th>
                            <th className="app-table-head-label px-5 sm:px-6 py-3.5 sm:py-4 align-middle">Nomor Permohonan</th>
                            <th className="app-table-head-label px-5 sm:px-6 py-3.5 sm:py-4 align-middle">Nama Perusahaan/LPK</th>
                            <th className="app-table-head-label px-5 sm:px-6 py-3.5 sm:py-4 align-middle">Izin PB UMKU</th>
                            <th className="app-table-head-label px-5 sm:px-6 py-3.5 sm:py-4 align-middle">Tanggal Terbit</th>
                            <th className="app-table-head-label px-5 sm:px-6 py-3.5 sm:py-4 align-middle text-center">File</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {totalRows > 0 ? (
                            paginatedSubmissions.map((s, idx) => {
                                return (
                                    <tr
                                        key={s.id}
                                        className={`group transition-colors ${idx % 2 === 0 ? "bg-white hover:bg-slate-50/80" : "bg-slate-50/45 hover:bg-slate-50/90"}`}
                                    >
                                        <td className="px-4 sm:px-6 py-4 align-middle text-center font-medium text-slate-500">
                                            {(currentPage - 1) * itemsPerPage + idx + 1}
                                        </td>
                                        <td className="px-5 sm:px-6 py-4 align-middle text-[14px] font-medium text-slate-800 whitespace-nowrap">{s.submissionNumber}</td>
                                        <td className="px-5 sm:px-6 py-4 align-middle">
                                            <div className="font-semibold text-slate-800 line-clamp-2 text-[14px]">{s.organizationName}</div>
                                        </td>
                                        <td className="px-5 sm:px-6 py-4 align-middle whitespace-nowrap">
                                            <div className="font-medium text-slate-800 text-[14px]">{s.licenseNumber}</div>
                                        </td>
                                        <td className="px-5 sm:px-6 py-4 align-middle whitespace-nowrap">
                                            <div className="font-medium text-slate-800 text-[14px]">{s.licenseDate || "-"}</div>
                                        </td>
                                        <td className="px-5 sm:px-6 py-4 align-middle text-center">
                                            {s.skFileName && s.skFileUrl ? (
                                                <a
                                                    href={s.skFileUrl}
                                                    download={s.skFileName}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 transition-colors hover:bg-emerald-100 hover:text-emerald-700"
                                                    title={`Unduh dokumen ${s.skFileName}`}
                                                    aria-label={`Unduh dokumen ${s.skFileName}`}
                                                >
                                                    <FileText className="w-4 h-4 stroke-[2]" />
                                                </a>
                                            ) : (
                                                <span className="text-slate-400 text-xs font-medium">-</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan={6} className="px-4 sm:px-6 py-8">
                                    <EmptyState 
                                        icon={FileText}
                                        title="Belum ada izin PB UMKU terbit"
                                        description="Data akan muncul setelah permohonan selesai dan izin PB UMKU diterbitkan."
                                        compact
                                    />
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <div className="flex flex-col gap-3 border-t border-slate-200/70 bg-slate-50/55 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between">
                <p className="text-sm text-slate-600">
                    Menampilkan {visibleRowsCount} dari {totalRows} izin.
                </p>
                <div className="flex w-full flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center md:w-auto md:gap-4">
                    <div className="flex items-center gap-2">
                        <label htmlFor="public-rows-per-page" className="text-sm font-medium text-slate-700">Baris per halaman</label>
                        <select
                            id="public-rows-per-page"
                            value={itemsPerPage}
                            onChange={(e) => setItemsPerPage(Number(e.target.value))}
                            className="app-form-select h-10 bg-white px-3 text-sm font-medium text-slate-700"
                        >
                            {[5, 10, 20].map((size) => (
                                <option key={size} value={size}>{size}</option>
                            ))}
                        </select>
                    </div>
                    <p className="text-sm font-medium text-slate-700">Halaman {currentPage} dari {totalPages}</p>
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            aria-label="Halaman pertama"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(1)}
                            className="app-utility-button inline-flex h-10 w-10 items-center justify-center rounded-xl p-0"
                        >
                            <ChevronsLeft className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            aria-label="Halaman sebelumnya"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            className="app-utility-button inline-flex h-10 w-10 items-center justify-center rounded-xl p-0"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            aria-label="Halaman berikutnya"
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            className="app-utility-button inline-flex h-10 w-10 items-center justify-center rounded-xl p-0"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            aria-label="Halaman terakhir"
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(totalPages)}
                            className="app-utility-button inline-flex h-10 w-10 items-center justify-center rounded-xl p-0"
                        >
                            <ChevronsRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PublishedTable;
