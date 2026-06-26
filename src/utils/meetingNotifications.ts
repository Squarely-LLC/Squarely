import type { Meeting } from "@/data/schema";
import { usePeopleStore } from "@/stores/people";
import { useSystemNotificationsStore } from "@/stores/systemNotifications";
import { formatSystemDateTime } from "@core/utils/formatters";

type MeetingNotificationEvent =
  | "scheduled"
  | "missed"
  | "postponed"
  | "canceled"
  | "completed";

type NotifyOptions = {
  postponedTo?: Date;
  dedupe?: boolean;
  includeManagers?: boolean;
  includeRequestedBy?: boolean;
  includeRequestedByManager?: boolean;
};

const stripSelectionPrefix = (value: unknown) => {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(?:employee|contact|both)-(.+)$/);
  return match ? match[1].split("-")[0] : raw;
};

const normalizeText = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const targetForMeeting = (meeting: Pick<Meeting, "id">) => ({
  entityType: "meeting",
  entityId: meeting.id,
  path: `/apps/meetings/${meeting.id}/minutes`,
});

export function meetingNotificationRecipients(
  meeting: Pick<Meeting, "linkedTo" | "requestedBy">,
  options: {
    includeManagers?: boolean;
    includeRequestedBy?: boolean;
    includeRequestedByManager?: boolean;
  } = {},
) {
  const peopleStore = usePeopleStore();
  peopleStore.init();

  const recipients = new Set<number>();
  const refs = [
    ...(Array.isArray(meeting.linkedTo)
      ? meeting.linkedTo.map((ref) => ({ ref, requestedBy: false }))
      : []),
    ...(options.includeRequestedBy && meeting.requestedBy
      ? [{ ref: meeting.requestedBy, requestedBy: true }]
      : []),
  ].filter((entry) => Boolean(entry.ref)) as Array<{ ref: any; requestedBy: boolean }>;

  refs.forEach(({ ref, requestedBy }) => {
    const person = resolveMeetingNotificationPerson(ref, requestedBy);

    if (!person?.hrProfile) return;

    recipients.add(person.id);

    if (options.includeManagers || (requestedBy && options.includeRequestedByManager)) {
      (person.hrProfile.employment?.reportToIds || []).forEach((managerId) => {
        const manager = peopleStore.byId(managerId);
        if (manager?.hrProfile) recipients.add(manager.id);
      });
    }
  });

  return [...recipients];
}

export function resolveMeetingNotificationPerson(ref: any, requestedBy = false) {
  const peopleStore = usePeopleStore();
  peopleStore.init();

  const roles = Array.isArray(ref?.roles) ? ref.roles : [];
  const type = String(ref?.type ?? "");
  const employeeLike =
    requestedBy ||
    roles.includes("employee") ||
    type === "employee" ||
    type === "employee_contact" ||
    ref?.employeeId !== undefined ||
    ref?.personId !== undefined;

  if (!employeeLike) return null;

  const candidateIds = [
    ref?.employeeId,
    ref?.personId,
    type === "employee" || type === "employee_contact" || requestedBy ? ref?.id : undefined,
    ref?.value,
  ]
    .filter((value) => value !== undefined && value !== null && value !== "")
    .map(stripSelectionPrefix);

  const byId = candidateIds
    .map((id) => peopleStore.byId(id))
    .find((entry) => entry?.hrProfile);
  if (byId) return byId;

  const email = normalizeText(ref?.email);
  if (email) {
    const byEmail = peopleStore.hrPeople.find(
      (entry) => normalizeText(entry.email) === email,
    );
    if (byEmail) return byEmail;
  }

  const name = normalizeText(ref?.name || ref?.title || ref?.fullName);
  if (!name) return null;

  return (
    peopleStore.hrPeople.find((entry) => normalizeText(entry.fullName) === name) ||
    null
  );
}

export function meetingNotificationEmployeeKey(ref: any, requestedBy = false) {
  const person = resolveMeetingNotificationPerson(ref, requestedBy);
  return person?.hrProfile ? String(person.id) : null;
}

export function notifyMeetingEvent(
  meeting: Meeting,
  event: MeetingNotificationEvent,
  options: NotifyOptions = {},
) {
  const systemNotificationsStore = useSystemNotificationsStore();
  systemNotificationsStore.init();

  const subject = meeting.subject || "Meeting";
  const startText = meeting.startAt
    ? formatSystemDateTime(new Date(meeting.startAt).getTime())
    : "--";
  const postponedText = options.postponedTo
    ? formatSystemDateTime(options.postponedTo.getTime())
    : startText;

  const title =
    event === "scheduled"
      ? `Meeting scheduled: ${subject}`
      : event === "missed"
        ? `Meeting missed: ${subject}`
        : event === "postponed"
          ? `Meeting postponed: ${subject}`
          : event === "canceled"
            ? `Meeting canceled: ${subject}`
            : `Meeting completed: ${subject}`;
  const body =
    event === "scheduled"
      ? `${subject} is scheduled for ${startText}.`
      : event === "missed"
        ? `${subject} was scheduled for ${startText} and is now missed.`
        : event === "postponed"
          ? `${subject} was postponed to ${postponedText}.`
          : event === "canceled"
            ? `${subject} was canceled.`
            : `${subject} was completed.`;

  const target = targetForMeeting(meeting);
  const recipients = meetingNotificationRecipients(meeting, {
    includeManagers: event === "scheduled" ? false : Boolean(options.includeManagers),
    includeRequestedBy: options.includeRequestedBy ?? true,
    includeRequestedByManager:
      options.includeRequestedByManager ?? event === "scheduled",
  });

  recipients.forEach((recipientEmployeeId) => {
    if (
      options.dedupe &&
      systemNotificationsStore.items.some(
        (notification) =>
          Number(notification.recipientEmployeeId) === recipientEmployeeId &&
          notification.type === "meeting" &&
          notification.title === title &&
          String(notification.target?.entityId ?? "") === String(meeting.id),
      )
    )
      return;

    systemNotificationsStore.addNotification({
      recipientEmployeeId,
      title,
      body,
      type: "meeting",
      target,
    });
  });
}

export function notifyMeetingAttendeesAdded(
  meeting: Meeting,
  attendees: NonNullable<Meeting["linkedTo"]>,
) {
  if (!attendees.length) return;

  const systemNotificationsStore = useSystemNotificationsStore();
  systemNotificationsStore.init();

  const subject = meeting.subject || "Meeting";
  const startText = meeting.startAt
    ? formatSystemDateTime(new Date(meeting.startAt).getTime())
    : "--";
  const title = `Meeting attendee added: ${subject}`;
  const body = `You were added to ${subject}, scheduled for ${startText}.`;
  const target = targetForMeeting(meeting);
  const recipients = meetingNotificationRecipients(
    { linkedTo: attendees, requestedBy: null as any },
    { includeManagers: false, includeRequestedBy: false },
  );

  recipients.forEach((recipientEmployeeId) => {
    systemNotificationsStore.addNotification({
      recipientEmployeeId,
      title,
      body,
      type: "meeting",
      target,
    });
  });
}
