import type { ContactRef, Meeting, ToDo } from "@/data/schema";
import { SeedMeetings, SeedTodos } from "@/data/seed-todos";
import { db as contactsDb } from "@/plugins/fake-api/handlers/apps/contact/db";

// Build a minimal name->ContactRef map from the canonical contacts DB
const contactsMap: Record<string, ContactRef> = (contactsDb.users || []).reduce(
  (acc: any, u: any) => {
    // derive a short key from the fullName, fallback to id
    const key = (u.fullName || "").split(" ")[0]?.toLowerCase() || String(u.id);
    acc[key] = { id: u.id, name: u.fullName, avatarUrl: u.picture };
    return acc;
  },
  {} as Record<string, ContactRef>
);

export const db = {
  todos: structuredClone(SeedTodos) as ToDo[],
  contacts: contactsMap as Record<string, ContactRef>,
  Meetings: structuredClone(SeedMeetings) as Meeting[],
};
