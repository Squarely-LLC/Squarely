import type { Event, NewEvent } from "./types";

export const useCalendarStore = defineStore("calendar", {
  // arrow function recommended for full type inference
  state: () => ({
    availableCalendars: [
      { label: "To-Dos", color: "primary" },
      { label: "Meetings", color: "success" },
      { label: "Leaves", color: "warning" },
    ],
    // "View all" shows as checked because selected = all by default
    selectedCalendars: ["To-Dos", "Meetings", "Leaves"],
    todoImportantOnly: false,
  }),
  actions: {
    async fetchEvents() {
      const { data, error } = await useApi<any>(
        createUrl("/apps/calendar", {
          query: {
            calendars: this.selectedCalendars,
          },
        })
      );

      if (error.value) return error.value;

      return data.value;
    },
    async addEvent(event: NewEvent) {
      await $api("/apps/calendar", {
        method: "POST",
        body: event,
      });
    },
    async updateEvent(event: Event) {
      return await $api(`/apps/calendar/${event.id}`, {
        method: "PUT",
        body: event,
      });
    },
    async removeEvent(eventId: string) {
      return await $api(`/apps/calendar/${eventId}`, {
        method: "DELETE",
      });
    },
  },
});
