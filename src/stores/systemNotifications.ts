import { defineStore } from "pinia";

export type SystemNotificationTarget = {
  entityType: string;
  entityId?: number | string | null;
  routeName?: string | null;
  path?: string | null;
  params?: Record<string, number | string | null | undefined>;
  query?: Record<string, number | string | null | undefined>;
};

export type SystemNotificationType =
  | "job-assignment"
  | "document-expiry"
  | "task"
  | "meeting"
  | "event"
  | "system";

export type SystemNotification = {
  id: number;
  recipientEmployeeId: number | string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  type: SystemNotificationType | string;
  target: SystemNotificationTarget | null;
};

const STORAGE_KEY = "app.system-notifications.v2";

const cloneNotification = (notification: SystemNotification) => ({
  ...notification,
  target: notification.target ? { ...notification.target } : null,
});

const readStoredNotifications = (): SystemNotification[] => {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((entry): entry is SystemNotification => {
        return (
          entry &&
          typeof entry === "object" &&
          entry.id !== undefined &&
          entry.recipientEmployeeId !== undefined &&
          typeof entry.title === "string" &&
          typeof entry.body === "string"
        );
      })
      .map((entry) => ({
        id: Number(entry.id),
        recipientEmployeeId: entry.recipientEmployeeId,
        title: entry.title,
        body: entry.body,
        createdAt: entry.createdAt || new Date().toISOString(),
        readAt: entry.readAt ?? null,
        type: entry.type || "system",
        target: entry.target ?? null,
      }));
  } catch {
    return [];
  }
};

export const useSystemNotificationsStore = defineStore("systemNotifications", {
  state: () => ({
    items: [] as SystemNotification[],
    initialized: false,
  }),
  actions: {
    init() {
      if (this.initialized) return;

      this.items = readStoredNotifications();
      this.initialized = true;
    },
    persist() {
      if (typeof window === "undefined") return;

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
    },
    forEmployee(employeeId: number | string | null | undefined) {
      if (employeeId === undefined || employeeId === null || employeeId === "")
        return [];

      const normalizedEmployeeId = String(employeeId);

      return this.items
        .filter(
          (notification) =>
            String(notification.recipientEmployeeId) === normalizedEmployeeId,
        )
        .map(cloneNotification);
    },
    addNotification(
      payload: Omit<SystemNotification, "id" | "createdAt" | "readAt"> &
        Partial<Pick<SystemNotification, "id" | "createdAt" | "readAt">>,
    ) {
      this.init();

      const existingIds = this.items.map((notification) => Number(notification.id));
      const nextId =
        payload.id ??
        Math.max(Date.now(), existingIds.length ? Math.max(...existingIds) + 1 : 1);
      const notification: SystemNotification = {
        id: Number(nextId),
        recipientEmployeeId: payload.recipientEmployeeId,
        title: payload.title,
        body: payload.body,
        createdAt: payload.createdAt ?? new Date().toISOString(),
        readAt: payload.readAt ?? null,
        type: payload.type,
        target: payload.target ?? null,
      };

      this.items.unshift(notification);
      this.persist();

      return notification;
    },
    markRead(ids: number[], readAt = new Date().toISOString()) {
      const idSet = new Set(ids.map((id) => Number(id)));

      this.items = this.items.map((notification) =>
        idSet.has(Number(notification.id))
          ? { ...notification, readAt }
          : notification,
      );
      this.persist();
    },
    markUnread(ids: number[]) {
      const idSet = new Set(ids.map((id) => Number(id)));

      this.items = this.items.map((notification) =>
        idSet.has(Number(notification.id))
          ? { ...notification, readAt: null }
          : notification,
      );
      this.persist();
    },
    remove(id: number) {
      this.items = this.items.filter(
        (notification) => Number(notification.id) !== Number(id),
      );
      this.persist();
    },
    removeMany(ids: Array<number | string>) {
      const idSet = new Set(ids.map((id) => Number(id)));

      this.items = this.items.filter(
        (notification) => !idSet.has(Number(notification.id)),
      );
      this.persist();
    },
  },
});
