export interface KbliOption {
  value: string;
  label: string;
}

export const KBLI_OPTIONS: KbliOption[] = [
  { value: "78425", label: "78425 - Pelatihan Kerja Bisnis dan Manajemen Swasta" },
  { value: "85575", label: "85575 - Pelatihan Kerja Bisnis dan Manajemen Swasta" },
];

export const normalizeKbliCode = (value: string | undefined): string => {
  const normalized = value?.trim() || "";
  if (!normalized) return "";

  const [code] = normalized.split("-");
  return code?.trim() || normalized;
};

export const getKbliOptionLabel = (value: string | undefined): string => {
  const normalizedCode = normalizeKbliCode(value);
  if (!normalizedCode) return "-";

  return KBLI_OPTIONS.find((option) => option.value === normalizedCode)?.label || normalizedCode;
};
