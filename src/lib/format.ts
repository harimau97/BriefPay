export const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  FUNDED: "Authorized",
  IN_PROGRESS: "In progress",
  SUBMITTED: "Submitted",
  VERIFYING: "Verifying",
  PASSED: "Passed",
  FAILED: "Revision",
  PAID: "Captured",
  CANCELED: "Voided",
};

export const EVENT_LABEL: Record<string, string> = {
  CREATED: "Created",
  FUNDED: "Authorization hold",
  ACCEPTED: "Accepted",
  SUBMITTED: "Delivery submitted",
  VERIFYING: "Verification started",
  PASSED: "Verification passed",
  FAILED: "Revision requested",
  PAID: "Captured",
  CANCELED: "Hold released",
};

export const EVENT_COLOR: Record<string, string> = {
  CREATED: "blue",
  FUNDED: "orange",
  ACCEPTED: "indigo",
  SUBMITTED: "teal",
  VERIFYING: "gray",
  PASSED: "green",
  FAILED: "red",
  PAID: "green",
  CANCELED: "gray",
};

export function formatMoney(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export function formatWhen(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function centsToPayPal(cents: number) {
  if (!Number.isInteger(cents) || cents <= 0) {
    throw new Error("Amount must be a whole number of cents, at least 1.");
  }
  return (cents / 100).toFixed(2);
}

export function appBaseUrl() {
  return (process.env.APP_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
}
