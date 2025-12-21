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
    subject: "Site survey — HQ Renovation",
    startAt: atMin(-6 * 60), // earlier today
    duration: 60,
    endAt: atMin(-5 * 60),
    type: "Operation",
    linkedTo: [],
    relatedTo: { id: 3, name: "Headquarters Renovation", type: "job" },
    location: "On-site",
    note: "Verify access points and safety constraints",
    attachments: [],
    requestedBy: null,
    notes: [],
    createdAt: atMin(-6 * 60),
    updatedAt: atMin(-6 * 60),
  },
  {
    id: 2,
    subject: "Site survey — Expo Pavilion",
    startAt: atMin(24 * 60 + 120),
    duration: 45,
    endAt: atMin(24 * 60 + 165),
    type: "Operation",
    linkedTo: [],
    relatedTo: { id: 2, name: "Expo Pavilion", type: "job" },
    location: "Expo site",
    note: "Check rigging points and utilities",
    attachments: [],
    requestedBy: null,
    notes: [],
    createdAt: atMin(0),
    updatedAt: atMin(0),
  },
];
