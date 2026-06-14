<script setup lang="ts">
import { computed, nextTick, ref, toRaw, watch } from "vue";
import { useRouter } from "vue-router";

import type { DealCustomFieldDefinition } from "@/plugins/fake-api/handlers/config/types";
import type { DealProperties } from "@/plugins/fake-api/handlers/operations/deals/types";
import { useConfigStore } from "@/stores/config";
import { useContactsStore } from "@/stores/contacts";
import { useDealsStore } from "@/stores/deals";
import { useEmployeesStore } from "@/stores/employees";
import { useNotificationsStore } from "@/stores/notifications";
import { useTodos } from "@/stores/todos";
import { getDealGrandTotal } from "@/utils/dealValue";
import EmailDialog from "@/views/apps/email/EmailDialog.vue";
import AddMeetingDrawer from "@/views/apps/todo/list/AddMeetingDrawer.vue";
import AddNewToDoDrawer from "@/views/apps/todo/list/AddNewToDoDrawer.vue";
import DealUpsertDialog from "@/views/operations/deals/list/DealUpsertDialog.vue";
import DealSummaryCard from "@/views/operations/deals/view/DealSummaryCard.vue";

type SortKey =
  | "code"
  | "createdAt"
  | "estimatedDeliveryDate"
  | "stage"
  | "type";
type SortOrder = "asc" | "desc";

const dealsStore = useDealsStore();
const contactsStore = useContactsStore();
const configStore = useConfigStore();
const employeesStore = useEmployeesStore();
const notifications = useNotificationsStore();
const router = useRouter();
const addTodoDrawerRef = ref<InstanceType<typeof AddNewToDoDrawer> | null>(
  null,
);
const isAddTodoDrawerVisible = ref(false);
const addTodoInitial = ref<any | null>(null);
const addMeetingRef = ref<InstanceType<typeof AddMeetingDrawer> | null>(null);
const isAddMeetingOpen = ref(false);
const composeDialogRef = ref<any | null>(null);
const isComposeDialogVisible = ref(false);

dealsStore.init();
contactsStore.init();
configStore.init();
employeesStore.init();

const searchQuery = ref("");
const selectedStage = ref<string | undefined>();
const selectedType = ref<string | undefined>();
const selectedImportance = ref<string | undefined>();
const selectedDealDate = ref<string | null>(null);

const sortOptions: {
  title: string;
  value: { key: SortKey; order: SortOrder };
}[] = [
  { title: "Code (A-Z)", value: { key: "code", order: "asc" } },
  { title: "Code (Z-A)", value: { key: "code", order: "desc" } },
  { title: "Recently Added", value: { key: "createdAt", order: "desc" } },
  {
    title: "Deal Date (Soonest)",
    value: { key: "estimatedDeliveryDate", order: "asc" },
  },
];

const selectedSort = ref(sortOptions[2].value);
const itemsPerPage = ref(15);
const page = ref(1);
const sortBy = ref<SortKey | undefined>(selectedSort.value.key);
const orderBy = ref<SortOrder | undefined>(selectedSort.value.order);
const selectedRows = ref<number[]>([]);

const stageOptions = computed(() =>
  (configStore.configurations?.deals?.dealStages || []).map((stage) => ({
    title: stage,
    value: stage,
  })),
);

const typeOptions = computed(() =>
  (configStore.configurations?.deals?.salesType || []).map((type) => ({
    title: type,
    value: type,
  })),
);

const typeLabel = computed(
  () =>
    String(
      configStore.configurations?.deals?.fieldLabels?.type ?? "Type",
    ).trim() || "Type",
);

const headers = computed(() => [
  { title: "Deal", key: "deal", width: "30%" },
  { title: "Contact", key: "contact", width: "18%" },
  { title: "Stage", key: "stage", width: "12%" },
  { title: "Price", key: "value", width: "10%" },
  {
    title: "Collaborators",
    key: "collaborators",
    sortable: false,
    width: "14%",
  },
  { title: "Actions", key: "actions", sortable: false, width: "8%" },
]);

const importanceOptions = [
  { title: "Important", value: "important" },
  { title: "Not Important", value: "normal" },
];

const customFieldDefinitions = computed<DealCustomFieldDefinition[]>(() => {
  const configured = configStore.configurations?.deals?.customFields;
  if (Array.isArray(configured) && configured.length) return configured;

  const labels = configStore.configurations?.deals?.fieldLabels || {};

  return Object.entries(labels).map(([key, label]) => ({
    key,
    label,
    type: "text",
  }));
});

watch(selectedSort, (value) => {
  sortBy.value = value?.key;
  orderBy.value = value?.order;
  page.value = 1;
});

watch(
  [
    selectedStage,
    selectedType,
    selectedImportance,
    selectedDealDate,
    searchQuery,
  ],
  () => {
    page.value = 1;
  },
);

const cloneDeal = (deal: DealProperties) => {
  const raw = toRaw(deal) as DealProperties;

  try {
    return JSON.parse(JSON.stringify(raw)) as DealProperties;
  } catch (error) {
    return {
      ...raw,
      collaborators: Array.isArray(raw.collaborators)
        ? [...raw.collaborators]
        : [],
      customFieldValues: { ...(raw.customFieldValues || {}) },
    };
  }
};

const avatarText = (name?: string | null) => {
  const safe = (name ?? "").trim();
  if (!safe) return "??";

  return safe
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
};

const contactDirectory = computed(() => {
  const map = new Map<
    number,
    { name: string; picture: string | null; email: string | null }
  >();

  contactsStore.all.forEach((contact) => {
    if (contact?.id === null || contact?.id === undefined) return;

    map.set(Number(contact.id), {
      name: contact.fullName,
      picture: contact.picture || null,
      email: contact.email || null,
    });
  });

  return map;
});

const employeeDirectory = computed(() => {
  const map = new Map<number, { name: string; picture: string | null }>();

  employeesStore.all.forEach((employee) => {
    if (employee?.id === null || employee?.id === undefined) return;

    map.set(Number(employee.id), {
      name: employee.fullName,
      picture: employee.picture || null,
    });
  });

  return map;
});

const getContactEntry = (id: number | string | null | undefined) => {
  if (id === null || id === undefined) return null;

  const numericId = Number(id);
  if (!Number.isFinite(numericId)) return null;

  return contactDirectory.value.get(numericId) ?? null;
};

const getDealCollaboratorEntry = (value: number | string) => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  if (raw.startsWith("contact:")) {
    const contact = getContactEntry(raw.slice("contact:".length));

    return contact
      ? {
          name: contact.name,
          picture: contact.picture,
        }
      : null;
  }

  const employee = employeeDirectory.value.get(Number(value));

  return employee ?? null;
};

const relatedContactName = (deal: DealProperties) =>
  getContactEntry(deal.relatedTo)?.name ?? "--";

const relatedProjectLabel = (deal: DealProperties) =>
  deal.projectCode?.trim() || deal.projectName?.trim() || "";

const collaboratorNames = (deal: DealProperties) =>
  decoratedCollaborators(deal).map((collaborator) => collaborator.name);

const formatMoney = (value?: number | null) =>
  Number(value || 0).toLocaleString();

const truncateText = (value?: string | null, limit = 80) => {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.length <= limit) return text;

  return `${text.slice(0, limit).trimEnd()}...`;
};

const normalizeDateKey = (value?: string | null) => {
  const raw = String(value || "").trim();
  const directMatch = raw.match(/^\d{4}-\d{2}-\d{2}/);
  if (directMatch) return directMatch[0];

  if (!raw) return "";

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";

  const year = parsed.getFullYear();
  const month = `${parsed.getMonth() + 1}`.padStart(2, "0");
  const day = `${parsed.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const normalizedSearch = computed(() => searchQuery.value.trim().toLowerCase());

const matchesFilters = (deal: DealProperties) => {
  const query = normalizedSearch.value;
  if (query) {
    const customFieldValues = customFieldDefinitions.value
      .map((field) => deal.customFieldValues?.[field.key])
      .filter((value) => value !== null && value !== undefined)
      .map((value) => String(value).toLowerCase());

    const haystack = [
      deal.code,
      deal.projectCode,
      deal.projectName,
      deal.location,
      relatedContactName(deal),
      ...customFieldValues,
    ]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase());

    if (!haystack.some((value) => value.includes(query))) return false;
  }

  if (selectedStage.value && deal.stage !== selectedStage.value) return false;

  if (selectedType.value && deal.type !== selectedType.value) return false;

  if (selectedImportance.value)
    return selectedImportance.value === "important"
      ? deal.important
      : !deal.important;

  if (
    selectedDealDate.value &&
    normalizeDateKey(deal.estimatedDeliveryDate) !==
      normalizeDateKey(selectedDealDate.value)
  )
    return false;

  return true;
};

const normalizeSortValue = (deal: DealProperties, key?: SortKey) => {
  if (key === "code") return deal.code?.toLowerCase() ?? "";

  if (key === "stage") return deal.stage ?? "";

  if (key === "type") return deal.type ?? "";

  if (key === "estimatedDeliveryDate") return deal.estimatedDeliveryDate ?? "";

  return deal.createdAt ?? "";
};

const compareDeals = (a: DealProperties, b: DealProperties) => {
  if (a.important !== b.important) return a.important ? -1 : 1;

  const key = sortBy.value ?? "createdAt";
  const order = orderBy.value ?? "desc";

  const aValue = normalizeSortValue(a, key);
  const bValue = normalizeSortValue(b, key);

  if (key === "createdAt" || key === "estimatedDeliveryDate") {
    const aDate = aValue ? new Date(aValue).getTime() : 0;
    const bDate = bValue ? new Date(bValue).getTime() : 0;

    return order === "asc" ? aDate - bDate : bDate - aDate;
  }

  const diff = String(aValue).localeCompare(String(bValue));

  return order === "asc" ? diff : -diff;
};

const filteredDeals = computed<DealProperties[]>(() =>
  dealsStore.all
    .map((deal) => cloneDeal(deal))
    .filter((deal) => matchesFilters(deal)),
);

const sortedDeals = computed<DealProperties[]>(() => {
  const items = [...filteredDeals.value];
  if (items.length > 1) items.sort(compareDeals);

  return items;
});

const displayedDeals = computed<DealProperties[]>(() => {
  const results = sortedDeals.value;
  const start = (page.value - 1) * itemsPerPage.value;
  const end =
    itemsPerPage.value === -1 ? results.length : start + itemsPerPage.value;

  return results.slice(start, end);
});

const totalDeals = computed(() => sortedDeals.value.length);

const decoratedCollaborators = (deal: DealProperties) =>
  (deal.collaborators || [])
    .map((id) => getDealCollaboratorEntry(id))
    .filter(Boolean) as Array<{ name: string; picture: string | null }>;

const formatDate = (value?: string | null) => {
  if (!value) return "--";

  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(value));
  } catch (error) {
    return value;
  }
};

const resolveStageColor = (stage?: string | null) => {
  const value = String(stage ?? "").trim();
  if (!value) return "#7C8AA5";

  const normalized = value.toLowerCase();

  const colorMap: Record<string, string> = {
    "under review": "#5C7CFA",
    negotiation: "#8B5CF6",
    "in progress": "#06B6D4",
    "high priority": "#F97316",
    "express order": "#EC4899",
    "on hold": "#F4B740",
    "awaiting payment": "#14B8A6",
    canceled: "#EF4444",
    completed: "#22C55E",
  };

  if (colorMap[normalized]) return colorMap[normalized];

  if (normalized.includes("complete")) return "#22C55E";
  if (normalized.includes("progress")) return "#06B6D4";
  if (normalized.includes("review")) return "#5C7CFA";
  if (normalized.includes("negotiat")) return "#8B5CF6";
  if (normalized.includes("priority")) return "#F97316";
  if (normalized.includes("express")) return "#EC4899";
  if (normalized.includes("hold")) return "#F4B740";
  if (normalized.includes("await") || normalized.includes("payment"))
    return "#14B8A6";
  if (normalized.includes("cancel")) return "#EF4444";

  return "#7C8AA5";
};

const isDealDialogVisible = ref(false);
const selectedDeal = ref<DealProperties | null>(null);
const dialogLoading = ref(false);
const dialogError = ref<string | null>(null);
const isStageDialogVisible = ref(false);
const stageDialogValue = ref<string | null>(null);
const stageDialogDealId = ref<number | null>(null);
const meetingContacts = computed(() =>
  contactsStore.all.map((contact) => ({
    id: contact.id,
    name: contact.fullName,
    avatarUrl: contact.picture || null,
  })),
);

const openAddDialog = () => {
  selectedDeal.value = null;
  dialogError.value = null;
  isDealDialogVisible.value = true;
};

const openEditDialog = (deal: DealProperties) => {
  selectedDeal.value = cloneDeal(deal);
  dialogError.value = null;
  isDealDialogVisible.value = true;
};

const openDealView = (deal: DealProperties) => {
  router.push({
    name: "operations-deals-view-id",
    params: { id: deal.id },
  });
};

const openContactView = (deal: DealProperties) => {
  const contactId = Number(deal.relatedTo);
  if (!Number.isFinite(contactId)) return;

  router.push({
    name: "apps-contact-view-id",
    params: { id: contactId },
  });
};

const saveDeal = (payload: Partial<DealProperties>) => {
  dialogLoading.value = true;
  dialogError.value = null;

  try {
    if (selectedDeal.value?.id) {
      const shouldApplyManualStage =
        payload.stage !== undefined &&
        String(payload.stage ?? "").trim() !==
          String(selectedDeal.value.stage ?? "").trim();
      const { stage, ...restPayload } = payload;
      const basePatch = shouldApplyManualStage ? restPayload : payload;
      let updated = dealsStore.updateDeal(selectedDeal.value.id, basePatch);

      if (updated && shouldApplyManualStage) {
        updated = dealsStore.updateDealStageManually(
          selectedDeal.value.id,
          stage ?? null,
        );
      }

      if (!updated) {
        dialogError.value = "Failed to update deal";
        notifications.push("Unable to update deal", "error", 4000);

        return;
      }

      notifications.push("Deal updated", "success", 3000);
    } else {
      const created = dealsStore.addDeal(payload);
      notifications.push("Deal created", "success", 3000);
      isDealDialogVisible.value = false;
      selectedDeal.value = null;
      openDealView(created);

      return;
    }

    isDealDialogVisible.value = false;
    selectedDeal.value = null;
  } catch (error) {
    console.error("Failed to save deal", error);
    dialogError.value = "An unexpected error occurred";
    notifications.push("Failed to save deal", "error", 4000);
  } finally {
    dialogLoading.value = false;
  }
};

const onTodoCreated = (payload: any) => {
  try {
    const todos = useTodos();
    try {
      todos.init();
    } catch {}
    todos.addTodo && todos.addTodo(payload);
    notifications.push("Task created", "success", 3500);
  } catch (error) {
    console.error("onTodoCreated failed:", error);
    notifications.push("Task created", "success", 3500);
  } finally {
    isAddTodoDrawerVisible.value = false;
  }
};

const onMeetingCreated = (payload: any) => {
  try {
    const todos = useTodos();
    try {
      todos.init();
    } catch {}
    todos.addMeeting && todos.addMeeting(payload);
    notifications.push("Meeting created", "success", 3500);
  } catch (error) {
    console.error("onMeetingCreated failed:", error);
    notifications.push("Meeting created", "success", 3500);
  } finally {
    isAddMeetingOpen.value = false;
  }
};

const closeMeetingDrawer = () => {
  isAddMeetingOpen.value = false;
};

const isConfirmDeleteVisible = ref(false);
const deleteCandidateId = ref<number | null>(null);

const confirmDelete = (id: number) => {
  deleteCandidateId.value = id;
  isConfirmDeleteVisible.value = true;
};

const cancelDelete = () => {
  deleteCandidateId.value = null;
  isConfirmDeleteVisible.value = false;
};

const performDelete = () => {
  if (deleteCandidateId.value === null) return;

  dealsStore.removeDeal(deleteCandidateId.value);

  const index = selectedRows.value.findIndex(
    (row) => row === deleteCandidateId.value,
  );
  if (index !== -1) selectedRows.value.splice(index, 1);

  notifications.push("Deal deleted", "success", 3000);
  cancelDelete();
};

const toggleImportant = (deal: DealProperties) => {
  dealsStore.updateDeal(deal.id, { important: !deal.important });
  notifications.push(
    deal.important ? "Removed from important deals" : "Marked as important",
    "success",
    2500,
  );
};

const handleDealAction = (
  action: "todo" | "meeting" | "email" | "stage" | "delete",
  deal: DealProperties,
) => {
  switch (action) {
    case "todo":
      addTodoInitial.value = {
        title: `Deal: ${deal.code || `#${deal.id}`}`,
        description: deal.note || "",
        relatedTo: {
          id: deal.id,
          name: deal.code || `Deal #${deal.id}`,
          type: "deal",
        },
        linkedTo: [
          {
            id: deal.id,
            name: deal.code || `Deal #${deal.id}`,
            avatarUrl: null,
            type: "deal",
          },
        ],
        collaborators: deal.relatedTo
          ? [
              {
                id: deal.relatedTo,
                name: relatedContactName(deal),
                avatarUrl: getContactEntry(deal.relatedTo)?.picture || null,
              },
            ]
          : [],
      };
      isAddTodoDrawerVisible.value = true;
      nextTick(() => {
        try {
          addTodoDrawerRef.value?.openWith?.(addTodoInitial.value);
        } catch {}
        addTodoInitial.value = null;
      });
      break;
    case "meeting":
      nextTick(() => {
        try {
          const linkedContacts: Array<{
            id: number | string;
            name: string;
            avatarUrl: string | null;
            type: "contact";
            roles: ["contact"];
            contactId: number | string;
          }> = [];

          if (deal.relatedTo !== null && deal.relatedTo !== undefined) {
            const entry = getContactEntry(deal.relatedTo);
            linkedContacts.push({
              id: deal.relatedTo,
              contactId: deal.relatedTo,
              name: entry?.name || `Contact ${deal.relatedTo}`,
              avatarUrl: entry?.picture || null,
              type: "contact",
              roles: ["contact"],
            });
          }

          addMeetingRef.value?.openWith?.({
            title: `Meeting: ${deal.code || `Deal #${deal.id}`}`,
            initialStart: new Date(),
            durationMins: 60,
            linkedTo: linkedContacts,
            relatedTo: {
              id: deal.id,
              name: deal.code || `Deal #${deal.id}`,
              type: "deal",
            },
            attendees: [],
            notes: `Meeting regarding ${deal.code || `deal #${deal.id}`}`,
          });
        } catch {}
        isAddMeetingOpen.value = true;
      });
      break;
    case "email":
      isComposeDialogVisible.value = true;
      nextTick(() => {
        try {
          const toAddress = getContactEntry(deal.relatedTo)?.email || "";
          composeDialogRef.value?.openWith?.({
            to: toAddress ? [toAddress] : [],
            subject: `Regarding ${deal.code || `Deal #${deal.id}`}`,
            message: `Hello,\n\nI'd like to discuss ${deal.code || `deal #${deal.id}`}.\n\nThanks,`,
          });
        } catch {}
      });
      break;
    case "stage":
      stageDialogDealId.value = Number(deal.id);
      stageDialogValue.value = deal.stage ?? null;
      isStageDialogVisible.value = true;
      break;
    case "delete":
      confirmDelete(Number(deal.id));
      break;
  }
};

const deleteCandidateName = computed(() => {
  if (deleteCandidateId.value === null) return "";

  const deal = dealsStore.byId(deleteCandidateId.value);

  return deal?.code ?? String(deleteCandidateId.value);
});

const saveStageChange = () => {
  if (stageDialogDealId.value === null || !stageDialogValue.value) {
    isStageDialogVisible.value = false;
    return;
  }

  dealsStore.updateDealStageManually(
    stageDialogDealId.value,
    stageDialogValue.value,
  );
  notifications.push("Stage updated", "success", 2500);
  isStageDialogVisible.value = false;
  stageDialogDealId.value = null;
};

const updateOptions = (options: {
  sortBy?: Array<{ key: SortKey; order: SortOrder }>;
}) => {
  const [sort] = options.sortBy ?? [];
  if (sort) {
    sortBy.value = sort.key;
    orderBy.value = sort.order;
  }

  const matched = sortOptions.find(
    (option) =>
      option.value.key === sortBy.value && option.value.order === orderBy.value,
  );

  if (matched) selectedSort.value = matched.value;
};

const updateItemsPerPage = (value: number | string) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return;

  itemsPerPage.value = numeric;
  page.value = 1;
};
</script>

<template>
  <section>
    <VCard class="mb-6">
      <VCardItem class="pb-4">
        <VCardTitle>Deals</VCardTitle>
      </VCardItem>

      <VCardText>
        <VRow>
          <VCol cols="12" md="2">
            <AppSelect
              v-model="selectedStage"
              placeholder="Select Stage"
              :items="stageOptions"
              clearable
              clear-icon="tabler-x"
            />
          </VCol>

          <VCol cols="12" md="2">
            <AppSelect
              v-model="selectedType"
              placeholder="Select Type"
              :items="typeOptions"
              clearable
              clear-icon="tabler-x"
            />
          </VCol>

          <VCol cols="12" md="2">
            <AppSelect
              v-model="selectedImportance"
              placeholder="Importance"
              :items="importanceOptions"
              clearable
              clear-icon="tabler-x"
            />
          </VCol>

          <VCol cols="12" md="3">
            <AppDateTimePicker
              v-model="selectedDealDate"
              placeholder="Deal Date"
              clearable
            />
          </VCol>

          <VCol cols="12" md="3">
            <AppSelect
              v-model="selectedSort"
              placeholder="Sort By"
              :items="sortOptions"
              item-title="title"
              item-value="value"
            />
          </VCol>
        </VRow>
      </VCardText>

      <VDivider />

      <VCardText class="d-flex flex-wrap gap-4">
        <div class="me-3 d-flex gap-3">
          <AppSelect
            :model-value="itemsPerPage"
            :items="[
              { value: 15, title: '15' },
              { value: 25, title: '25' },
              { value: 50, title: '50' },
              { value: 100, title: '100' },
              { value: -1, title: 'All' },
            ]"
            style="inline-size: 6.25rem"
            @update:model-value="updateItemsPerPage"
          />
        </div>

        <VSpacer />

        <div class="d-flex align-center flex-wrap gap-4">
          <div style="inline-size: 15.625rem">
            <AppTextField v-model="searchQuery" placeholder="Search Deals" />
          </div>

          <VBtn variant="tonal" color="secondary" prepend-icon="tabler-upload">
            Export
          </VBtn>

          <VBtn prepend-icon="tabler-plus" @click="openAddDialog">
            Add New Deal
          </VBtn>
        </div>
      </VCardText>

      <VDivider />

      <VDataTableServer
        v-model:items-per-page="itemsPerPage"
        v-model:model-value="selectedRows"
        v-model:page="page"
        :items="displayedDeals"
        item-value="id"
        :items-length="totalDeals"
        :headers="headers"
        class="deals-table"
        @update:options="updateOptions"
      >
        <template #item.deal="{ item }">
          <div class="deal-cell d-flex align-center gap-x-3 py-2">
            <VBtn
              icon
              variant="text"
              :color="item.important ? 'warning' : 'secondary'"
              @click.stop="toggleImportant(item)"
            >
              <VIcon
                :icon="item.important ? 'tabler-star-filled' : 'tabler-star'"
              />
            </VBtn>

            <VMenu
              open-on-hover
              location="end"
              :close-on-content-click="false"
              max-width="420"
            >
              <template #activator="{ props: menuProps }">
                <div
                  v-bind="menuProps"
                  class="deal-cell__content d-flex flex-column gap-1 text-start"
                >
                  <button
                    type="button"
                    class="deal-cell__inline-link deal-cell__date deal-cell__date-link text-body-1"
                    @click.stop="openDealView(item)"
                  >
                    {{ formatDate(item.estimatedDeliveryDate) }}
                  </button>

                  <div class="d-flex align-center gap-2 flex-wrap min-inline-size-0">
                    <button
                      type="button"
                      class="deal-cell__inline-link deal-cell__title text-base font-weight-medium"
                      @click.stop="openDealView(item)"
                    >
                      {{ item.code || "--" }}
                    </button>

                    <VChip
                      label
                      size="x-small"
                      color="primary"
                      variant="tonal"
                      class="deal-cell__type-chip"
                    >
                      {{ item.type || typeLabel }}
                    </VChip>
                  </div>

                  <div
                    v-if="truncateText(item.note)"
                    class="deal-cell__note text-sm text-medium-emphasis"
                  >
                    {{ truncateText(item.note) }}
                  </div>
                </div>
              </template>

              <DealSummaryCard
                :deal="item"
                :linked-to-name="relatedContactName(item)"
                :collaborator-names="collaboratorNames(item)"
                hover-mode
              />
            </VMenu>
          </div>
        </template>

        <template #item.contact="{ item }">
          <div class="linked-cell d-flex align-center gap-2">
            <button
              type="button"
              class="linked-cell__avatar-btn"
              :disabled="!getContactEntry(item.relatedTo)"
              @click.stop="openContactView(item)"
            >
              <VAvatar
                size="30"
                :color="
                  getContactEntry(item.relatedTo)?.picture ? undefined : 'primary'
                "
                :class="
                  getContactEntry(item.relatedTo)?.picture
                    ? null
                    : 'text-white font-weight-medium'
                "
              >
                <VImg
                  v-if="getContactEntry(item.relatedTo)?.picture"
                  :src="getContactEntry(item.relatedTo)?.picture || undefined"
                />
                <span v-else>{{ avatarText(relatedContactName(item)) }}</span>
              </VAvatar>
            </button>

            <div
              class="linked-cell__content d-flex flex-column min-inline-size-0"
            >
              <button
                type="button"
                class="linked-cell__inline-link linked-cell__name text-high-emphasis"
                :disabled="!getContactEntry(item.relatedTo)"
                @click.stop="openContactView(item)"
              >
                {{ relatedContactName(item) }}
              </button>
              <span
                v-if="relatedProjectLabel(item)"
                class="linked-cell__project text-sm text-medium-emphasis"
              >
                {{ relatedProjectLabel(item) }}
              </span>
            </div>
          </div>
        </template>

        <template #item.value="{ item }">
          <span class="text-high-emphasis text-body-1">{{
            formatMoney(getDealGrandTotal(item))
          }}</span>
        </template>

        <template #item.stage="{ item }">
          <VChip :color="resolveStageColor(item.stage)" label size="small">
            {{ item.stage || "--" }}
          </VChip>
        </template>

        <template #item.collaborators="{ item }">
          <div class="collaborators-cell d-flex align-center gap-2">
            <div
              v-if="decoratedCollaborators(item).length"
              class="v-avatar-group demo-avatar-group"
            >
              <VAvatar
                v-for="(collaborator, index) in decoratedCollaborators(
                  item,
                ).slice(0, 3)"
                :key="`${item.id}-${index}`"
                :size="32"
                :color="collaborator.picture ? undefined : 'primary'"
                :class="
                  collaborator.picture ? null : 'text-white font-weight-medium'
                "
              >
                <VImg v-if="collaborator.picture" :src="collaborator.picture" />
                <span v-else>{{ avatarText(collaborator.name) }}</span>

                <VTooltip activator="parent" location="top">
                  {{ collaborator.name }}
                </VTooltip>
              </VAvatar>

              <VAvatar
                v-if="decoratedCollaborators(item).length > 3"
                color="secondary"
                :size="32"
                class="font-weight-medium text-white"
              >
                +{{ decoratedCollaborators(item).length - 3 }}
                <VTooltip activator="parent" location="top">
                  {{
                    decoratedCollaborators(item)
                      .slice(3)
                      .map((entry) => entry.name)
                      .join(", ")
                  }}
                </VTooltip>
              </VAvatar>
            </div>

            <span v-else class="text-medium-emphasis">No collaborators</span>
          </div>
        </template>

        <template #item.actions="{ item }">
          <div class="actions-cell d-flex align-center justify-end">
            <VBtn
              icon
              variant="text"
              color="medium-emphasis"
              @click="openEditDialog(item)"
            >
              <VIcon icon="tabler-pencil" />
            </VBtn>

            <VBtn icon variant="text" color="medium-emphasis">
              <VIcon icon="tabler-dots-vertical" />

              <VMenu activator="parent">
                <VList>
                  <VListItem @click="handleDealAction('todo', item)">
                    <template #prepend>
                      <VIcon icon="tabler-list-check" />
                    </template>
                    <VListItemTitle>Todo</VListItemTitle>
                  </VListItem>
                  <VListItem @click="handleDealAction('meeting', item)">
                    <template #prepend>
                      <VIcon icon="tabler-calendar" />
                    </template>
                    <VListItemTitle>Meeting</VListItemTitle>
                  </VListItem>
                  <VListItem @click="handleDealAction('email', item)">
                    <template #prepend>
                      <VIcon icon="tabler-mail" />
                    </template>
                    <VListItemTitle>Email</VListItemTitle>
                  </VListItem>

                  <VDivider />

                  <VListItem @click="handleDealAction('stage', item)">
                    <template #prepend>
                      <VIcon icon="tabler-arrows-exchange-2" />
                    </template>
                    <VListItemTitle>Change Stage</VListItemTitle>
                  </VListItem>

                  <VDivider />

                  <VListItem @click="handleDealAction('delete', item)">
                    <template #prepend>
                      <VIcon color="error" icon="tabler-trash" />
                    </template>
                    <VListItemTitle class="text-error"> Delete </VListItemTitle>
                  </VListItem>
                </VList>
              </VMenu>
            </VBtn>
          </div>
        </template>
      </VDataTableServer>
    </VCard>

    <AddNewToDoDrawer
      ref="addTodoDrawerRef"
      v-model:is-drawer-open="isAddTodoDrawerVisible"
      :collaborators-options="[]"
      source="contacts"
      :initial="addTodoInitial"
      @user-data="onTodoCreated"
    />

    <AddMeetingDrawer
      ref="addMeetingRef"
      v-model:modelValue="isAddMeetingOpen"
      :contacts="meetingContacts"
      source="contacts"
      @cancel="closeMeetingDrawer"
      @save="onMeetingCreated"
    />

    <EmailDialog
      ref="composeDialogRef"
      v-model:is-dialog-visible="isComposeDialogVisible"
      @send="
        (payload) => {
          try {
            const recipients = Array.isArray(payload?.to)
              ? payload.to
              : payload?.to
                ? [String(payload.to)]
                : [];
            notifications.push(
              `Email sent to ${recipients.length} recipient(s)`,
              'success',
              3500,
            );
          } catch (e) {
            notifications.push('Email sent', 'success', 3500);
          }
        }
      "
    />

    <DealUpsertDialog
      v-model:is-dialog-visible="isDealDialogVisible"
      :deal="selectedDeal"
      :loading="dialogLoading"
      :error="dialogError"
      @submit="saveDeal"
    />

    <VDialog v-model="isConfirmDeleteVisible" max-width="540">
      <DialogCloseBtn @click="isConfirmDeleteVisible = false" />
      <VCard class="pa-sm-8 pa-4">
        <VCardTitle>Delete Deal</VCardTitle>
        <VCardText>
          Are you sure you want to permanently delete
          <strong>{{ deleteCandidateName }}</strong
          >?
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn variant="text" color="secondary" @click="cancelDelete">
            Cancel
          </VBtn>
          <VBtn color="error" variant="tonal" @click="performDelete">
            Delete
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VDialog v-model="isStageDialogVisible" max-width="480">
      <DialogCloseBtn @click="isStageDialogVisible = false" />
      <VCard class="pa-sm-8 pa-4">
        <VCardTitle>Change Stage</VCardTitle>
        <VCardText>
          <AppSelect
            v-model="stageDialogValue"
            placeholder="Select Stage"
            :items="stageOptions"
            clearable
            clear-icon="tabler-x"
          />
        </VCardText>
        <VCardActions class="justify-end">
          <VBtn
            variant="tonal"
            color="secondary"
            @click="isStageDialogVisible = false"
          >
            Close
          </VBtn>
          <VBtn color="primary" @click="saveStageChange">Save</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </section>
</template>

<style scoped>
.deals-table {
  table-layout: auto;
}

.deal-cell {
  min-inline-size: 0;
}

.deal-cell__content,
.linked-cell,
.linked-cell__content {
  min-inline-size: 0;
}

.deal-cell__inline-link,
.linked-cell__inline-link,
.linked-cell__avatar-btn {
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.deal-cell__inline-link:disabled,
.linked-cell__inline-link:disabled,
.linked-cell__avatar-btn:disabled {
  cursor: default;
}

.deal-cell__inline-link,
.linked-cell__inline-link {
  text-align: start;
}

.deal-cell__title,
.deal-cell__date-link,
.linked-cell__name {
  transition: color 0.18s ease;
}

.deal-cell__title:hover,
.deal-cell__date-link:hover,
.linked-cell__name:hover {
  color: rgb(var(--v-theme-primary));
}

.deal-cell__title,
.deal-cell__date,
.linked-cell__name,
.linked-cell__project {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.deal-cell__date {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.95rem;
  font-weight: 500;
}

.deal-cell__note {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.deal-cell__type-chip {
  max-inline-size: 100%;
}

.linked-cell__avatar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
}

.actions-cell :deep(.v-btn) {
  margin-inline: 0;
}

.collaborators-cell {
  min-inline-size: 0;
  white-space: nowrap;
}

@media (max-width: 1366px) {
  .deals-table {
    font-size: 0.875rem;
  }

  .deals-table :deep(th),
  .deals-table :deep(td) {
    padding-inline: 10px !important;
  }

  .deals-table :deep(th) {
    white-space: nowrap;
  }

  .deals-table :deep(.v-chip) {
    max-inline-size: 100%;
  }

  .demo-avatar-group {
    transform: scale(0.94);
    transform-origin: right center;
  }
}
</style>
