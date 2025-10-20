<script setup lang="ts">
import type {
  ContactConnection,
  ContactProperties,
} from "@/plugins/fake-api/handlers/apps/contact/types";
import { useContactsStore } from "@/stores/contacts";
import { useNotificationsStore } from "@/stores/notifications";
import { useTodos } from "@/stores/todos";
import { computed, nextTick, ref } from "vue";
import { RouterLink, useRouter } from "vue-router";

import ContactEditDialog from "@/views/apps/contact/list/ContactEditDialog.vue";
import EmailDialog from "@/views/apps/email/EmailDialog.vue";
import AddMeetingDrawer from "@/views/apps/todo/list/AddMeetingDrawer.vue";
import AddNewToDoDrawer from "@/views/apps/todo/list/AddNewToDoDrawer.vue";

interface Props {
  userData: ContactProperties;
}

const props = defineProps<Props>();

const isContactEditDialogVisible = ref(false);

const classVariant = (contactClass: ContactProperties["class"]) => {
  switch (contactClass) {
    case "Lead":
      return { color: "warning", icon: "tabler-target" };
    case "Client":
      return { color: "primary", icon: "tabler-briefcase" };
    case "Supplier":
      return { color: "info", icon: "tabler-truck" };
    case "Contact":
      return { color: "success", icon: "tabler-user" };
    case "Owner":
      return { color: "secondary", icon: "tabler-building" };
    default:
      return { color: "primary", icon: "tabler-user" };
  }
};

const statusColor = (status: ContactProperties["status"]) => {
  switch (status) {
    case "Active":
      return "success";
    case "Dormant":
      return "secondary";
    case "Potential":
      return "info";
    case "Lost":
      return "error";
    default:
      return "primary";
  }
};

const channelColor = (channel: ContactProperties["channel"]) => {
  switch (channel) {
    case "Direct Sales":
      return "primary";
    case "Referral":
      return "success";
    case "Social Media":
      return "info";
    case "Website":
      return "secondary";
    case "Email Campaigns":
      return "warning";
    default:
      return "primary";
  }
};

const avatarText = (name?: string | null) => {
  const safeName = (name ?? "").trim();
  if (!safeName) return "??";

  const initials = safeName
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return initials || safeName.slice(0, 2).toUpperCase();
};

const connectionList = computed(() => props.userData.connections ?? []);

// local override so UI updates instantly when adding a connection
const localConnections = ref<ContactConnection[] | null>(null);

const resolvedConnectionList = computed(() => {
  const source = localConnections.value ?? connectionList.value;
  return source.map((c) => {
    const linked = contactsStore.byId(c.contactId);
    return {
      ...c,
      picture: c.picture ?? linked?.picture,
      contactName: c.contactName ?? linked?.fullName,
    };
  });
});

const primaryConnections = computed(() =>
  resolvedConnectionList.value.filter((connection) => connection.isPrimary)
);
const secondaryConnections = computed(() =>
  resolvedConnectionList.value.filter((connection) => !connection.isPrimary)
);

const contactsStore = useContactsStore();

const contactsOptions = computed(() =>
  contactsStore.all.map((c) => ({
    id: c.id,
    name: c.fullName,
    avatarUrl: c.picture,
  }))
);

// Menu actions for connections (kept minimal — expand as needed)
const moreList = [
  { title: "Add Connection", value: "Add Connection" },
  { title: "Manage", value: "Manage" },
];

const isAddConnectionDialogVisible = ref(false);

// tooltip label for accessibility / localization fallback
const addConnectionTooltip = (() => {
  try {
    // try to use the global i18n if present
    // @ts-ignore
    const { t } = useI18n ? useI18n() : { t: undefined };
    // if t exists use it; otherwise fallback
    // @ts-ignore
    return (t && t("Add Connection")) || "Add connection";
  } catch (e) {
    return "Add connection";
  }
})();

const handleMoreAction = (val: string) => {
  switch (val) {
    case "Add Connection":
      isAddConnectionDialogVisible.value = true;
      break;
    case "Manage":
      console.log("Manage connections for", props.userData.fullName);
      break;
    default:
      console.log("Unhandled action:", val);
  }
};

const makePrimary = (contactId: number) => {
  // choose the source array (local override if present) so UI updates instantly
  const source = localConnections.value ?? connectionList.value;
  const updated = source.map((c) => ({
    ...c,
    isPrimary: c.contactId === contactId,
  }));

  // update local override so UI reflects the change immediately
  localConnections.value = [...updated];

  // Persist the change via the contacts store so parent views update
  try {
    contactsStore.updateContact(props.userData.id, { connections: updated });
  } catch (err) {
    console.error("Failed to set primary connection:", err);
  }
  // highlight the promoted contact briefly
  highlightedContactId.value = contactId;
  setTimeout(() => (highlightedContactId.value = null), 2200);
};

// snackbar state for feedback
const showSnackbar = ref(false);
const snackbarMessage = ref("");
// highlighted contact id for temporary visual highlight
const highlightedContactId = ref<number | null>(null);

// delete confirmation dialog state for connections (existing)
const confirmDeleteDialogVisible = ref(false);
const deleteCandidateId = ref<number | null>(null);

const askDeleteConnection = (contactId: number) => {
  deleteCandidateId.value = contactId;
  confirmDeleteDialogVisible.value = true;
};

const performDeleteConnection = () => {
  const id = deleteCandidateId.value;
  if (id === null) return;

  // remove from local override first for instant UI feedback
  const source = localConnections.value ?? connectionList.value ?? [];
  const updated = source.filter((c) => c.contactId !== id);
  localConnections.value = [...updated];

  // persist via store
  try {
    contactsStore.updateContact(props.userData.id, { connections: updated });
  } catch (err) {
    console.error("Failed to delete connection:", err);
    snackbarMessage.value = "Failed to remove connection";
    showSnackbar.value = true;
    confirmDeleteDialogVisible.value = false;
    deleteCandidateId.value = null;
    return;
  }

  snackbarMessage.value = "Connection removed";
  showSnackbar.value = true;
  confirmDeleteDialogVisible.value = false;
  deleteCandidateId.value = null;
};

// --- Contact delete (mirror list page logic) ---
const notifications = useNotificationsStore();
const todosStore = useTodos();
const router = useRouter();

const confirmDeleteContactVisible = ref(false);
const deleteContactCandidateId = ref<number | null>(null);
const deleteContactBlockingReasons = ref<string[]>([]);

const findDeleteBlockingReasonsForContact = (id: number): string[] => {
  const reasons: string[] = [];
  try {
    try {
      todosStore.init();
    } catch (e) {
      /* ignore */
    }

    // top-level todos where contact is collaborator
    const referencingTodos = (todosStore.items || []).filter(
      (t: any) =>
        Array.isArray(t.collaborators) &&
        t.collaborators.some((c: any) => Number(c.id) === Number(id))
    );
    if (referencingTodos.length) {
      reasons.push(
        `Referenced as a collaborator in ${referencingTodos.length} todo(s)`
      );
    }

    const stepRefs = (todosStore.items || [])
      .flatMap((t: any) => t.steps || [])
      .filter(
        (s: any) =>
          Array.isArray(s.collaborators) &&
          s.collaborators.some((c: any) => Number(c.id) === Number(id))
      );
    if (stepRefs.length) {
      reasons.push(
        `Referenced as a collaborator in ${stepRefs.length} todo step(s)`
      );
    }

    const activityRefs = (todosStore.items || [])
      .flatMap((t: any) => t.activities || [])
      .filter((a: any) => a && a.author && Number(a.author.id) === Number(id));
    if (activityRefs.length) {
      reasons.push(`Author on ${activityRefs.length} activity item(s)`);
    }

    const messageRefs = (todosStore.items || [])
      .flatMap((t: any) => t.messages || [])
      .filter(
        (m: any) => m && m.author && Number((m.author as any).id) === Number(id)
      );
    if (messageRefs.length) {
      reasons.push(`Author on ${messageRefs.length} message(s)`);
    }

    const referencingMeetings = (todosStore.meetings || []).filter((m: any) => {
      if (m.requestedBy && Number(m.requestedBy.id) === Number(id)) return true;
      if (
        Array.isArray(m.linkedTo) &&
        m.linkedTo.some((l: any) => Number(l.id) === Number(id))
      )
        return true;
      if (
        Array.isArray(m.notes) &&
        m.notes.some(
          (n: any) => n && n.author && Number(n.author.id) === Number(id)
        )
      )
        return true;
      return false;
    });
    if (referencingMeetings.length) {
      reasons.push(`Referenced in ${referencingMeetings.length} meeting(s)`);
    }

    // connections in other contacts
    const referencedInConnections = contactsStore.all.filter(
      (c: any) =>
        Array.isArray(c.connections) &&
        c.connections.some((conn: any) => Number(conn.contactId) === Number(id))
    );
    if (referencedInConnections.length) {
      reasons.push(
        `Connected to ${referencedInConnections.length} other contact(s)`
      );
    }
  } catch (e) {
    reasons.push(
      "Unable to guarantee safe deletion due to internal check failure"
    );
  }

  return reasons;
};

const confirmDeleteContact = () => {
  const id = Number(props.userData.id);
  deleteContactCandidateId.value = id;
  deleteContactBlockingReasons.value = findDeleteBlockingReasonsForContact(id);
  confirmDeleteContactVisible.value = true;
};

const performDeleteContact = () => {
  const id = deleteContactCandidateId.value;
  if (id === null) return;

  const reasons = findDeleteBlockingReasonsForContact(id);
  if (reasons.length) {
    deleteContactBlockingReasons.value = reasons;
    // keep dialog open and prevent deletion
    return;
  }

  try {
    contactsStore.removeContact(id);
  } catch (e) {
    console.error("Failed to delete contact:", e);
  }

  notifications.push("Contact deleted", "success", 3500);
  // redirect back to contact list after successful delete
  try {
    router.push({ name: "apps-contact-list" });
  } catch (e) {
    /* ignore */
  }
  deleteContactCandidateId.value = null;
  deleteContactBlockingReasons.value = [];
  confirmDeleteContactVisible.value = false;
};

const cleanupAndDeleteContact = () => {
  const id = deleteContactCandidateId.value;
  if (id === null) return;

  try {
    try {
      todosStore.init();
    } catch (e) {
      /* ignore */
    }

    // Remove from top-level collaborators
    todosStore.items = (todosStore.items || []).map((t: any) => {
      const collaborators = (t.collaborators || []).filter(
        (c: any) => Number(c.id) !== Number(id)
      );
      const steps = (t.steps || []).map((s: any) => ({
        ...s,
        collaborators: (s.collaborators || []).filter(
          (c: any) => Number(c.id) !== Number(id)
        ),
      }));
      const activities = (t.activities || []).filter(
        (a: any) => !(a && a.author && Number(a.author.id) === Number(id))
      );
      const messages = (t.messages || []).filter(
        (m: any) =>
          !(
            m &&
            (m.author as any) &&
            Number((m.author as any).id) === Number(id)
          )
      );
      return { ...t, collaborators, steps, activities, messages };
    });

    // Meetings: remove linkedTo and requestedBy and notes authored by contact
    todosStore.meetings = (todosStore.meetings || []).map((m: any) => {
      const requestedBy =
        m.requestedBy && Number(m.requestedBy.id) === Number(id)
          ? null
          : m.requestedBy;
      const linkedTo = (m.linkedTo || []).filter(
        (l: any) => Number(l.id) !== Number(id)
      );
      const notes = (m.notes || []).filter(
        (n: any) => !(n && n.author && Number(n.author.id) === Number(id))
      );
      return { ...m, requestedBy, linkedTo, notes };
    });

    // Remove connections pointing to this contact
    contactsStore.items = contactsStore.items.map((c: any) => {
      const connections = (c.connections || []).filter(
        (conn: any) => Number(conn.contactId) !== Number(id)
      );
      return { ...c, connections };
    });

    // Finally delete the contact
    contactsStore.removeContact(id);
    notifications.push(
      "References removed and contact deleted",
      "success",
      3500
    );
    // redirect back to contact list after cleanup+delete
    try {
      router.push({ name: "apps-contact-list" });
    } catch (e) {
      /* ignore */
    }
  } catch (e) {
    console.error("cleanupAndDeleteContact failed:", e);
  }

  deleteContactCandidateId.value = null;
  deleteContactBlockingReasons.value = [];
  confirmDeleteContactVisible.value = false;
};

// handler for AddConnectionDialog emitted payload
const onAddConnection = (payload: {
  contactId: number | string;
  relation?: string;
}) => {
  const contactIdNum = Number(payload.contactId);
  const newConn: ContactConnection = {
    contactId: contactIdNum,
    contactName: contactsStore.byId(contactIdNum)?.fullName || "",
    isPrimary: false,
    relation: payload.relation || "",
  };

  // update localConnections so UI updates instantly
  localConnections.value = [
    ...(localConnections.value ?? connectionList.value),
    newConn,
  ];

  // persist via store
  try {
    const updated = [...(connectionList.value ?? []), newConn];
    contactsStore.updateContact(props.userData.id, { connections: updated });
  } catch (err) {
    console.error("Failed to persist new connection:", err);
    snackbarMessage.value = "Failed to add connection";
    showSnackbar.value = true;
    return;
  }

  snackbarMessage.value = `${
    newConn.contactName || "Contact"
  } added to connections`;
  showSnackbar.value = true;
};

// Edit relation dialog state and handlers (missing definitions were causing template errors)
const editRelationDialogVisible = ref(false);
const editCandidateId = ref<number | null>(null);
const editRelation = ref("");

const openEditRelation = (contactId: number) => {
  const source = localConnections.value ?? connectionList.value ?? [];
  const existing = source.find((c) => c.contactId === contactId);
  editCandidateId.value = contactId;
  editRelation.value = existing?.relation ?? "";
  editRelationDialogVisible.value = true;
};

const closeEditRelation = () => {
  editRelationDialogVisible.value = false;
  editCandidateId.value = null;
};

const saveEditRelation = () => {
  const id = editCandidateId.value;
  if (id === null) return;

  const source = localConnections.value ?? connectionList.value ?? [];
  const updated = source.map((c) =>
    c.contactId === id ? { ...c, relation: editRelation.value } : c
  );

  localConnections.value = [...updated];

  try {
    contactsStore.updateContact(props.userData.id, { connections: updated });
  } catch (err) {
    console.error("Failed to update connection relation:", err);
    snackbarMessage.value = "Failed to update relation";
    showSnackbar.value = true;
    editRelationDialogVisible.value = false;
    editCandidateId.value = null;
    return;
  }

  snackbarMessage.value = "Relation updated";
  showSnackbar.value = true;
  editRelationDialogVisible.value = false;
  editCandidateId.value = null;
};

const editCandidate = computed(() =>
  editCandidateId.value == null
    ? null
    : contactsStore.byId(editCandidateId.value)
);

// Drawer for creating a todo prefilled from a connection
const isAddTodoDrawerVisible = ref(false);
const addTodoDrawerRef = ref<any | null>(null);

// AddMeeting drawer state
const isAddMeetingOpen = ref(false);
const addMeetingRef = ref<any | null>(null);

function openAddMeetingForContact(conn: any) {
  try {
    const initial = {
      title: `Meeting: ${conn.contactName ?? ""}`,
      initialStart: new Date(),
      contacts: contactsOptions.value,
      // prefill a contextual note referencing the current contact page name
      notes: `schedule from contact : ${props.userData.fullName ?? ""}`,
      // preselect the linked contact
      linkedTo: [
        {
          id: conn.contactId,
          name: conn.contactName ?? "",
          avatarUrl: conn.picture ?? null,
        },
      ],
    } as any;

    if (addMeetingRef.value?.openWith) {
      addMeetingRef.value.openWith(initial);
    } else {
      isAddMeetingOpen.value = true;
      nextTick(() => {
        try {
          addMeetingRef.value?.openWith?.(initial);
        } catch (e) {
          /* ignore */
        }
      });
    }
  } catch (e) {
    console.error("Failed to open meeting drawer:", e);
  }
}

function onMeetingCreated(payload: any) {
  try {
    // add to todos store
    try {
      todosStore.addMeeting && todosStore.addMeeting(payload);
    } catch (err) {
      // fallback: push directly into todos store meetings array
      if (Array.isArray((todosStore as any).meetings)) {
        (todosStore as any).meetings = [
          ...(todosStore as any).meetings,
          payload,
        ];
      }
    }

    notifications.push("Meeting created", "success", 3500);
  } catch (e) {
    console.error("onMeetingCreated failed:", e);
    notifications.push("Meeting created", "success", 3500);
  } finally {
    isAddMeetingOpen.value = false;
  }
}

function openAddTodoDrawerForContact(conn: any) {
  try {
    const initial = {
      title: `Follow up: ${conn.contactName ?? ""}`,
      collaborators: [
        {
          id: conn.contactId,
          name: conn.contactName ?? "",
          avatarUrl: conn.picture ?? null,
        },
      ],
    };

    // If the component exposes openWith, use it; otherwise set visible and rely on prop handling
    if (addTodoDrawerRef.value?.openWith) {
      addTodoDrawerRef.value.openWith(initial);
    } else {
      // fallback: set initial via prop and open
      isAddTodoDrawerVisible.value = true;
      nextTick(() => {
        try {
          addTodoDrawerRef.value?.openWith?.(initial);
        } catch (e) {
          /* ignore */
        }
      });
    }
  } catch (e) {
    console.error("Failed to open todo drawer:", e);
  }
}

// Compose email drawer
const isComposeDialogVisible = ref(false);
const composeDialogRef = ref<any | null>(null);

function openComposeForContact(conn: any) {
  try {
    // Prefer canonical contact record email when available
    const linked = contactsStore.byId?.(conn.contactId as number | string);
    const toAddress =
      linked?.email ||
      conn.email ||
      (conn.contactName && conn.contactName.includes("@")
        ? conn.contactName
        : "");

    const initial = {
      to: toAddress || "",
      subject: `Hello ${conn.contactName ?? ""}`,
      message: `Hi ${conn.contactName ?? ""},\n\n`,
    };

    isComposeDialogVisible.value = true;
    nextTick(() => {
      try {
        composeDialogRef.value?.openWith?.(initial);
      } catch (e) {
        /* ignore */
      }
    });
  } catch (e) {
    console.error("Failed to open compose dialog:", e);
  }
}

function onEmailSend(payload: any) {
  try {
    const recipients = Array.isArray(payload?.to)
      ? payload.to.filter(Boolean)
      : payload?.to
      ? [String(payload.to)]
      : [];
    const subject = String(payload?.subject || "(no subject)");
    const count = recipients.length;
    notifications.push(
      `Email sent${
        count ? ` to ${count} recipient${count > 1 ? "s" : ""}` : ""
      }: ${subject}`,
      "success",
      3500
    );
  } catch (e) {
    try {
      notifications.push("Email sent", "success", 3500);
    } catch {}
  } finally {
    isComposeDialogVisible.value = false;
  }
}

// Handler when ContactEditDialog inside profile saves
function onContactEditSubmit(payload: ContactProperties) {
  try {
    contactsStore.updateContact(payload.id, payload);
    notifications.push(`${payload.fullName} updated`, "success", 3000);
  } catch (e) {
    console.error("Failed to update contact from profile edit:", e);
    notifications.push("Failed to update contact", "error", 3000);
  } finally {
    isContactEditDialogVisible.value = false;
  }
}
</script>

<template>
  <VRow>
    <VCol cols="12">
      <VCard>
        <VCardText class="text-center pt-12">
          <VAvatar
            rounded
            :size="100"
            :color="
              !props.userData.picture
                ? classVariant(props.userData.class).color
                : undefined
            "
            :variant="!props.userData.picture ? 'tonal' : undefined"
          >
            <VImg v-if="props.userData.picture" :src="props.userData.picture" />
            <span v-else class="text-5xl font-weight-medium">
              {{ avatarText(props.userData.fullName) }}
            </span>
          </VAvatar>

          <h5 class="text-h5 mt-4">
            {{ props.userData.fullName }}
          </h5>

          <div class="d-flex justify-center gap-2 mt-2">
            <VChip
              label
              size="small"
              class="text-capitalize"
              :color="classVariant(props.userData.class).color"
              variant="tonal"
            >
              {{ props.userData.class }}
            </VChip>

            <VChip
              label
              size="small"
              class="text-capitalize"
              :color="statusColor(props.userData.status)"
              variant="tonal"
            >
              {{ props.userData.status }}
            </VChip>

            <VChip
              label
              size="small"
              class="text-capitalize"
              color="secondary"
              variant="tonal"
            >
              {{ props.userData.type }}
            </VChip>
          </div>
        </VCardText>

        <VCardText>
          <h5 class="text-h5">Details</h5>

          <VDivider class="my-4" />
          <VList class="py-0 card-list details-list">
            <VListItem>
              <VListItemTitle>
                <h6 class="text-h6">
                  Email:
                  <div class="d-inline-block text-body-1">
                    {{ props.userData.email }}
                  </div>
                </h6>
              </VListItemTitle>
            </VListItem>

            <VListItem v-if="props.userData.accounting?.taxId">
              <VListItemTitle>
                <h6 class="text-h6">
                  Tax ID:
                  <div class="d-inline-block text-body-1">
                    {{ props.userData.accounting.taxId }}
                  </div>
                </h6>
              </VListItemTitle>
            </VListItem>

            <VListItem>
              <VListItemTitle>
                <h6 class="text-h6">
                  Contact:
                  <div class="d-inline-block text-body-1">
                    <a :href="`tel:${props.userData.number}`">{{
                      props.userData.number
                    }}</a>
                  </div>
                </h6>
              </VListItemTitle>
            </VListItem>

            <VListItem v-if="props.userData.language">
              <VListItemTitle>
                <h6 class="text-h6">
                  Language:
                  <div class="d-inline-block text-body-1">
                    {{ props.userData.language }}
                  </div>
                </h6>
              </VListItemTitle>
            </VListItem>

            <VListItem v-if="props.userData.website">
              <VListItemTitle>
                <h6 class="text-h6">
                  Website:
                  <div class="d-inline-block text-body-1">
                    <a
                      :href="props.userData.website || ''"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {{ props.userData.website }}
                    </a>
                  </div>
                </h6>
              </VListItemTitle>
            </VListItem>

            <VListItem v-if="props.userData.country">
              <VListItemTitle>
                <h6 class="text-h6">
                  Country:
                  <div class="d-inline-block text-body-1">
                    {{ props.userData.country }}
                  </div>
                </h6>
              </VListItemTitle>
            </VListItem>

            <VListItem v-if="props.userData.city">
              <VListItemTitle>
                <h6 class="text-h6">
                  City:
                  <div class="d-inline-block text-body-1">
                    {{ props.userData.city }}
                  </div>
                </h6>
              </VListItemTitle>
            </VListItem>

            <VListItem v-if="props.userData.address">
              <VListItemTitle>
                <h6 class="text-h6">
                  Address:
                  <div class="d-inline-block text-body-1">
                    {{ props.userData.address }}
                  </div>
                </h6>
              </VListItemTitle>
            </VListItem>

            <VListItem v-if="props.userData.accounting?.crn">
              <VListItemTitle>
                <h6 class="text-h6">
                  CRN:
                  <div class="d-inline-block text-body-1">
                    {{ props.userData.accounting.crn }}
                  </div>
                </h6>
              </VListItemTitle>
            </VListItem>

            <VListItem v-if="props.userData.accounting?.vatNumber">
              <VListItemTitle>
                <h6 class="text-h6">
                  VAT Number:
                  <div class="d-inline-block text-body-1">
                    {{ props.userData.accounting.vatNumber }}
                  </div>
                </h6>
              </VListItemTitle>
            </VListItem>

            <VListItem v-if="props.userData.worksInSales">
              <VListItemTitle>
                <h6 class="text-h6">
                  Works in sales:
                  <div class="d-inline-block text-body-1">
                    {{ props.userData.worksInSales ? "Yes" : "No" }}
                  </div>
                </h6>
              </VListItemTitle>
            </VListItem>
          </VList>
        </VCardText>

        <VCardText class="d-flex justify-center gap-4">
          <VBtn @click="isContactEditDialogVisible = true">Edit</VBtn>
          <VBtn variant="tonal" color="error" @click="confirmDeleteContact"
            >Delete</VBtn
          >
        </VCardText>
      </VCard>
    </VCol>

    <VCol cols="12">
      <VCard title="Connections">
        <template #append>
          <div>
            <!-- Single Add Connection button replaces the settings menu -->
            <VBtn
              icon
              variant="text"
              @click="isAddConnectionDialogVisible = true"
            >
              <VIcon icon="tabler-user-plus" color="secondary" />
              <VTooltip activator="parent" location="top">{{
                addConnectionTooltip
              }}</VTooltip>
            </VBtn>
          </div>
        </template>

        <VCardText>
          <VList class="card-list">
            <template v-if="!resolvedConnectionList.length">
              <VListItem>
                <VListItemTitle class="text-center w-100 text-medium-emphasis">
                  No connections yet.
                </VListItemTitle>
              </VListItem>
            </template>
            <template v-else>
              <!-- Primary connections first -->
              <template v-if="primaryConnections.length">
                <VListItem
                  v-for="conn in primaryConnections"
                  :key="`primary-` + conn.contactId"
                  :class="{
                    'connection-highlight':
                      highlightedContactId === conn.contactId,
                  }"
                >
                  <template #prepend>
                    <RouterLink
                      :to="{
                        name: 'apps-contact-view-id',
                        params: { id: conn.contactId },
                      }"
                      class="avatar-link"
                    >
                      <VAvatar
                        class="me-3"
                        size="38"
                        :color="!conn.picture ? 'primary' : undefined"
                        :variant="!conn.picture ? 'tonal' : undefined"
                      >
                        <VImg v-if="conn.picture" :src="conn.picture" />
                        <span v-else class="text-sm font-weight-medium">{{
                          avatarText(conn.contactName)
                        }}</span>
                      </VAvatar>
                    </RouterLink>
                  </template>

                  <VListItemTitle
                    class="font-weight-medium d-flex align-center"
                  >
                    <span>{{ conn.contactName }}</span>
                    <VChip
                      v-if="conn.isPrimary"
                      size="small"
                      label
                      color="primary"
                      variant="tonal"
                      >Primary</VChip
                    >
                  </VListItemTitle>
                  <VListItemSubtitle>{{ conn.relation }}</VListItemSubtitle>

                  <template #append>
                    <div class="d-flex align-center">
                      <VBtn icon variant="text" color="medium-emphasis">
                        <VIcon icon="tabler-dots-vertical" />
                        <VMenu activator="parent">
                          <VList>
                            <VListItem
                              v-if="!conn.isPrimary"
                              @click="makePrimary(conn.contactId)"
                            >
                              <template #prepend>
                                <VIcon icon="tabler-pentagon-number-1" />
                              </template>
                              <VListItemTitle>Make Primary</VListItemTitle>
                            </VListItem>

                            <VListItem
                              @click="openEditRelation(conn.contactId)"
                              link
                            >
                              <template #prepend>
                                <VIcon icon="tabler-edit" />
                              </template>
                              <VListItemTitle>Edit</VListItemTitle>
                            </VListItem>

                            <VListItem
                              @click="askDeleteConnection(conn.contactId)"
                            >
                              <template #prepend>
                                <VIcon color="error" icon="tabler-trash" />
                              </template>
                              <VListItemTitle>Delete</VListItemTitle>
                            </VListItem>
                          </VList>
                        </VMenu>
                      </VBtn>

                      <VBtn icon variant="text" color="medium-emphasis">
                        <VIcon icon="tabler-send-2" />
                        <VMenu activator="parent">
                          <VList>
                            <VListItem
                              link
                              @click.prevent="openAddTodoDrawerForContact(conn)"
                            >
                              <template #prepend>
                                <VIcon icon="tabler-notes" />
                              </template>
                              <VListItemTitle>To Do</VListItemTitle>
                            </VListItem>

                            <VListItem
                              @click.prevent="openAddMeetingForContact(conn)"
                            >
                              <template #prepend>
                                <VIcon icon="tabler-calendar-plus" />
                              </template>
                              <VListItemTitle>Meeting</VListItemTitle>
                            </VListItem>

                            <VListItem
                              @click.prevent="openComposeForContact(conn)"
                            >
                              <template #prepend>
                                <VIcon icon="tabler-mail" />
                              </template>
                              <VListItemTitle>Email</VListItemTitle>
                            </VListItem>

                            <VListItem>
                              <template #prepend>
                                <VIcon icon="tabler-phone" />
                              </template>
                              <VListItemTitle>Call</VListItemTitle>
                            </VListItem>
                          </VList>
                        </VMenu>
                      </VBtn>
                    </div>
                  </template>
                </VListItem>
              </template>

              <VDivider
                class="mb-5"
                v-if="primaryConnections.length && secondaryConnections.length"
              />

              <!-- Secondary connections -->
              <template
                v-for="conn in secondaryConnections"
                :key="conn.contactId"
              >
                <VListItem
                  :class="{
                    'connection-highlight':
                      highlightedContactId === conn.contactId,
                  }"
                >
                  <template #prepend>
                    <RouterLink
                      :to="{
                        name: 'apps-contact-view-id',
                        params: { id: conn.contactId },
                      }"
                      class="avatar-link"
                    >
                      <VAvatar
                        class="me-3"
                        size="38"
                        :color="!conn.picture ? 'primary' : undefined"
                        :variant="!conn.picture ? 'tonal' : undefined"
                      >
                        <VImg v-if="conn.picture" :src="conn.picture" />
                        <span v-else class="text-sm font-weight-medium">{{
                          avatarText(conn.contactName)
                        }}</span>
                      </VAvatar>
                    </RouterLink>
                  </template>

                  <VListItemTitle class="font-weight-medium">
                    {{ conn.contactName }}
                  </VListItemTitle>
                  <VListItemSubtitle>{{ conn.relation }}</VListItemSubtitle>

                  <template #append>
                    <div class="d-flex align-center">
                      <VBtn icon variant="text" color="medium-emphasis">
                        <VIcon icon="tabler-dots-vertical" />
                        <VMenu activator="parent">
                          <VList>
                            <VListItem
                              v-if="!conn.isPrimary"
                              @click="makePrimary(conn.contactId)"
                            >
                              <template #prepend>
                                <VIcon icon="tabler-pentagon-number-1" />
                              </template>
                              <VListItemTitle>Make Primary</VListItemTitle>
                            </VListItem>

                            <VDivider></VDivider>

                            <VListItem
                              @click="openEditRelation(conn.contactId)"
                              link
                            >
                              <template #prepend>
                                <VIcon icon="tabler-edit" />
                              </template>
                              <VListItemTitle>Edit</VListItemTitle>
                            </VListItem>

                            <VListItem
                              @click="askDeleteConnection(conn.contactId)"
                              link
                            >
                              <template #prepend>
                                <VIcon color="error" icon="tabler-trash" />
                              </template>
                              <VListItemTitle>Delete</VListItemTitle>
                            </VListItem>
                          </VList>
                        </VMenu>
                      </VBtn>
                    </div>
                    <VBtn icon variant="text" color="medium-emphasis">
                      <VIcon icon="tabler-send-2" />
                      <VMenu activator="parent">
                        <VList>
                          <VListItem
                            link
                            @click.prevent="openAddTodoDrawerForContact(conn)"
                          >
                            <template #prepend>
                              <VIcon icon="tabler-notes" />
                            </template>
                            <VListItemTitle>To Do</VListItemTitle>
                          </VListItem>

                          <VListItem
                            @click.prevent="openAddMeetingForContact(conn)"
                          >
                            <template #prepend>
                              <VIcon icon="tabler-calendar-plus" />
                            </template>
                            <VListItemTitle>Meeting</VListItemTitle>
                          </VListItem>

                          <VListItem
                            @click.prevent="openComposeForContact(conn)"
                          >
                            <template #prepend>
                              <VIcon icon="tabler-mail" />
                            </template>
                            <VListItemTitle>Email</VListItemTitle>
                          </VListItem>

                          <VListItem>
                            <template #prepend>
                              <VIcon icon="tabler-phone" />
                            </template>
                            <VListItemTitle>Call</VListItemTitle>
                          </VListItem>
                        </VList>
                      </VMenu>
                    </VBtn>
                  </template>
                </VListItem>
              </template>
            </template>
            <VListItem>
              <VListItemTitle class="pt-2 text-center">
                <!-- Keep as-is / link removed in your snippet -->
              </VListItemTitle>
            </VListItem>
          </VList>
        </VCardText>
      </VCard>
    </VCol>
  </VRow>

  <ContactEditDialog
    v-model:is-dialog-visible="isContactEditDialogVisible"
    :contact="props.userData"
    @submit="onContactEditSubmit"
  />
  <AddConnectionDialog
    v-model:is-dialog-visible="isAddConnectionDialogVisible"
    :current-contact-id="props.userData.id"
    :existing-connections="connectionList.map((c) => c.contactId)"
    @add-connection="onAddConnection"
  />
  <!-- Add ToDo Drawer (open prefilled when creating from a connection) -->
  <AddNewToDoDrawer
    ref="addTodoDrawerRef"
    v-model:is-drawer-open="isAddTodoDrawerVisible"
    :collaborators-options="[]"
  />
  <AddMeetingDrawer
    ref="addMeetingRef"
    v-model="isAddMeetingOpen"
    :contacts="contactsOptions"
    @save="onMeetingCreated"
  />
  <EmailDialog
    ref="composeDialogRef"
    v-model:is-dialog-visible="isComposeDialogVisible"
    @send="onEmailSend"
  />
  <VDialog v-model="confirmDeleteDialogVisible" persistent max-width="400">
    <VCard class="pa-sm-8 pa-4">
      <VCardText> Are you sure you want to remove this connection? </VCardText>
      <VCardActions>
        <VBtn
          variant="text"
          @click="
            () => {
              confirmDeleteDialogVisible = false;
              deleteCandidateId = null;
            }
          "
          >Cancel</VBtn
        >
        <VBtn color="error" variant="tonal" @click="performDeleteConnection"
          >Delete</VBtn
        >
      </VCardActions>
    </VCard>
  </VDialog>

  <!-- Contact delete dialog -->
  <VDialog v-model="confirmDeleteContactVisible" max-width="540">
    <VCard class="pa-sm-8 pa-4">
      <VCardTitle>Delete contact</VCardTitle>
      <VCardText>
        <div v-if="deleteContactBlockingReasons.length">
          <p>
            This contact cannot be deleted because it is referenced elsewhere:
          </p>
          <ul>
            <li v-for="(r, idx) in deleteContactBlockingReasons" :key="idx">
              {{ r }}
            </li>
          </ul>
          <p class="mt-5">
            Please review these references before deleting the contact.
          </p>
        </div>
        <div v-else>
          <p>
            Are you sure you want to permanently delete
            <strong>{{ props.userData.fullName }}</strong
            >?
          </p>
        </div>
      </VCardText>
      <VCardActions>
        <VSpacer />
        <VBtn
          variant="text"
          color="secondary"
          @click="
            () => {
              confirmDeleteContactVisible = false;
              deleteContactCandidateId = null;
            }
          "
          >Cancel</VBtn
        >
        <VBtn
          v-if="deleteContactBlockingReasons.length"
          variant="tonal"
          color="error"
          @click="cleanupAndDeleteContact"
        >
          Remove references & Delete
        </VBtn>
        <VBtn
          v-else
          variant="tonal"
          color="error"
          @click="performDeleteContact"
        >
          Delete
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>

  <VDialog v-model="editRelationDialogVisible" max-width="480">
    <VCard>
      <VCardTitle>Edit Connection</VCardTitle>
      <VCardText>
        <div class="mb-4">
          <strong>Contact: </strong>
          <span>
            {{ editCandidate?.fullName || "Unknown" }}
          </span>
        </div>
        <VTextField v-model="editRelation" label="Relation" />
      </VCardText>
      <VCardActions>
        <VBtn variant="text" @click="closeEditRelation">Cancel</VBtn>
        <VBtn color="primary" variant="tonal" @click="saveEditRelation"
          >Save</VBtn
        >
      </VCardActions>
    </VCard>
  </VDialog>
  <VSnackbar
    v-model="showSnackbar"
    timeout="3000"
    color="success"
    variant="tonal"
  >
    <div class="d-flex align-center">
      <VIcon icon="tabler-check" class="me-2" />
      {{ snackbarMessage }}
    </div>
  </VSnackbar>
</template>

<style scoped>
.connection-highlight {
  border-radius: 6px;
  animation: highlight-anim 2s ease-in-out;
}

.card-list {
  --v-card-list-gap: 0.5rem;
}

@keyframes highlight-anim {
  0% {
    background-color: rgb(16 185 129 / 0%);
    box-shadow: 0 0 0 0 rgb(16 185 129 / 0%);
  }

  10% {
    background-color: rgb(16 185 129 / 12%);
    box-shadow: 0 0 0 6px rgb(16 185 129 / 12%);
  }

  70% {
    background-color: rgb(16 185 129 / 6%);
    box-shadow: 0 0 0 0 rgb(16 185 129 / 4%);
  }

  100% {
    background-color: transparent;
    box-shadow: none;
  }
}

/* Compact details list: reduce vertical gaps and tighten lines */

.avatar-link {
  display: inline-block;
  color: inherit;
  cursor: pointer;
  text-decoration: none;
}
</style>
