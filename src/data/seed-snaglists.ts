import type { Meeting } from "./schema";

const NOW = new Date();
const atMin = (mins: number) => {
  const d = new Date(NOW);
  d.setMinutes(d.getMinutes() + mins);
  return d.toISOString();
};

export const SeedSnaglists: Meeting[] = [
  {
    id: 1,
    subject: "Snaglist - Workplace Activation Package",
    startAt: atMin(-24 * 60),
    duration: 30,
    endAt: atMin(-24 * 60 + 30),
    type: "Operation",
    linkedTo: [],
    relatedTo: { id: 1, name: "Workplace Activation Package", type: "job" },
    location: "Online",
    note: "Capture service-readiness items before recurring work starts",
    attachments: [],
    requestedBy: null,
    notes: [],
    createdAt: atMin(-24 * 60),
    updatedAt: atMin(-24 * 60),
  },
  {
    id: 2,
    subject: "Snaglist - Expo Pavilion Stand",
    startAt: atMin(24 * 60 + 180),
    duration: 30,
    endAt: atMin(24 * 60 + 210),
    type: "Operation",
    linkedTo: [],
    relatedTo: { id: 2, name: "Expo Pavilion Stand", type: "job" },
    location: "Expo site",
    note: "Track AV, electrical, and branding items before handover",
    attachments: [],
    requestedBy: null,
    notes: [],
    createdAt: atMin(0),
    updatedAt: atMin(0),
  },
];
