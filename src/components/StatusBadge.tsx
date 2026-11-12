import { STATUS_LABEL } from "@/lib/format";

const tone: Record<string, string> = {
  DRAFT: "badge",
  FUNDED: "badge badge-warning",
  IN_PROGRESS: "badge badge-info",
  SUBMITTED: "badge badge-info",
  VERIFYING: "badge badge-warning",
  PASSED: "badge badge-success",
  FAILED: "badge badge-error",
  PAID: "badge badge-success",
  CANCELED: "badge",
};

export function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABEL[status];
  return <span className={tone[status] || "badge"}>{label || status}</span>;
}
