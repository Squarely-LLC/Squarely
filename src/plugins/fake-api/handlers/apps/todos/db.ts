import type { ContactRef, Meeting, ToDo } from "@/data/schema";
import { Contacts, SeedMeetings, SeedTodos } from "@/data/seed-todos";

export const db = {
  todos: structuredClone(SeedTodos) as ToDo[],
  contacts: Contacts as Record<string, ContactRef>,
  Meetings: structuredClone(SeedMeetings) as Meeting[],
};
