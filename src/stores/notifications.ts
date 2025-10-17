import { defineStore } from "pinia";

export type Notification = {
  id: number;
  message: string;
  color?: string;
  timeout?: number;
};

let nextId = 1;

export const useNotificationsStore = defineStore("notifications", {
  state: () => ({
    items: [] as Notification[],
  }),
  actions: {
    push(message: string, color = "info", timeout = 3000) {
      const id = nextId++;
      const note: Notification = { id, message, color, timeout };
      this.items.push(note);
      return id;
    },
    remove(id: number) {
      const idx = this.items.findIndex((n) => n.id === id);
      if (idx !== -1) this.items.splice(idx, 1);
    },
    clear() {
      this.items = [];
    },
  },
});
