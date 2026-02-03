import { defineStore } from "pinia";
import { toRaw } from "vue";

import { db } from "../plugins/fake-api/handlers/apps/contact/db";
import { $api } from "@/utils/api";
import type {
  ContactAccounting,
  ContactConnection,
  ContactProperties,
} from "../plugins/fake-api/handlers/apps/contact/types";

import type { ContactRecord } from "../plugins/fake-api/handlers/apps/contact/types";

const STORAGE_KEY = "app.contacts.v2";
const API_BASE = import.meta.env.VITE_API_BASE_URL as string | undefined;
const SHOULD_FETCH_REMOTE = !!API_BASE && API_BASE.startsWith("http");

function cloneConnection(connection: ContactConnection): ContactConnection {
  const raw = toRaw(connection) as ContactConnection;

  if (typeof structuredClone === "function") {
    try {
      return structuredClone(raw);
    } catch (error) {
      console.warn("structuredClone failed while cloning connection:", error);
    }
  }

  try {
    return JSON.parse(JSON.stringify(raw)) as ContactConnection;
  } catch (error) {
    console.warn("JSON clone failed while cloning connection:", error);
    return { ...raw };
  }
}

function cloneAccounting(accounting: ContactAccounting): ContactAccounting {
  const raw = toRaw(accounting) as ContactAccounting;

  if (typeof structuredClone === "function") {
    try {
      return structuredClone(raw);
    } catch (error) {
      console.warn("structuredClone failed while cloning accounting:", error);
    }
  }

  try {
    return JSON.parse(JSON.stringify(raw)) as ContactAccounting;
  } catch (error) {
    console.warn("JSON clone failed while cloning accounting:", error);
    return { ...raw };
  }
}

function cloneContact(contact: ContactProperties): ContactProperties {
  const raw = toRaw(contact) as ContactProperties;

  if (typeof structuredClone === "function") {
    try {
      return structuredClone(raw);
    } catch (error) {
      console.warn("structuredClone failed while cloning contact:", error);
    }
  }

  try {
    return JSON.parse(JSON.stringify(raw)) as ContactProperties;
  } catch (error) {
    console.warn("JSON clone failed while cloning contact:", error);

    return {
      ...raw,
      connections: Array.isArray(raw.connections)
        ? raw.connections.map((connection) => ({ ...connection }))
        : [],
      accounting: raw.accounting ? { ...raw.accounting } : {},
      records: Array.isArray(raw.records)
        ? raw.records.map((r) => ({ ...r }))
        : [],
    };
  }
}

function cloneContactsArray(contacts: ContactProperties[]) {
  return contacts.map((contact) => cloneContact(contact));
}

function loadFromStorage(): ContactProperties[] | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as ContactProperties[];
  } catch (error) {
    console.warn("Failed to load contacts from storage:", error);
    return null;
  }
}

function saveToStorage(contacts: ContactProperties[]) {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts));
  } catch (error) {
    console.warn("Failed to save contacts to storage:", error);
  }
}

function ensureConnections(
  connections: ContactConnection[] | undefined | null
): ContactConnection[] {
  if (!Array.isArray(connections)) return [];
  return connections.map((connection) => cloneConnection(connection));
}

function ensureAccounting(
  accounting: ContactAccounting | undefined | null
): ContactAccounting {
  const base = accounting ? cloneAccounting(accounting) : {};
  return {
    taxId: base.taxId || undefined,
    crn: base.crn || undefined,
    vatNumber: base.vatNumber || undefined,
  };
}

function ensureRecords(
  records: ContactRecord[] | undefined | null
): ContactRecord[] {
  if (!Array.isArray(records)) return [];
  return records.map((r) => ({
    id: Number(r.id) || 0,
    type: r.type || "note",
    title: r.title || undefined,
    body: r.body || undefined,
    author: r.author || null,
    attachments: Array.isArray(r.attachments) ? [...r.attachments] : [],
    createdAt: r.createdAt || new Date().toISOString(),
  }));
}

function normaliseContact(
  payload: Partial<ContactProperties>,
  assignedId: number
): ContactProperties {
  const now = new Date().toISOString();

  return {
    id: assignedId,
    fullName: payload.fullName?.trim() || "Untitled Contact",
    class: payload.class ?? "Contact",
    type: payload.type ?? "Individual",
    category: payload.category ?? "General",
    email: payload.email?.trim() || "unknown@example.com",
    number: payload.number?.trim() || "",
    status: payload.status ?? "Active",
    picture: payload.picture || undefined,
    connections: ensureConnections(payload.connections),
    accounting: ensureAccounting(payload.accounting),
    records: ensureRecords(payload.records),
    address: payload.address || undefined,
    country: payload.country || undefined,
    city: payload.city || undefined,
    language: payload.language || undefined,
    channel: payload.channel ?? "Direct Sales",
    birthdate: payload.birthdate || undefined,
    worksInSales: payload.worksInSales ?? false,
    createdAt: payload.createdAt || now,
  };
}

function mergeContact(
  original: ContactProperties,
  patch: Partial<ContactProperties>
): ContactProperties {
  const merged = {
    ...original,
    ...patch,
    connections: ensureConnections(
      patch.connections ?? original.connections ?? []
    ),
    accounting: ensureAccounting({
      ...(original.accounting ?? {}),
      ...(patch.accounting ?? {}),
    }),
    records: ensureRecords(patch.records ?? original.records ?? []),
  };

  if (!merged.createdAt) merged.createdAt = original.createdAt;

  return cloneContact(merged);
}

function nextContactId(items: ContactProperties[]) {
  const numericIds = items
    .map((contact) => Number(contact.id))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (!numericIds.length) return 1;
  return Math.max(...numericIds) + 1;
}

const seedContacts = () => cloneContactsArray(db.users);

export const useContactsStore = defineStore("contacts", {
  state: () => ({
    items: [] as ContactProperties[],
    initialized: false,
  }),
  getters: {
    all: (state) => state.items,
    byId: (state) => (id: number | string) =>
      state.items.find((contact) => String(contact.id) === String(id)) ?? null,
    search:
      (state) =>
      (query: string): ContactProperties[] => {
        const q = query.trim().toLowerCase();
        if (!q) return state.items;
        return state.items.filter((contact) => {
          const haystacks = [
            contact.fullName,
            contact.email,
            contact.number,
            contact.city,
            contact.country,
            contact.channel,
            contact.status,
          ]
            .filter(Boolean)
            .map((value) => value!.toString().toLowerCase());
          return haystacks.some((value) => value.includes(q));
        });
      },
  },
  actions: {
    init(force = false) {
      if (this.initialized && !force) return;

      const stored = loadFromStorage();

      if (stored && stored.length) {
        this.items = cloneContactsArray(stored);
      } else {
        this.items = seedContacts();
        saveToStorage(this.items);
      }

      this.initialized = true;

      if (typeof window !== "undefined") {
        this.$subscribe(
          (_mutation, state) => {
            saveToStorage(cloneContactsArray(state.items));
          },
          { detached: true }
        );
      }

      if (SHOULD_FETCH_REMOTE) {
        this.fetchRemoteAll();
      }
    },

    async fetchRemoteAll() {
      try {
        const first = await $api("/apps/contacts", {
          query: { itemsPerPage: 50, page: 1 },
        });
        const users = Array.isArray(first?.users) ? [...first.users] : [];
        const totalPages = Number(first?.totalPages || 1);
        for (let page = 2; page <= totalPages; page++) {
          const res = await $api("/apps/contacts", {
            query: { itemsPerPage: 50, page },
          });
          if (Array.isArray(res?.users)) users.push(...res.users);
        }
        if (users.length) {
          this.items = cloneContactsArray(users);
          saveToStorage(this.items);
        }
      } catch (error) {
        console.warn("contacts fetchRemoteAll error", error);
      }
    },

    addContact(payload: Partial<ContactProperties>) {
      const incomingId =
        payload.id && Number(payload.id) > 0 ? Number(payload.id) : undefined;
      const id = incomingId ?? nextContactId(this.items);
      const normalised = normaliseContact(payload, id);
      this.items.unshift(normalised);

      if (SHOULD_FETCH_REMOTE) {
        void $api("/apps/contacts", {
          method: "POST",
          body: normalised,
        })
          .then((res: any) => {
            const created = res?.body ?? res;
            if (!created?.id) return;
            const idx = this.items.findIndex(
              (c) => String(c.id) === String(normalised.id)
            );
            if (idx !== -1) this.items.splice(idx, 1, created);
          })
          .catch((error) =>
            console.warn("contacts addContact remote error", error)
          );
      }
      return normalised;
    },

    updateContact(id: number | string, patch: Partial<ContactProperties>) {
      const index = this.items.findIndex(
        (contact) => String(contact.id) === String(id)
      );
      if (index === -1) return null;

      const updated = mergeContact(this.items[index], patch);
      this.items.splice(index, 1, updated);

      if (SHOULD_FETCH_REMOTE) {
        void $api(`/apps/contacts/${id}`, {
          method: "PUT",
          body: patch,
        })
          .then((res: any) => {
            const remote = res?.body ?? res;
            if (!remote?.id) return;
            const idx = this.items.findIndex(
              (c) => String(c.id) === String(remote.id)
            );
            if (idx !== -1) this.items.splice(idx, 1, remote);
          })
          .catch((error) =>
            console.warn("contacts updateContact remote error", error)
          );
      }
      return updated;
    },

    /**
     * Add a record to a contact's records array. New records are prepended.
     * Returns the updated contact or null if contact not found.
     */
    addRecord(contactId: number | string, record: ContactRecord) {
      const index = this.items.findIndex(
        (contact) => String(contact.id) === String(contactId)
      );
      if (index === -1) return null;

      const original = this.items[index];
      const existing = Array.isArray(original.records) ? original.records : [];
      const newRecords = [record, ...existing];

      const updated = mergeContact(original, { records: newRecords });
      this.items.splice(index, 1, updated);

      if (SHOULD_FETCH_REMOTE) {
        void $api(`/apps/contacts/${contactId}/records`, {
          method: "POST",
          body: record,
        }).catch((error) =>
          console.warn("contacts addRecord remote error", error)
        );
      }
      return updated;
    },

    /**
     * Update an existing record for a contact. Matches by record.id.
     */
    updateRecord(contactId: number | string, record: ContactRecord) {
      const index = this.items.findIndex(
        (contact) => String(contact.id) === String(contactId)
      );
      if (index === -1) return null;

      const original = this.items[index];
      const existing = Array.isArray(original.records) ? original.records : [];
      const updatedRecords = existing.map((r) =>
        String(r.id) === String(record.id) ? { ...r, ...record } : r
      );

      const updated = mergeContact(original, { records: updatedRecords });
      this.items.splice(index, 1, updated);

      if (SHOULD_FETCH_REMOTE) {
        void $api(`/apps/contacts/${contactId}/records/${record.id}`, {
          method: "PUT",
          body: record,
        }).catch((error) =>
          console.warn("contacts updateRecord remote error", error)
        );
      }
      return updated;
    },

    /**
     * Remove a record from a contact by id.
     */
    removeRecord(contactId: number | string, recordId: number | string) {
      const index = this.items.findIndex(
        (contact) => String(contact.id) === String(contactId)
      );
      if (index === -1) return null;

      const original = this.items[index];
      const existing = Array.isArray(original.records) ? original.records : [];
      const updatedRecords = existing.filter(
        (r) => String(r.id) !== String(recordId)
      );

      const updated = mergeContact(original, { records: updatedRecords });
      this.items.splice(index, 1, updated);

      if (SHOULD_FETCH_REMOTE) {
        void $api(`/apps/contacts/${contactId}/records/${recordId}`, {
          method: "DELETE",
        }).catch((error) =>
          console.warn("contacts removeRecord remote error", error)
        );
      }
      return updated;
    },

    removeContact(id: number | string) {
      const index = this.items.findIndex(
        (contact) => String(contact.id) === String(id)
      );
      if (index === -1) return;
      this.items.splice(index, 1);

      if (SHOULD_FETCH_REMOTE) {
        void $api(`/apps/contacts/${id}`, { method: "DELETE" }).catch((error) =>
          console.warn("contacts removeContact remote error", error)
        );
      }
    },

    nextId() {
      return nextContactId(this.items);
    },

    replaceAll(contacts: ContactProperties[]) {
      this.items = cloneContactsArray(contacts);
    },
  },
});
