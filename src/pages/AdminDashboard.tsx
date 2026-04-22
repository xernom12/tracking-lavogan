import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import type { AdminSubmission, NewSubmissionInput } from "@/contexts/SubmissionContext";
import { useSubmissions } from "@/contexts/useSubmissions";
import { deriveDisplayStatus, deriveStages } from "@/data/mockData";
import { FileText, Search, X, Plus, Trash2, ArrowUpDown, Pencil, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, Eye, FileSearch, FileSignature, Check } from "lucide-react";
import type { DisplayStatusType } from "@/data/mockData";
import AppHeader from "@/components/AppHeader";
import EmptyState from "@/components/EmptyState";
import FlowConfirmDialog from "@/components/FlowConfirmDialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { KBLI_OPTIONS, normalizeKbliCode } from "@/data/kbliOptions";

const statusLabel: Record<DisplayStatusType, { text: string; className: string }> = {
  completed: { text: "Selesai", className: "app-badge app-badge-success" },
  active: { text: "Dalam Proses", className: "app-badge app-badge-active" },
  revision: { text: "Memerlukan Perbaikan", className: "app-badge app-badge-revision" },
  pending: { text: "Menunggu Proses", className: "app-badge app-badge-pending" },
};
const submissionTypeLabelClass: Record<NewSubmissionInput["submissionType"], string> = {
  Baru: "bg-blue-50 border-blue-200 text-blue-700",
  Perpanjangan: "bg-orange-50 border-orange-200 text-orange-700",
};

type NewSubmissionForm = Omit<NewSubmissionInput, "submissionType"> & {
  submissionType: NewSubmissionInput["submissionType"] | "";
};
type NewSubmissionFormErrors = Partial<Record<keyof NewSubmissionForm, string>>;
type DashboardMetricKey =
  | "pengajuan"
  | "verifikasi"
  | "peninjauan"
  | "persetujuan"
  | "izin_terbit";

const isSubmissionType = (value: string): value is NewSubmissionInput["submissionType"] =>
  value === "Baru" || value === "Perpanjangan";

const emptyForm: NewSubmissionForm = {
  submissionNumber: "",
  submissionType: "",
  organizationName: "",
  nib: "",
  kbli: "",
  pengajuanDate: "",
};

type SortOption =
  | "tahap"
  | "latest"
  | "oldest";

const dialogFieldClassName = "app-form-field";
const dialogSelectClassName = "app-form-select";
const dialogFieldGroupClassName = "space-y-1.5";
const dialogLabelClassName = "app-field-label block";
const dialogErrorClassName = "text-xs font-medium text-status-revision";

const monthMap: Record<string, number> = {
  januari: 0,
  februari: 1,
  maret: 2,
  april: 3,
  mei: 4,
  juni: 5,
  juli: 6,
  agustus: 7,
  september: 8,
  oktober: 9,
  november: 10,
  desember: 11,
};

const parseUpdatedAt = (value: string): number => {
  const datePartRaw = value.split(",")[0]?.trim() || "";
  const dateParts = datePartRaw.split(" ");
  if (dateParts.length < 3) return 0;

  const day = Number(dateParts[0]);
  const month = monthMap[dateParts[1].toLowerCase()];
  const year = Number(dateParts[2]);

  if (
    Number.isNaN(day) ||
    month === undefined ||
    Number.isNaN(year)
  ) {
    return 0;
  }

  return new Date(year, month, day).getTime();
};

const openNativeDatePickerOnClick = (event: MouseEvent<HTMLInputElement>) => {
  const input = event.currentTarget as HTMLInputElement & { showPicker?: () => void };
  if (typeof input.showPicker !== "function") return;
  try {
    input.showPicker();
  } catch {
    // no-op: some browsers throw when picker invocation is blocked
  }
};

const stageMetricKeyByIndex = [
  "pengajuan",
  "verifikasi",
  "peninjauan",
  "persetujuan",
  "izin_terbit",
] as const;

const getSubmissionMetricKey = (submission: AdminSubmission): DashboardMetricKey => {
  const stages = deriveStages(submission);
  const activeStageIndex = stages.findIndex((stage) => stage.status === "active");
  const activeStageKey = stageMetricKeyByIndex[activeStageIndex];

  if (activeStageKey) return activeStageKey;
  return "izin_terbit";
};

const AdminDashboard = () => {
  const { submissions, addSubmission, deleteSubmission } = useSubmissions();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("latest");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isListRefreshing, setIsListRefreshing] = useState(false);
  const hasInitializedListRef = useRef(false);

  // Modal tambah permohonan
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [form, setForm] = useState<NewSubmissionForm>(emptyForm);
  const [formErrors, setFormErrors] = useState<NewSubmissionFormErrors>({});
  const [isAddConfirmDialogOpen, setIsAddConfirmDialogOpen] = useState(false);
  const [pendingAddSubmission, setPendingAddSubmission] = useState<NewSubmissionInput | null>(null);

  // Dialog konfirmasi hapus
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [manageTarget, setManageTarget] = useState<{
    id: string;
    submissionNumber: string;
    organizationName: string;
  } | null>(null);
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);
  const [shouldReturnToManageDialog, setShouldReturnToManageDialog] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<DashboardMetricKey | null>(null);
  const isDeleteConfirmedRef = useRef(false);

  const filteredSubmissions = useMemo(() => submissions.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    const compactQuery = q.replace(/\s+/g, "");
    return s.submissionNumber.toLowerCase().includes(q)
      || s.organizationName.toLowerCase().includes(q)
      || s.nib.replace(/\s+/g, "").includes(compactQuery);
  }), [searchQuery, submissions]);

  const submissionsByMetric = useMemo(() => {
    const grouped: Record<DashboardMetricKey, typeof submissions> = {
      pengajuan: [],
      verifikasi: [],
      peninjauan: [],
      persetujuan: [],
      izin_terbit: [],
    };

    filteredSubmissions.forEach((submission) => {
      grouped[getSubmissionMetricKey(submission)].push(submission);
    });

    return grouped;
  }, [filteredSubmissions]);

  const stageMetricCards = [
    {
      key: "pengajuan" as const,
      label: "Pengajuan",
      helper: "Data permohonan baru yang masih menunggu konfirmasi awal.",
      value: submissionsByMetric.pengajuan.length,
      icon: FileText,
      iconClass: "text-primary/90",
      iconWrapClass: "border-primary/20 bg-primary/5 text-primary",
      accentClass: "bg-primary/40",
      cardClass: "border-slate-200/90 bg-white",
    },
    {
      key: "verifikasi" as const,
      label: "Verifikasi Dokumen",
      helper: "Dokumen yang perlu diperiksa atau diperiksa ulang.",
      value: submissionsByMetric.verifikasi.length,
      icon: FileSearch,
      iconClass: "text-primary/90",
      iconWrapClass: "border-primary/20 bg-primary/5 text-primary",
      accentClass: "bg-primary/40",
      cardClass: "border-slate-200/90 bg-white",
    },
    {
      key: "peninjauan" as const,
      label: "Peninjauan",
      helper: "Dokumen yang masuk tahap evaluasi lanjutan.",
      value: submissionsByMetric.peninjauan.length,
      icon: Eye,
      iconClass: "text-primary/90",
      iconWrapClass: "border-primary/20 bg-primary/5 text-primary",
      accentClass: "bg-primary/40",
      cardClass: "border-slate-200/90 bg-white",
    },
    {
      key: "persetujuan" as const,
      label: "Persetujuan",
      helper: "Draft persetujuan yang perlu dilengkapi dan disimpan.",
      value: submissionsByMetric.persetujuan.length,
      icon: FileSignature,
      iconClass: "text-primary/90",
      iconWrapClass: "border-primary/20 bg-primary/5 text-primary",
      accentClass: "bg-primary/40",
      cardClass: "border-slate-200/90 bg-white",
    },
    {
      key: "izin_terbit" as const,
      label: "Izin Terbit",
      helper: "Permohonan pada tahap penetapan atau sudah memiliki izin terbit.",
      value: submissionsByMetric.izin_terbit.length,
      icon: Check,
      iconClass: "text-primary/90",
      iconWrapClass: "border-primary/20 bg-primary/5 text-primary",
      accentClass: "bg-primary/40",
      cardClass: "border-slate-200/90 bg-white",
    },
  ];

  const selectedMetricCard = selectedMetric
    ? stageMetricCards.find((card) => card.key === selectedMetric)
    : null;
  const selectedMetricSubmissions = selectedMetric ? submissionsByMetric[selectedMetric] : [];

  const sortedSubmissions = [...filteredSubmissions].sort((a, b) => {
    const statusPriority: Record<DisplayStatusType, number> = {
      revision: 0,
      active: 1,
      pending: 2,
      completed: 3,
    };
    const statusA = deriveDisplayStatus(a);
    const statusB = deriveDisplayStatus(b);

    switch (sortOption) {
      case "tahap":
        return (
          statusPriority[statusA.type] - statusPriority[statusB.type] ||
          parseUpdatedAt(b.lastUpdated) - parseUpdatedAt(a.lastUpdated)
        );
      case "latest":
        return parseUpdatedAt(b.lastUpdated) - parseUpdatedAt(a.lastUpdated);
      case "oldest":
        return parseUpdatedAt(a.lastUpdated) - parseUpdatedAt(b.lastUpdated);
      default:
        return 0;
    }
  });

  const totalRows = sortedSubmissions.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / itemsPerPage));
  const paginatedSubmissions = sortedSubmissions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!hasInitializedListRef.current) {
      hasInitializedListRef.current = true;
      return;
    }

    setIsListRefreshing(true);
    const timeoutId = window.setTimeout(() => {
      setIsListRefreshing(false);
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [searchQuery, sortOption, itemsPerPage, currentPage]);

  const handleOpenAdd = () => {
    setForm(emptyForm);
    setFormErrors({});
    setPendingAddSubmission(null);
    setIsAddConfirmDialogOpen(false);
    setShowAddDialog(true);
  };

  const validateForm = (): boolean => {
    const errors: NewSubmissionFormErrors = {};
    if (!form.submissionNumber.trim()) errors.submissionNumber = "Nomor permohonan wajib diisi.";
    if (!isSubmissionType(form.submissionType)) errors.submissionType = "Jenis permohonan wajib dipilih.";
    if (!form.organizationName.trim()) errors.organizationName = "Nama perusahaan/LPK wajib diisi.";
    if (!form.nib.trim()) {
      errors.nib = "NIB wajib diisi.";
    }
    if (!form.kbli.trim()) errors.kbli = "KBLI wajib dipilih.";
    if (!form.pengajuanDate.trim()) errors.pengajuanDate = "Tanggal pengajuan wajib diisi.";
    if (form.pengajuanDate.trim() && Number.isNaN(new Date(form.pengajuanDate).getTime())) {
      errors.pengajuanDate = "Tanggal pengajuan tidak valid.";
    }

    // Cek duplikat nomor permohonan
    const duplicate = submissions.find(
      (s) => s.submissionNumber.toLowerCase() === form.submissionNumber.trim().toLowerCase()
    );
    if (duplicate) errors.submissionNumber = "Nomor permohonan sudah digunakan.";

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitAdd = () => {
    if (!validateForm()) return;
    if (!isSubmissionType(form.submissionType)) {
      setFormErrors((prev) => ({ ...prev, submissionType: "Jenis permohonan wajib dipilih." }));
      return;
    }
    const dateObj = new Date(form.pengajuanDate);
    if (Number.isNaN(dateObj.getTime())) {
      setFormErrors((prev) => ({ ...prev, pengajuanDate: "Tanggal pengajuan tidak valid." }));
      return;
    }
    const dateFormatted = dateObj.toLocaleDateString("id-ID", {
      day: "numeric", month: "long", year: "numeric",
    });
    setPendingAddSubmission({
      ...form,
      submissionNumber: form.submissionNumber.trim(),
      submissionType: form.submissionType,
      organizationName: form.organizationName.trim(),
      nib: form.nib.replace(/\s+/g, "").trim(),
      kbli: normalizeKbliCode(form.kbli),
      pengajuanDate: dateFormatted,
    });
    setIsAddConfirmDialogOpen(true);
  };

  const handleConfirmAdd = () => {
    if (!pendingAddSubmission) return;

    addSubmission(pendingAddSubmission);
    setPendingAddSubmission(null);
    setIsAddConfirmDialogOpen(false);
    setShowAddDialog(false);
    toast.success(`Permohonan ${pendingAddSubmission.submissionNumber} telah ditambahkan.`);
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    isDeleteConfirmedRef.current = true;
    deleteSubmission(deleteTarget.id);
    toast.success(`Permohonan ${deleteTarget.name} telah dihapus.`);
    setShouldReturnToManageDialog(false);
    setIsManageDialogOpen(false);
    setManageTarget(null);
    setDeleteTarget(null);
  };

  const handleManageFromDialog = () => {
    if (!manageTarget) return;
    const targetId = manageTarget.id;
    setShouldReturnToManageDialog(false);
    setIsManageDialogOpen(false);
    setManageTarget(null);
    navigate(`/admin/kelola/${targetId}`);
  };

  const handleDeleteFromManage = () => {
    if (!manageTarget) return;
    setDeleteTarget({
      id: manageTarget.id,
      name: manageTarget.organizationName || manageTarget.submissionNumber,
    });
    setShouldReturnToManageDialog(true);
    setIsManageDialogOpen(false);
  };
  return (
    <div className="min-h-screen bg-slate-50 relative overflow-clip">
      {/* Decorative background blurs */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/3 pointer-events-none" />

      <AppHeader variant="admin" />

	      <main className="app-section-stack max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
	        {/* Header Section */}
	        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
	          <div className="max-w-2xl">
	            <h1 className="app-page-title text-3xl">Dashboard Admin</h1>
			            <p className="mt-1.5 text-slate-500 font-medium leading-relaxed">Kelola dan pantau seluruh permohonan PB UMKU dalam satu dashboard.</p>
	          </div>
	        </div>

		        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
		            {stageMetricCards.map((metric) => (
		              <button
		                key={metric.key}
		                type="button"
		                onClick={() => setSelectedMetric(metric.key)}
		                className={`app-surface-panel group relative flex min-h-[152px] flex-col overflow-hidden p-5 text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 ${metric.cardClass}`}
		              >
		                <div className={`absolute inset-x-0 top-0 h-1 ${metric.accentClass}`} />

		                <div className="flex items-start justify-between gap-4">
		                  <div className="min-w-0">
		                    <p className="text-sm font-bold leading-tight text-slate-900">
		                      {metric.label}
		                    </p>
		                  </div>
		                  <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-sm ${metric.iconWrapClass}`}>
		                    <metric.icon className={`h-[18px] w-[18px] stroke-[2.15] ${metric.iconClass}`} />
	                  </span>
	                </div>

	                <div className="mt-auto flex items-end justify-between gap-4 pt-6">
	                  <span className="text-[2.6rem] leading-none font-heading font-black tracking-tight text-slate-800">{metric.value}</span>
	                  <span className="pb-0.5 text-[11px] font-semibold text-slate-400">
	                    Lihat detail
	                  </span>
	                </div>
	              </button>
	            ))}
	        </div>

	        {/* Application List Container */}
			        <div className="app-surface-panel overflow-hidden relative z-10">
		          <div className="border-b border-slate-100 bg-white/55 px-6 py-5 sm:px-8">
	              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		              <div>
				              <h2 className="app-section-title text-xl">Daftar Permohonan</h2>
                      <p className="mt-1 text-sm font-medium text-slate-500">
                        Total Permohonan ({submissions.length})
                      </p>
				            </div>

	            <div className="flex w-full items-center gap-3 sm:mt-0 sm:w-auto">
	              {/* Search */}
	              <div className="relative w-full max-w-sm sm:w-72">
	                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none stroke-[2.5]" />
                <label htmlFor="admin-submission-search" className="sr-only">
                  Cari permohonan
                </label>
	                <input
	                  id="admin-submission-search"
	                  type="text"
                    autoComplete="off"
                    spellCheck="false"
		                  placeholder="Cari nomor permohonan, nama perusahaan/LPK, atau NIB"
	                  value={searchQuery}
	                  onChange={(e) => {
	                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="app-form-field h-11 bg-white pl-10 pr-10 text-[14px] text-slate-700"
                />
                {searchQuery && (
                  <button
                    type="button"
                    aria-label="Hapus kata kunci pencarian"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-200/50 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5 stroke-[2.5]" />
                  </button>
                )}
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Urutkan Daftar Permohonan"
                    className="app-utility-button inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl p-0 text-slate-600"
                  >
                    <ArrowUpDown className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[180px] bg-white border border-slate-100 shadow-elevated rounded-xl z-50 p-1.5">
                  <DropdownMenuRadioGroup value={sortOption} onValueChange={(value) => setSortOption(value as SortOption)}>
                    <DropdownMenuRadioItem value="tahap" className="cursor-pointer py-2 pl-8 pr-4 text-sm hover:bg-slate-50 rounded-lg data-[state=checked]:bg-primary/10 data-[state=checked]:text-primary transition-colors font-semibold">Tahapan</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="latest" className="cursor-pointer py-2 pl-8 pr-4 text-sm hover:bg-slate-50 rounded-lg data-[state=checked]:bg-primary/10 data-[state=checked]:text-primary transition-colors font-semibold mt-1">Terbaru</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="oldest" className="cursor-pointer py-2 pl-8 pr-4 text-sm hover:bg-slate-50 rounded-lg data-[state=checked]:bg-primary/10 data-[state=checked]:text-primary transition-colors font-semibold mt-1">Terlama</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

	              <button
	                onClick={handleOpenAdd}
	                title="Buat Permohonan Baru"
	                aria-label="Buat Permohonan Baru"
	                className="app-primary-button inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl p-0"
              >
	                <Plus className="w-5 h-5 stroke-[2.5]" />
	              </button>
	            </div>
              </div>
	          </div>

	          <div className="overflow-x-auto bg-white" aria-busy={isListRefreshing}>
	            <table className="w-full text-sm text-left">
	              <thead className="border-y border-slate-100 bg-slate-50/80">
                <tr>
                  <th className="app-table-head-label px-4 py-3.5 align-middle text-[11px] md:text-xs">Nomor Permohonan</th>
                  <th className="app-table-head-label px-4 py-3.5 align-middle text-[11px] md:text-xs">Nama Perusahaan/LPK</th>
                  <th className="app-table-head-label px-4 py-3.5 align-middle text-[11px] md:text-xs">NIB</th>
                  <th className="app-table-head-label px-4 py-3.5 align-middle text-[11px] md:text-xs">Status</th>
                  <th className="app-table-head-label px-4 py-3.5 align-middle text-[11px] md:text-xs">Terakhir Diperbarui</th>
                  <th className="app-table-head-label px-4 py-3.5 align-middle text-center text-[11px] md:text-xs">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isListRefreshing ? (
                  Array.from({ length: Math.min(itemsPerPage, 5) }).map((_, idx) => (
                    <tr key={`admin-skeleton-${idx}`} className="bg-white">
                      <td className="px-4 py-4 align-middle"><Skeleton className="h-4 w-32 rounded-full" /></td>
                      <td className="px-4 py-4 align-middle">
                        <Skeleton className="h-4 w-40 rounded-full" />
                        <Skeleton className="mt-2 h-3 w-24 rounded-full" />
                      </td>
                      <td className="px-4 py-4 align-middle"><Skeleton className="h-4 w-24 rounded-full" /></td>
                      <td className="px-4 py-4 align-middle"><Skeleton className="h-7 w-28 rounded-full" /></td>
                      <td className="px-4 py-4 align-middle"><Skeleton className="h-4 w-24 rounded-full" /></td>
                      <td className="px-4 py-4 align-middle">
                        <div className="flex items-center justify-center">
                          <Skeleton className="h-10 w-10 rounded-xl" />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : sortedSubmissions.length === 0 ? (
	                  <tr>
	                    <td colSpan={6} className="px-4 py-8">
	                      <EmptyState 
	                        icon={Search}
		                        title="Belum ada permohonan"
		                        description="Gunakan kata kunci lain atau buat permohonan baru."
		                        compact
		                      />
	                    </td>
	                  </tr>
                ) : null}
                {paginatedSubmissions.map((s, idx) => {
                  const display = deriveDisplayStatus(s);
                  const st = statusLabel[display.type];
                  const submissionTypeClass = submissionTypeLabelClass[s.submissionType] || "bg-slate-50 border-slate-100 text-slate-500";
                  return (
                    <tr
                      key={s.id}
                      className={`group transition-colors ${idx % 2 === 0 ? "bg-white hover:bg-slate-50/80" : "bg-slate-50/45 hover:bg-slate-50/90"}`}
                    >
                      <td className="px-4 py-4 align-middle">
                        <span onClick={() => navigate(`/admin/kelola/${s.id}`)} className="font-semibold text-slate-800 hover:text-slate-900 transition-colors whitespace-nowrap cursor-pointer hover:underline text-[13.5px]">
                          {s.submissionNumber}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-middle lg:max-w-[320px] max-w-[200px]">
                        <div className="font-medium text-slate-800 truncate text-[14px]" title={s.organizationName}>{s.organizationName}</div>
                        <div className="mt-1 flex items-center gap-2">
                          <span className={`app-badge-sm normal-case tracking-normal ${submissionTypeClass}`}>{s.submissionType}</span>
                          <span className="text-[11.5px] text-slate-500">KBLI: {normalizeKbliCode(s.kbli)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-middle whitespace-nowrap text-[13px] font-medium text-slate-800">
                        {s.nib}
                      </td>
                      <td className="px-4 py-4 align-middle whitespace-nowrap">
                        <span className={`${st.className} shadow-sm opacity-90 group-hover:opacity-100`}>
                          {display.type === "completed" && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>}
                          {display.type === "active" && <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>}
                          {display.type === "revision" && <div className="w-1.5 h-1.5 rounded-full bg-status-revision"></div>}
                          {display.type === "pending" && <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>}
                          {display.label}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-middle whitespace-nowrap text-[12.5px] font-medium text-slate-500">
                        {s.lastUpdated.split(',')[0]}
                      </td>
	                      <td className="px-4 py-4 align-middle whitespace-nowrap text-center">
	                        <div className="flex items-center justify-center">
	                          <button
                            onClick={() => {
                              setManageTarget({
                                id: s.id,
                                submissionNumber: s.submissionNumber,
                                organizationName: s.organizationName,
                              });
                              setIsManageDialogOpen(true);
                            }}
                            title="Kelola Permohonan"
                            aria-label="Kelola Permohonan"
	                            className="app-utility-button inline-flex h-10 w-10 items-center justify-center rounded-xl p-0 text-slate-500"
	                          >
                            <Pencil className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

	          <div className="flex flex-col gap-3 border-t border-border/50 bg-slate-50/55 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-slate-600" aria-live="polite">Total {totalRows} baris.</p>
            <div className="flex w-full flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center md:w-auto md:gap-4">
              <div className="flex items-center gap-2">
                <label htmlFor="admin-rows-per-page" className="text-sm font-medium text-slate-700">Baris per halaman</label>
                <select
                  id="admin-rows-per-page"
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="app-form-select h-10 bg-white px-3 text-sm font-medium text-slate-700"
                  
                >
                  {[5, 10, 20, 50].map((size) => (
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
      </main>

      {/* Modal Buat Permohonan Baru */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="sm:max-w-[34rem]">
          <DialogHeader>
            <DialogTitle className="font-heading">Buat Permohonan Baru</DialogTitle>
            <DialogDescription className="max-w-[30rem]">
              Lengkapi data permohonan sebelum disimpan pada tahap Pengajuan.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[min(62vh,34rem)] space-y-3.5 overflow-y-auto py-1 pr-1">
            <div className={dialogFieldGroupClassName}>
              <label htmlFor="new-submission-date" className={dialogLabelClassName}>
                Tanggal pengajuan <span className="text-status-revision">*</span>
              </label>
              <input
                id="new-submission-date"
                type="date"
                max={new Date().toLocaleDateString('en-CA')}
                value={form.pengajuanDate}
                onClick={openNativeDatePickerOnClick}
                onChange={(e) => {
                  const val = e.target.value;
                  // Cegah input tahun lebih dari 4 digit (bug bawaan Chrome)
                  if (val && val.split('-')[0].length > 4) return;
                  setForm((f) => ({ ...f, pengajuanDate: val }));
                  setFormErrors((err) => ({ ...err, pengajuanDate: undefined }));
                }}
                className={`${dialogFieldClassName} ${formErrors.pengajuanDate ? "border-status-revision focus:ring-status-revision/20" : ""} relative cursor-pointer`}
              />
              {formErrors.pengajuanDate && (
                <p className={dialogErrorClassName}>{formErrors.pengajuanDate}</p>
              )}
            </div>
            <div className={dialogFieldGroupClassName}>
              <label htmlFor="new-submission-number" className={dialogLabelClassName}>
                Nomor permohonan <span className="text-status-revision">*</span>
              </label>
              <input
                id="new-submission-number"
                type="text"
                value={form.submissionNumber}
                onChange={(e) => {
                  setForm((f) => ({ ...f, submissionNumber: e.target.value }));
                  setFormErrors((err) => ({ ...err, submissionNumber: undefined }));
                }}
                placeholder="Masukkan nomor permohonan"
                className={`${dialogFieldClassName} placeholder:text-muted-foreground ${formErrors.submissionNumber ? "border-status-revision focus:ring-status-revision/20" : ""}`}
              />
              {formErrors.submissionNumber && (
                <p className={dialogErrorClassName}>{formErrors.submissionNumber}</p>
              )}
            </div>
            <div className={dialogFieldGroupClassName}>
              <label htmlFor="new-submission-organization" className={dialogLabelClassName}>
                Nama perusahaan/LPK <span className="text-status-revision">*</span>
              </label>
              <input
                id="new-submission-organization"
                type="text"
                value={form.organizationName}
                onChange={(e) => {
                  setForm((f) => ({ ...f, organizationName: e.target.value }));
                  setFormErrors((err) => ({ ...err, organizationName: undefined }));
                }}
                placeholder="Masukkan nama perusahaan/LPK"
                className={`${dialogFieldClassName} placeholder:text-muted-foreground ${formErrors.organizationName ? "border-status-revision focus:ring-status-revision/20" : ""}`}
              />
              {formErrors.organizationName && (
                <p className={dialogErrorClassName}>{formErrors.organizationName}</p>
              )}
            </div>
            <div className={dialogFieldGroupClassName}>
              <label htmlFor="new-submission-nib" className={dialogLabelClassName}>
                NIB <span className="text-status-revision">*</span>
              </label>
              <input
                id="new-submission-nib"
                type="text"
                value={form.nib}
                onChange={(e) => {
                  setForm((f) => ({ ...f, nib: e.target.value }));
                  setFormErrors((err) => ({ ...err, nib: undefined }));
                }}
                placeholder="Masukkan NIB"
                className={`${dialogFieldClassName} placeholder:text-muted-foreground ${formErrors.nib ? "border-status-revision focus:ring-status-revision/20" : ""}`}
              />
              {formErrors.nib && (
                <p className={dialogErrorClassName}>{formErrors.nib}</p>
              )}
            </div>
            <div className={dialogFieldGroupClassName}>
              <label htmlFor="new-submission-kbli" className={dialogLabelClassName}>
                KBLI <span className="text-status-revision">*</span>
              </label>
              <select
                id="new-submission-kbli"
                value={form.kbli}
                onChange={(e) => {
                  setForm((f) => ({ ...f, kbli: e.target.value }));
                  setFormErrors((err) => ({ ...err, kbli: undefined }));
                }}
                className={`${dialogSelectClassName} ${!form.kbli ? "text-muted-foreground" : "text-foreground"} overflow-hidden text-ellipsis whitespace-nowrap ${formErrors.kbli ? "border-status-revision focus:ring-status-revision/20" : ""}`}
              >
                <option value="" disabled hidden>Pilih KBLI</option>
                {KBLI_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value} className="text-foreground">
                    {option.label}
                  </option>
                ))}
              </select>
              {formErrors.kbli && (
                <p className={dialogErrorClassName}>{formErrors.kbli}</p>
              )}
            </div>
            <div className={dialogFieldGroupClassName}>
              <label htmlFor="new-submission-type" className={dialogLabelClassName}>
                Jenis permohonan <span className="text-status-revision">*</span>
              </label>
              <select
                id="new-submission-type"
                value={form.submissionType}
                onChange={(e) => {
                  const nextSubmissionType = e.target.value;
                  setForm((f) => ({
                    ...f,
                    submissionType: isSubmissionType(nextSubmissionType) ? nextSubmissionType : "",
                  }));
                  setFormErrors((err) => ({ ...err, submissionType: undefined }));
                }}
                className={`${dialogSelectClassName} ${!form.submissionType ? "text-muted-foreground" : "text-foreground"} ${formErrors.submissionType ? "border-status-revision focus:ring-status-revision/20" : ""}`}
              >
                <option value="" disabled hidden>Pilih jenis permohonan</option>
                <option value="Baru" className="text-foreground">Baru</option>
                <option value="Perpanjangan" className="text-foreground">Perpanjangan</option>
              </select>
              {formErrors.submissionType && (
                <p className={dialogErrorClassName}>{formErrors.submissionType}</p>
              )}
            </div>
          </div>
          <DialogFooter className="border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => setShowAddDialog(false)}
              className="app-secondary-button inline-flex h-11 w-full items-center justify-center rounded-xl px-4 text-sm font-medium sm:w-auto"
            >
              Batal
            </button>
            <button
              onClick={handleSubmitAdd}
              className="app-primary-button inline-flex h-11 w-full items-center justify-center rounded-xl px-5 text-sm font-semibold sm:w-auto"
            >
              Buat Permohonan
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FlowConfirmDialog
        open={isAddConfirmDialogOpen}
        onOpenChange={(open) => {
          setIsAddConfirmDialogOpen(open);
          if (!open) setPendingAddSubmission(null);
        }}
        title="Buat Permohonan Baru?"
        description="Permohonan baru akan disimpan pada tahap Pengajuan."
        confirmLabel="Ya, Buat Permohonan"
        onConfirm={handleConfirmAdd}
      />

      {/* Dialog Aksi Kelola */}
      <Dialog
        open={isManageDialogOpen}
        onOpenChange={(open) => {
          setIsManageDialogOpen(open);
          if (!open && !deleteTarget) {
            setManageTarget(null);
            setShouldReturnToManageDialog(false);
          }
        }}
      >
	        <DialogContent className="sm:max-w-md">
	          <DialogHeader>
	            <DialogTitle className="font-heading">Kelola Permohonan</DialogTitle>
	            <DialogDescription className="max-w-[28rem] text-sm text-muted-foreground leading-relaxed">
	              Pilih tindakan yang akan dilakukan untuk permohonan <span className="font-semibold text-foreground">{manageTarget?.submissionNumber}</span>.
	            </DialogDescription>
	          </DialogHeader>
			          <div className="app-surface-panel-soft border border-slate-200/70 px-3.5 py-3">
				            <p className="app-info-label mb-1">Nama Perusahaan/LPK</p>
			            <p className="text-sm font-normal text-slate-500 line-clamp-2">{manageTarget?.organizationName || "-"}</p>
			          </div>
          <DialogFooter className="gap-2 border-t border-slate-100 pt-3 sm:justify-start">
            <button
              type="button"
              onClick={handleManageFromDialog}
              className="app-primary-button inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold sm:w-auto"
            >
              <Pencil className="w-4 h-4" />
              Kelola
            </button>
            <button
              type="button"
              onClick={handleDeleteFromManage}
              className="app-danger-button inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold sm:w-auto"
            >
              <Trash2 className="w-4 h-4" />
              Hapus
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Konfirmasi Hapus */}
	      <AlertDialog
	        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (open) return;
          setDeleteTarget(null);
          if (!isDeleteConfirmedRef.current && shouldReturnToManageDialog && manageTarget) {
            setIsManageDialogOpen(true);
          } else if (!isManageDialogOpen) {
            setManageTarget(null);
          }
          setShouldReturnToManageDialog(false);
          isDeleteConfirmedRef.current = false;
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
	            <AlertDialogTitle className="font-heading">Hapus Permohonan?</AlertDialogTitle>
            <AlertDialogDescription>
              Permohonan <span className="font-semibold text-foreground">{deleteTarget?.name}</span> akan dihapus secara permanen dan tidak dapat dipulihkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-status-revision text-white hover:bg-status-revision/90"
            >
              Hapus
            </AlertDialogAction>
	          </AlertDialogFooter>
	        </AlertDialogContent>
	      </AlertDialog>

	      {/* Dialog Detail Statistik */}
	      <Dialog open={!!selectedMetric} onOpenChange={(open) => { if (!open) setSelectedMetric(null); }}>
	        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
	            <DialogTitle className="font-heading">
	              {selectedMetricCard?.label || "Detail Data"} ({selectedMetricSubmissions.length})
	            </DialogTitle>
            <DialogDescription>
              {selectedMetricCard?.helper || "Daftar permohonan pada kategori ini."} Pilih salah satu baris untuk membuka detail permohonan secara lengkap.
            </DialogDescription>
          </DialogHeader>
	          <div className="max-h-[60vh] overflow-y-auto pr-1">
		            {selectedMetricSubmissions.length === 0 ? (
	                <EmptyState
	                  icon={FileText}
	                  title="Belum ada permohonan"
	                  description="Data akan muncul saat ada permohonan pada kategori ini."
	                  compact
	                />
			            ) : (
					              <div className="overflow-hidden rounded-[1.25rem] border border-slate-200/70 bg-white/95">
			                {selectedMetricSubmissions.map((submission) => {
			                  return (
			                    <button
			                      key={submission.id}
			                      type="button"
		                      onClick={() => {
		                        setSelectedMetric(null);
		                        navigate(`/admin/kelola/${submission.id}`);
		                      }}
				                      className="group grid w-full gap-3 border-b border-slate-200/55 bg-white px-4 py-3.5 text-left transition-colors last:border-b-0 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_auto] sm:items-center sm:gap-5 sm:px-5 sm:py-4 hover:bg-slate-50/60"
				                    >
				                      <div className="min-w-0">
				                        <p className="text-[15px] font-semibold text-foreground">{submission.submissionNumber}</p>
				                        <p className="mt-1 truncate text-sm text-muted-foreground">{submission.organizationName}</p>
				                      </div>
				                      <div className="min-w-0">
				                        <p className="app-info-label sm:hidden">Diperbarui</p>
				                        <p className="mt-1 text-[12.5px] font-medium text-slate-400 sm:mt-0">
				                          {submission.lastUpdated}
				                        </p>
				                      </div>

				                      <div className="flex justify-end sm:justify-end">
				                        <span className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-semibold text-slate-500 transition-colors group-hover:text-primary">
			                          <Eye className="w-3.5 h-3.5" />
			                          Lihat detail
			                        </span>
				                      </div>
		                    </button>
	                  );
	                })}
	              </div>
	            )}
	          </div>
	        </DialogContent>
	      </Dialog>

		    </div>
		  );
	};

export default AdminDashboard;
