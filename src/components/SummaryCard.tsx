import { getKbliOptionLabel } from "@/data/kbliOptions";

interface SummaryCardProps {
  submissionNumber: string;
  submissionType: string;
  organizationName: string;
  kbli: string;
  nib: string;
  currentStatus: string;
  licenseStatus: string;
  lastUpdated: string;
}

const SummaryCard = ({
  submissionNumber,
  submissionType,
  organizationName,
  kbli,
  nib,
  currentStatus,
  licenseStatus,
  lastUpdated,
}: SummaryCardProps) => {
  return (
    <div className="app-surface-card p-6 sm:p-10 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/10 to-transparent rounded-bl-full pointer-events-none" />
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6 sm:mb-7">
        <h2 className="app-section-title text-xl flex items-center gap-3">
          <div className="app-section-icon">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span>Informasi Permohonan</span>
        </h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <InfoRow label="Nomor Permohonan" value={submissionNumber} />
        <InfoRow label="Nama Perusahaan/LPK" value={organizationName} />
        <InfoRow label="Jenis Permohonan" value={submissionType} />
        <InfoRow label="Status Izin" value={licenseStatus} />
        <InfoRow label="KBLI" value={getKbliOptionLabel(kbli)} />
        <InfoRow label="NIB" value={nib} />
        <InfoRow label="Status Permohonan" value={currentStatus} />
        <InfoRow label="Terakhir Diperbarui" value={lastUpdated} />
      </div>
    </div>
  );
};

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <div className="app-surface-tile p-3.5 sm:p-4">
    <p className="app-info-label">{label}</p>
    <p className="mt-1.5 font-medium text-slate-800 text-[14px] leading-snug">
      {value}
    </p>
  </div>
);

export default SummaryCard;
