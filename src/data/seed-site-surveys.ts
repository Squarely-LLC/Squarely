import type { Meeting } from "./schema";

const NOW = new Date();
const atMin = (mins: number) => {
  const d = new Date(NOW);
  d.setMinutes(d.getMinutes() + mins);
  return d.toISOString();
};

export const SeedSiteSurveys: Meeting[] = [
  {
    id: 1,
    subject: "Site survey - Workplace Activation Package",
    startAt: atMin(-6 * 60),
    duration: 60,
    endAt: atMin(-5 * 60),
    type: "Operation",
    linkedTo: [],
    relatedTo: { id: 1, name: "Workplace Activation Package", type: "job" },
    location: "Online",
    note: "Verify workspace zones, access windows, and service constraints",
    attachments: [],
    requestedBy: null,
    notes: [],
    createdAt: atMin(-6 * 60),
    updatedAt: atMin(-6 * 60),
  },
  {
    id: 2,
    subject: "Site survey - Expo Pavilion Stand",
    startAt: atMin(24 * 60 + 120),
    duration: 45,
    endAt: atMin(24 * 60 + 165),
    type: "Operation",
    linkedTo: [],
    relatedTo: { id: 2, name: "Expo Pavilion Stand", type: "job" },
    location: "Expo site",
    note: "Check rigging points, utilities, and venue access constraints",
    attachments: [],
    requestedBy: null,
    notes: [],
    createdAt: atMin(0),
    updatedAt: atMin(0),
  },
];
