import type { Document, DocumentStatus } from "./mockData.js";

export const DOCUMENT_NAMES = [
  "Surat Permohonan Izin",
  "Salinan Izin Usaha",
  "Salinan Akreditasi",
  "Perjanjian Kerja Sama Luar Negeri",
  "Program Pemagangan",
  "Rencana Penempatan Pasca Pemagangan",
  "Profil LPK",
  "Draft Perjanjian Pemagangan",
];

export const buildReviewDocuments = (status: DocumentStatus = "locked"): Document[] =>
  DOCUMENT_NAMES.map((name) => ({ name, status, history: [] }));
