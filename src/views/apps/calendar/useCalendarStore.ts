import type { Event, NewEvent } from "./types";

export const useCalendarStore = defineStore("calendar", {
  // arrow function recommended for full type inference
  state: () => ({
    availableCalendars: [
      { label: "Task", color: "primary" },
      { label: "Meeting", color: "success" },
      { label: "Leave", color: "warning" },
      { label: "Sick Leave", color: "error" },
      { label: "Sales Booking", color: "info" },
    ],
    // "View all" shows as checked because selected = all by default
    selectedCalendars: [
      "Task",
      "Meeting",
      "Leave",
      "Sick Leave",
      "Sales Booking",
    ],
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
