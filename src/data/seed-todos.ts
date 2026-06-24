import { db } from "@/plugins/fake-api/handlers/apps/contact/db";
import { db as employeesDb } from "@/plugins/fake-api/handlers/apps/employees/db";
import { db as dealsDb } from "@/plugins/fake-api/handlers/operations/deals/db";
import type { ContactRef, Meeting, ToDo } from "./schema";

export const nowISO = () => new Date().toISOString();

const dateOnlyISO = (offsetDays: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).toISOString();
};

// === helper to resolve contact refs from the canonical contacts DB ===
// Keep no contact objects in this file; only the small name->id map and a runtime resolver.
// Use explicit IDs from the contacts DB so mapping is done by id only.
const byId = (id: number) => db.users.find((u) => Number(u.id) === Number(id));

const contactRef = (id: number): ContactRef => {
  const u = byId(id);
  return u
    ? { id: u.id, name: u.fullName, avatarUrl: u.picture || undefined }
    : { id, name: `User ${id}` };
};

// Minimal name -> id map only; this file contains NO contact objects/data.
const nameToId: Record<string, number> = {
  ted: 1,
  dana: 3,
  pierre: 7,
  alex: 8,
  nora: 10,
  omar: 5,
  lina: 6,
};

// `C.<name>` resolves dynamically to a ContactRef from the canonical DB at runtime.
const C: Record<string, ContactRef> = new Proxy(
  {},
  {
    get(_, prop: string) {
      const id = nameToId[prop];
      return id ? employeeRef(id) : undefined;
    },
  },
) as Record<string, ContactRef>;

const employeePersonIdByLegacyId: Record<number, number> = {
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  10: 10,
};

const employeeRef = (legacyEmployeeId: number): ContactRef => {
  const employee = employeesDb.users.find(
    (user) => Number(user.id) === Number(legacyEmployeeId),
  );
  const personId =
    employeePersonIdByLegacyId[legacyEmployeeId] ?? legacyEmployeeId;

  return employee
    ? {
        id: personId,
        name: employee.fullName,
        avatarUrl: employee.picture || undefined,
      }
    : { id: personId, name: `Person #${personId}` };
};

const E = {
  lina: employeeRef(1),
  farah: employeeRef(2),
  daniel: employeeRef(3),
  rana: employeeRef(4),
  salesManager: employeeRef(5),
  salesExecutive: employeeRef(6),
  operationManager: employeeRef(7),
  operationExecutive: employeeRef(8),
  auditor: employeeRef(9),
  financeExecutive: employeeRef(10),
};

// shared meeting time helpers
const MEET_NOW = new Date();
const atMin = (mins: number) => {
  const d = new Date(MEET_NOW);
  d.setMinutes(d.getMinutes() + mins);
  return d.toISOString();
};

const endAtFrom = (startISO: string, mins: number) => {
  const d = new Date(startISO);
  d.setMinutes(d.getMinutes() + mins);
  return d.toISOString();
};

const dealCode = (id: number) =>
  dealsDb.deals.find((deal) => Number(deal.id) === Number(id))?.code ||
  `DL${String(id).padStart(2, "0")}`;

const dealRef = (id: number) => ({
  id,
  name: dealCode(id),
  type: "deal" as const,
});

// Keep task seeds limited to records owned by active modules.
export const SeedTodos: ToDo[] = [
  // Module-backed seeds only: deal tasks/email threads and job project tasks.
  {
    id: 560,
    title: "Confirm final wall finish samples",
    collaborators: [E.farah, E.lina],
    dueAt: dateOnlyISO(2),
    afterWhen: "+2 days",
    startTrigger: { type: "time", goalId: null, taskId: null },
    important: true,
    status: "pending",
    steps: [],
    notes: "Review mockups with client before production slot is locked.",
    activities: [],
    relatedTo: dealRef(1),
    createdAt: nowISO(),
    updatedAt: nowISO(),
  },
  {
    id: 561,
    title: "Email Correspondence",
    collaborators: [],
    dueAt: dateOnlyISO(0),
    important: false,
    status: "completed",
    steps: [],
    notes: "__deal_email_thread__",
    activities: [],
    messages: [
      {
        id: "561-msg-1",
        author: C.dana,
        body: "Proposal pack sent with updated lead times and installation sequence.",
        createdAt: new Date(Date.now() - 27 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "561-msg-2",
        author: C.ted,
        body: "Acknowledged. Waiting for final comments on the decorative finish samples.",
        createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      },
    ],
    relatedTo: dealRef(1),
    createdAt: nowISO(),
    updatedAt: nowISO(),
  },
  {
    id: 562,
    title: "Confirm maintenance access windows",
    collaborators: [E.lina, E.farah],
    dueAt: dateOnlyISO(3),
    afterWhen: "+3 days",
    startTrigger: { type: "time", goalId: null, taskId: null },
    important: false,
    status: "in_progress",
    steps: [],
    notes: "Need building management approval for after-hours service access.",
    activities: [],
    relatedTo: dealRef(2),
    createdAt: nowISO(),
    updatedAt: nowISO(),
  },
  {
    id: 565,
    title: "Email Correspondence",
    collaborators: [],
    dueAt: dateOnlyISO(0),
    important: false,
    status: "completed",
    steps: [],
    notes: "__deal_email_thread__",
    activities: [],
    messages: [
      {
        id: "565-msg-1",
        author: C.omar,
        body: "Shared revised maintenance contract wording and rental return checklist.",
        createdAt: new Date(Date.now() - 9 * 60 * 60 * 1000).toISOString(),
      },
    ],
    relatedTo: dealRef(2),
    createdAt: nowISO(),
    updatedAt: nowISO(),
  },
  {
    id: 563,
    title: "Collect event site readiness checklist",
    collaborators: [E.lina, E.rana],
    dueAt: dateOnlyISO(1),
    afterWhen: "+1 day",
    startTrigger: { type: "time", goalId: null, taskId: null },
    important: true,
    status: "for_review",
    steps: [],
    notes: "Venue access, branding points, and acoustic treatment placement.",
    activities: [],
    relatedTo: dealRef(3),
    createdAt: nowISO(),
    updatedAt: nowISO(),
  },
  {
    id: 564,
    title: "Email Correspondence",
    collaborators: [],
    dueAt: dateOnlyISO(0),
    important: false,
    status: "completed",
    steps: [],
    notes: "__deal_email_thread__",
    activities: [],
    messages: [
      {
        id: "564-msg-1",
        author: C.lina,
        body: "Client approved the pod cleaning cadence. Please lock June slots.",
        createdAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "564-msg-2",
        author: C.ted,
        body: "Slots reserved. Retainer review remains on hold until venue plan is final.",
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      },
    ],
    relatedTo: dealRef(3),
    createdAt: nowISO(),
    updatedAt: nowISO(),
  },
  {
    id: 566,
    title: "Confirm acoustic review checklist",
    collaborators: [E.operationManager, E.operationExecutive],
    dueAt: dateOnlyISO(21),
    startAt: dateOnlyISO(-1),
    completionMinutes: 90,
    priority: "high",
    important: true,
    status: "completed",
    steps: [],
    notes: "Checklist completed with rooms, circulation paths, and consultant comments.",
    activities: [],
    relatedTo: { id: 1, name: "Workplace Activation Package", type: "job" },
    milestoneId: 1,
    goalId: 1,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  },
  {
    id: 567,
    title: "Lock recurring cleaning calendar",
    collaborators: [E.operationManager, E.operationExecutive, E.salesManager],
    dueAt: dateOnlyISO(42),
    startAt: dateOnlyISO(0),
    completionMinutes: 60,
    priority: "normal",
    important: false,
    status: "in_progress",
    steps: [],
    notes: "Confirm access windows before recurring pod cleaning begins.",
    activities: [],
    relatedTo: { id: 1, name: "Workplace Activation Package", type: "job" },
    milestoneId: 2,
    goalId: 2,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  },
  {
    id: 568,
    title: "Issue production drawing pack",
    collaborators: [E.operationManager, E.operationExecutive],
    dueAt: dateOnlyISO(24),
    startAt: dateOnlyISO(14),
    completionMinutes: 120,
    priority: "high",
    important: true,
    status: "pending",
    steps: [],
    notes: "Prepare the approved drawing pack for the expo stand before fabrication.",
    activities: [],
    relatedTo: { id: 2, name: "Expo Pavilion Stand", type: "job" },
    milestoneId: 1,
    goalId: 1,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  }
];

export const SeedMeetings: Meeting[] = [
  {
    id: 1,
    subject: "Sales discovery - Decorative Wall Finish",
    startAt: atMin(60), // in 1h
    duration: 45,
    type: "Sales",
    linkedTo: [C.ted], // linked contacts (names)
    location: "Zoom",
    note: "Confirm decorative finish scope, sample timing, and delivery date.",
    attachments: [],
    requestedBy: { id: C.dana.id, name: C.dana.name },
    createdAt: MEET_NOW.toISOString(),
    updatedAt: MEET_NOW.toISOString(),
    endAt: endAtFrom(atMin(60), 45),
  },
  {
    id: 2,
    subject: "Weekly operations review",
    startAt: atMin(24 * 60), // tomorrow
    duration: 30,
    type: "Operation",
    linkedTo: [C.ted, C.dana, C.pierre, C.alex],
    location: "Squarely HQ - Operations Room",
    note: "Review job status, blockers, delivery dates, and owner actions.",
    attachments: [],
    requestedBy: { id: C.pierre.id, name: C.pierre.name },
    createdAt: MEET_NOW.toISOString(),
    updatedAt: MEET_NOW.toISOString(),
    endAt: endAtFrom(atMin(24 * 60), 30),
  },
  {
    id: 3,
    subject: "Site survey - Expo Pavilion Venue",
    startAt: atMin(2 * 24 * 60 + 9 * 60), // in 2 days at ~+9h
    duration: 90,
    type: "Site Visit",
    linkedTo: [C.omar],
    location: "Doha Expo Venue",
    note: "Check access points, loading path, power, and branding zones.",
    attachments: [],
    requestedBy: { id: C.omar.id, name: C.omar.name },
    createdAt: MEET_NOW.toISOString(),
    updatedAt: MEET_NOW.toISOString(),
    endAt: endAtFrom(atMin(2 * 24 * 60 + 9 * 60), 90),
  },
  {
    id: 4,
    subject: "Client communication brief - Q3 retainers",
    startAt: atMin(3 * 24 * 60 + 14 * 60), // in 3 days ~+14h
    duration: 60,
    type: "Brief",
    linkedTo: [C.lina, C.dana],
    location: "Google Meet",
    note: "Confirm client update cadence, budget notes, and renewal risks.",
    attachments: [],
    requestedBy: { id: C.lina.id, name: C.lina.name },
    createdAt: MEET_NOW.toISOString(),
    updatedAt: MEET_NOW.toISOString(),
    endAt: endAtFrom(atMin(3 * 24 * 60 + 14 * 60), 60),
  },
  {
    id: 5,
    subject: "Sales follow-up - Decorative Wall Finish pricing",
    startAt: atMin(-6 * 60), // 6h ago (history)
    duration: 30,
    type: "Sales",
    linkedTo: [C.ted],
    location: "Phone",
    note: "Confirm discount structure, VAT treatment, and sample approval.",
    attachments: [],
    requestedBy: { id: C.ted.id, name: C.ted.name },
    createdAt: MEET_NOW.toISOString(),
    updatedAt: MEET_NOW.toISOString(),
    endAt: endAtFrom(atMin(-6 * 60), 30),
  },
  {
    id: 6,
    subject: "Operations issue review - recurring service access",
    startAt: atMin(48 * 60 + 10 * 60), // in 2 days ~10:00
    duration: 50,
    type: "Operation",
    linkedTo: [C.nora, C.ted],
    location: "Squarely HQ - Operations Room",
    note: "Review access issue timeline, owner action, and manager notification.",
    attachments: [],
    requestedBy: { id: C.nora.id, name: C.nora.name },
    createdAt: MEET_NOW.toISOString(),
    updatedAt: MEET_NOW.toISOString(),
    endAt: endAtFrom(atMin(48 * 60 + 10 * 60), 50),
  },
  {
    id: 7,
    subject: "Site visit - Residence Interior Renovation",
    startAt: atMin(5 * 24 * 60 + 9 * 60 + 30),
    duration: 75,
    type: "Site Visit",
    linkedTo: [C.pierre],
    location: "Beirut residence",
    note: "Review room access, protection needs, and client decision points.",
    attachments: [],
    requestedBy: { id: C.pierre.id, name: C.pierre.name },
    createdAt: MEET_NOW.toISOString(),
    updatedAt: MEET_NOW.toISOString(),
    endAt: endAtFrom(atMin(5 * 24 * 60 + 9 * 60 + 30), 75),
  },
  {
    id: 8,
    subject: "Brief - Workplace activation readiness",
    startAt: atMin(7 * 24 * 60 + 15 * 60),
    duration: 40,
    type: "Brief",
    linkedTo: [C.dana, C.alex],
    location: "Google Meet",
    note: "Confirm acoustic review, pod cleaning calendar, and delivery risks.",
    attachments: [],
    requestedBy: { id: C.dana.id, name: C.dana.name },
    createdAt: MEET_NOW.toISOString(),
    updatedAt: MEET_NOW.toISOString(),
    endAt: endAtFrom(atMin(7 * 24 * 60 + 15 * 60), 40),
  },
  {
    id: 9,
    subject: "Project sync - Workplace Activation Package",
    startAt: atMin(12 * 60), // later today
    duration: 60,
    type: "Operation",
    linkedTo: [C.ted, C.pierre],
    relatedTo: { id: 1, name: "Workplace Activation Package", type: "job" },
    location: "Zoom",
    note: "Progress check with workplace activation stakeholders",
    attachments: [],
    requestedBy: { id: C.ted.id, name: C.ted.name },
    createdAt: MEET_NOW.toISOString(),
    updatedAt: MEET_NOW.toISOString(),
    endAt: endAtFrom(atMin(12 * 60), 60),
  },
  {
    id: 10,
    subject: "Client review - Expo Pavilion Stand",
    startAt: atMin(2 * 24 * 60 + 11 * 60), // in 2 days
    duration: 45,
    type: "Brief",
    linkedTo: [C.dana, C.alex],
    relatedTo: { id: 2, name: "Expo Pavilion Stand", type: "job" },
    location: "Google Meet",
    note: "Design review with sponsor before production drawings are issued",
    attachments: [],
    requestedBy: { id: C.alex.id, name: C.alex.name },
    createdAt: MEET_NOW.toISOString(),
    updatedAt: MEET_NOW.toISOString(),
    endAt: endAtFrom(atMin(2 * 24 * 60 + 11 * 60), 45),
  },
  {
    id: 11,
    subject: `Deal review - ${dealCode(1)}`,
    startAt: atMin(6 * 60),
    duration: 45,
    type: "Sales",
    linkedTo: [C.ted, C.dana],
    relatedTo: dealRef(1),
    location: "Zoom",
    note: "Finalize decorative finish sequence and proposal exclusions.",
    attachments: [],
    requestedBy: { id: C.dana.id, name: C.dana.name },
    createdAt: MEET_NOW.toISOString(),
    updatedAt: MEET_NOW.toISOString(),
    endAt: endAtFrom(atMin(6 * 60), 45),
  },
  {
    id: 12,
    subject: `Client call - ${dealCode(1)}`,
    startAt: atMin(-3 * 60),
    duration: 20,
    type: "Brief",
    linkedTo: [C.ted],
    relatedTo: dealRef(1),
    location: "Phone",
    note: "Quick confirmation on sample drop-off and pricing bracket.",
    attachments: [],
    requestedBy: { id: C.ted.id, name: C.ted.name },
    createdAt: MEET_NOW.toISOString(),
    updatedAt: MEET_NOW.toISOString(),
    endAt: endAtFrom(atMin(-3 * 60), 20),
  },
  {
    id: 13,
    subject: `Maintenance scope check - ${dealCode(2)}`,
    startAt: atMin(26 * 60),
    duration: 30,
    type: "Operation",
    linkedTo: [C.omar, C.nora],
    relatedTo: dealRef(2),
    location: "Google Meet",
    note: "Review pendant rental handoff and annual lighting service scope.",
    attachments: [],
    requestedBy: { id: C.omar.id, name: C.omar.name },
    createdAt: MEET_NOW.toISOString(),
    updatedAt: MEET_NOW.toISOString(),
    endAt: endAtFrom(atMin(26 * 60), 30),
  },
  {
    id: 14,
    subject: `Venue readiness call - ${dealCode(3)}`,
    startAt: atMin(9 * 60),
    duration: 25,
    type: "Brief",
    linkedTo: [C.lina, C.alex],
    relatedTo: dealRef(3),
    location: "Phone",
    note: "Confirm pod cleaning timing and planter placement around event access.",
    attachments: [],
    requestedBy: { id: C.lina.id, name: C.lina.name },
    createdAt: MEET_NOW.toISOString(),
    updatedAt: MEET_NOW.toISOString(),
    endAt: endAtFrom(atMin(9 * 60), 25),
  },
];
