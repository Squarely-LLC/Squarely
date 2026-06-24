export type JobLifecycleColor =
  | "teal"
  | "purple"
  | "primary"
  | "success"
  | "secondary";

const normalizeStatus = (status?: string | null) =>
  String(status ?? "")
    .trim()
    .toLowerCase();

export const jobStatusColor = (
  status?: string | null,
): JobLifecycleColor | undefined => {
  switch (normalizeStatus(status)) {
    case "new":
      return "teal";
    case "pending":
    case "on hold":
      return "purple";
    case "completed":
      return "success";
    case "closed":
      return "secondary";
    case "in progress":
      return "primary";
    default:
      return undefined;
  }
};

export const jobWorkStatusColor = (
  status?: string | null,
): JobLifecycleColor | undefined => {
  if (normalizeStatus(status) === "not started") return "secondary";

  return jobStatusColor(status);
};

export const jobStatusColorClass = (status?: string | null) => {
  const color = jobStatusColor(status);

  return color ? `job-status-color--${color}` : "job-status-color--default";
};

export const jobWorkStatusColorClass = (status?: string | null) => {
  const color = jobWorkStatusColor(status);

  return color ? `job-status-color--${color}` : "job-status-color--default";
};

const chipStyles: Record<JobLifecycleColor, Record<string, string>> = {
  teal: {
    backgroundColor: "rgba(0, 150, 136, 0.18)",
    color: "#12cfc0",
  },
  purple: {
    backgroundColor: "rgba(156, 39, 176, 0.2)",
    color: "#d59bea",
  },
  primary: {
    backgroundColor: "rgba(var(--v-theme-primary), 0.18)",
    color: "rgb(var(--v-theme-primary))",
  },
  success: {
    backgroundColor: "rgba(var(--v-theme-success), 0.18)",
    color: "rgb(var(--v-theme-success))",
  },
  secondary: {
    backgroundColor: "rgba(var(--v-theme-secondary), 0.18)",
    color: "rgb(var(--v-theme-secondary))",
  },
};

export const jobStatusChipStyle = (status?: string | null) => {
  const color = jobStatusColor(status);

  return color ? chipStyles[color] : undefined;
};

export const jobWorkStatusChipStyle = (status?: string | null) => {
  const color = jobWorkStatusColor(status);

  return color ? chipStyles[color] : undefined;
};
