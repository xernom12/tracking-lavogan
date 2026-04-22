import { useContext } from "react";
import { SubmissionContext } from "@/contexts/submission-context.shared";

export const useSubmissions = () => {
  const ctx = useContext(SubmissionContext);
  if (!ctx) throw new Error("useSubmissions must be used within SubmissionProvider");
  return ctx;
};
