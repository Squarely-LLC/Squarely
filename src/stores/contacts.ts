import type {
  ContactProperties,
  ContactRecord,
  ContactRole,
} from "@/plugins/fake-api/handlers/apps/contact/types";
import { personToContact, usePeopleStore } from "@/stores/people";
import { defineStore } from "pinia";

const cloneContact = (contact: ContactProperties): ContactProperties =>
  JSON.parse(JSON.stringify(contact)) as ContactProperties;

const cloneContactsArray = (contacts: ContactProperties[]) =>
  contacts.map((contact) => cloneContact(contact));

const refreshContacts = () => {
  const peopleStore = usePeopleStore();
  peopleStore.init();

  return cloneContactsArray(peopleStore.crmPeople.map(personToContact));
};

const ensureRoles = (
  roles: ContactRole[] | undefined | null,
  contactClass: ContactProperties["class"] | undefined,
) => {
  const next = new Set<ContactRole>();

  if (Array.isArray(roles)) {
    roles.forEach((role) => {
      if (role === "client" || role === "supplier") next.add(role);
    });
  }

  if (contactClass === "Client") next.add("client");
  if (contactClass === "Supplier") next.add("supplier");

  return Array.from(next);
};

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
    hasRole:
      (state) =>
      (id: number | string, role: ContactRole): boolean => {
        const contact =
          state.items.find((item) => String(item.id) === String(id)) ?? null;
        if (!contact) return false;

        return ensureRoles(contact.roles, contact.class).includes(role);
      },
  },
  actions: {
    init(force = false) {
      if (this.initialized && !force) return;

      const peopleStore = usePeopleStore();
      peopleStore.init();
      this.items = refreshContacts();
      this.initialized = true;

      if (!(this as any)._peopleUnsubscribe) {
        (this as any)._peopleUnsubscribe = peopleStore.$subscribe(
          () => {
            this.items = refreshContacts();
          },
          { detached: true },
        );
      }
    },

    refresh() {
      this.items = refreshContacts();
    },

    addContact(payload: Partial<ContactProperties>) {
      const peopleStore = usePeopleStore();
      peopleStore.init();
      const incomingId =
        payload.id && Number(payload.id) > 0 ? Number(payload.id) : undefined;
      const id = incomingId ?? peopleStore.nextId();
      const created = peopleStore.upsertContact({ ...payload, id });
      this.refresh();

      return created;
    },

    updateContact(id: number | string, patch: Partial<ContactProperties>) {
      const peopleStore = usePeopleStore();
      peopleStore.init();
      const updated = peopleStore.patchContact(id, patch);
      this.refresh();

      return updated;
    },

    addRecord(contactId: number | string, record: ContactRecord) {
      const contact = this.byId(contactId);
      if (!contact) return null;

      const records = [record, ...(contact.records ?? [])];

      return this.updateContact(contactId, { records });
    },

    updateRecord(contactId: number | string, record: ContactRecord) {
      const contact = this.byId(contactId);
      if (!contact) return null;

      const records = (contact.records ?? []).map((entry) =>
        String(entry.id) === String(record.id)
          ? { ...entry, ...record }
          : entry,
      );

      return this.updateContact(contactId, { records });
    },

    removeRecord(contactId: number | string, recordId: number | string) {
      const contact = this.byId(contactId);
      if (!contact) return null;

      const records = (contact.records ?? []).filter(
        (entry) => String(entry.id) !== String(recordId),
      );

      return this.updateContact(contactId, { records });
    },

    removeContact(id: number | string) {
      const peopleStore = usePeopleStore();
      peopleStore.init();
      peopleStore.removeContactProfile(id);
      this.refresh();
    },

    nextId() {
      const peopleStore = usePeopleStore();
      peopleStore.init();

      return peopleStore.nextId();
    },

    replaceAll(contacts: ContactProperties[]) {
      const peopleStore = usePeopleStore();
      peopleStore.init();
      peopleStore.replaceContacts(cloneContactsArray(contacts));
      this.refresh();
    },
  },
});
