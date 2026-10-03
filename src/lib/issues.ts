export const ISSUE_TYPES = [
  { value: "pothole", label: "Pothole" },
  { value: "streetlight", label: "Broken streetlight" },
  { value: "sidewalk", label: "Damaged sidewalk" },
  { value: "drainage", label: "Drainage / flooding" },
  { value: "signage", label: "Missing / damaged sign" },
  { value: "other", label: "Other" },
] as const;

export const STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "rejected", label: "Rejected" },
] as const;

export const issueLabel = (v: string) => ISSUE_TYPES.find((i) => i.value === v)?.label ?? v;
export const statusLabel = (v: string) => STATUSES.find((s) => s.value === v)?.label ?? v;

export const statusClass = (v: string) =>
  ({
    pending: "bg-primary text-primary-foreground",
    in_progress: "bg-accent text-accent-foreground",
    resolved: "bg-success text-success-foreground",
    rejected: "bg-muted text-muted-foreground",
  })[v] ?? "bg-muted text-muted-foreground";
