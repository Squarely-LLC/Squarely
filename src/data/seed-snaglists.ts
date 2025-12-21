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
    subject: "Snaglist — HQ Renovation",
    startAt: atMin(-24 * 60), // yesterday
    duration: 30,
    endAt: atMin(-24 * 60 + 30),
    type: "Operation",
    linkedTo: [],
    relatedTo: { id: 3, name: "Headquarters Renovation", type: "job" },
    location: "On-site",
    note: "Initial snag capture for main lobby",
    attachments: [],
    requestedBy: null,
    notes: [],
    createdAt: atMin(-24 * 60),
    updatedAt: atMin(-24 * 60),
  },
  {
    id: 2,
    subject: "Snaglist — Expo Pavilion",
    startAt: atMin(24 * 60 + 180), // tomorrow +3h
    duration: 30,
    endAt: atMin(24 * 60 + 210),
    type: "Operation",
    linkedTo: [],
    relatedTo: { id: 2, name: "Expo Pavilion", type: "job" },
    location: "Expo site",
    note: "AV & electrical items to resolve",
    attachments: [],
    requestedBy: null,
    notes: [],
    createdAt: atMin(0),
    updatedAt: atMin(0),
  },
];
