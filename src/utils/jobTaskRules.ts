import type { ToDo } from "@/data/schema";
import type {
  JobProperties,
  JobStatus,
} from "@/plugins/fake-api/handlers/operations/jobs/types";
import type { useSystemNotificationsStore } from "@/stores/systemNotifications";
import { getSignedInIdentity } from "@/utils/currentAccount";

type SystemNotificationsStore = ReturnType<typeof useSystemNotificationsStore>;

export const isJobTask = (todo: Partial<ToDo> | null | undefined) =>
  todo?.relatedTo?.type === "job";

export const isFutureJobTaskStart = (
  todoOrStartAt: Partial<ToDo> | string | null | undefined,
) => {
  const value =
    typeof todoOrStartAt === "string"
      ? todoOrStartAt
      : ((todoOrStartAt as Partial<ToDo> | null | undefined)?.startAt ?? null);

  if (!value) return false;

  const start = new Date(value);
  if (Number.isNaN(start.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);

  return start.getTime() > today.getTime();
};

export const isExecutableJobTaskStatus = (status?: string | null) =>
  status === "in_progress" || status === "for_review" || status === "completed";

export const hasJobTaskStartedEarly = (
  todo: Partial<ToDo> | null | undefined,
) => Boolean((todo as any)?.startedEarlyAt);

export const shouldHideJobTaskFromTasksPage = (todo: ToDo) =>
  isJobTask(todo) &&
  isFutureJobTaskStart(todo) &&
  !hasJobTaskStartedEarly(todo) &&
  !isExecutableJobTaskStatus(todo.status);

export const getCompletionMinutesDraft = (
  todo: Partial<ToDo> | null | undefined,
  fallback?: unknown,
) =>
  Number(
    fallback ??
      (todo as any)?.completionMinutes ??
      (todo as any)?.actualMinutes ??
      (todo as any)?.estimatedMinutes ??
      0,
  ) || null;

export const buildCompletedTaskPatch = (completionMinutes?: number | null) => ({
  completionMinutes: completionMinutes ?? null,
  status: "completed" as const,
  doneAt: new Date().toISOString(),
  completed: true,
  isCompleted: true,
});

export const deriveSuggestedJobStatus = (
  job: JobProperties | null | undefined,
  tasks: ToDo[],
): JobStatus => {
  if (!job) return "New";
  if ((job.status ?? job.stage) === "Closed") return "Closed";

  const hasWork =
    tasks.length > 0 ||
    (job.milestones?.length ?? 0) > 0 ||
    (job.goals?.length ?? 0) > 0;
  if (!hasWork) return "New";

  if (tasks.some((task) => task.status === "in_progress"))
    return "In Progress";

  const executableTasks = tasks.filter((task) => task.status !== "for_review");
  const allTasksCompleted =
    executableTasks.length > 0 &&
    executableTasks.every((task) => task.status === "completed");

  if (
    allTasksCompleted &&
    (job.milestones?.length || job.goals?.length || tasks.length)
  )
    return "Completed";

  if (tasks.some((task) => task.status === "completed")) return "On Hold";

  return "Pending";
};

export const isCurrentProjectOwner = (
  job: JobProperties | null | undefined,
) => {
  const ownerId = job?.projectManagerId;
  if (!ownerId) return true;

  const identity = getSignedInIdentity();

  return String(identity.employeeId ?? "") === String(ownerId);
};

export const createJobStatusSuggestionNotification = (
  systemNotificationsStore: SystemNotificationsStore,
  job: JobProperties,
  action: string,
  targetStatus: JobStatus,
) => {
  const ownerId = job.projectManagerId;
  if (!ownerId) return null;

  return systemNotificationsStore.addNotification({
    recipientEmployeeId: ownerId,
    title: `Status suggestion: ${job.name}`,
    body: `${action}. Suggested status: ${targetStatus}.`,
    type: "job-status",
    target: {
      entityType: "job",
      entityId: job.id,
      routeName: "operations-jobs-view-id",
      query: { tab: "milestones-goals" },
    },
  });
};
