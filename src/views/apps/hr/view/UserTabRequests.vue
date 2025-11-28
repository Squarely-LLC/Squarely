<script setup lang="ts">
import type {
  AdvanceRequest,
  EmployeeProperties,
  EmployeeRequest,
  LeaveRequest,
} from "@/plugins/fake-api/handlers/apps/employees/types";
import { useEmployeesStore } from "@/stores/employees";
import { useNotificationsStore } from "@/stores/notifications";
import type { PropType } from "vue";
import { computed, defineComponent, defineProps, ref, watch } from "vue";
import AddAdditionsDrawer from "./AddAdditionsDrawer.vue";
import AddLeaveDrawer from "./AddLeaveDrawer.vue";

interface Props {
  userData: EmployeeProperties;
}

const props = defineProps<Props>();

const employeesStore = useEmployeesStore();
const notifications = useNotificationsStore();

// Add Leave drawer state
const isAddLeaveOpen = ref(false);
const selectedLeaveData = ref<any | null>(null);

// Add Additions drawer state
const isAddAdditionsOpen = ref(false);
const selectedAdditionData = ref<any | null>(null);

const openAddLeaveDrawer = () => {
  selectedLeaveData.value = null;
  isAddLeaveOpen.value = true;
};

const openAddAdditionsDrawer = () => {
  selectedAdditionData.value = null;
  isAddAdditionsOpen.value = true;
};

const openEditLeave = (request: any) => {
  if (!request || request.type !== "Leave") return;
  selectedLeaveData.value = JSON.parse(JSON.stringify(request));
  isAddLeaveOpen.value = true;
};

const openEditAddition = (request: any) => {
  if (!request || request.type !== "Addition") return;
  selectedAdditionData.value = JSON.parse(JSON.stringify(request));
  isAddAdditionsOpen.value = true;
};

const handleAddLeave = (payload: any) => {
  const currentRequests = props.userData.requests || [];
  const newId =
    currentRequests.length > 0
      ? Math.max(...currentRequests.map((r: any) => r.id || 0)) + 1
      : 1;

  // if editing existing request
  if (selectedLeaveData.value && selectedLeaveData.value.id) {
    const updated = currentRequests.map((r: any) =>
      r.id === selectedLeaveData.value.id ? { ...r, ...payload } : r
    );
    employeesStore.updateEmployee(props.userData.id, {
      requests: JSON.parse(JSON.stringify(updated)),
    });
    notifications.push("Leave request updated", "success", 3500);
  } else {
    const newRequest = {
      ...payload,
      id: newId,
      type: "Leave",
      createdAt: new Date().toISOString(),
      status: "pending",
    };
    employeesStore.updateEmployee(props.userData.id, {
      requests: JSON.parse(JSON.stringify([...currentRequests, newRequest])),
    });
    notifications.push("Leave request added", "success", 3500);
  }

  selectedLeaveData.value = null;
  isAddLeaveOpen.value = false;
};

const handleAddAddition = (payload: any) => {
  const currentRequests = props.userData.requests || [];
  const newId =
    currentRequests.length > 0
      ? Math.max(...currentRequests.map((r: any) => r.id || 0)) + 1
      : 1;

  // if editing existing request
  if (selectedAdditionData.value && selectedAdditionData.value.id) {
    const updated = currentRequests.map((r: any) =>
      r.id === selectedAdditionData.value.id ? { ...r, ...payload } : r
    );
    employeesStore.updateEmployee(props.userData.id, {
      requests: JSON.parse(JSON.stringify(updated)),
    });
    notifications.push("Addition request updated", "success", 3500);
  } else {
    const newRequest = {
      ...payload,
      id: newId,
      type: "Addition",
      createdAt: new Date().toISOString(),
      status: "pending",
    };
    employeesStore.updateEmployee(props.userData.id, {
      requests: JSON.parse(JSON.stringify([...currentRequests, newRequest])),
    });
    notifications.push("Addition request added", "success", 3500);
  }

  selectedAdditionData.value = null;
  isAddAdditionsOpen.value = false;
};

// Get all requests
const requests = computed(() => props.userData.requests || []);

// Table state
const searchQuery = ref("");
const selectedStatus = ref<string>();
const selectedType = ref<string>();
const selectedMonth = ref<string>();
const itemsPerPage = ref(10);
const page = ref(1);
const confirmDeleteVisible = ref(false);
const deleteRequestCandidateId = ref<number | null>(null);

// Calculate leave statistics
const vacationStats = computed(() => {
  const attendance = props.userData.attendance;
  const allowed = attendance?.vacation || 0;

  // Calculate taken days from approved leave requests
  const taken = requests.value
    .filter(
      (r): r is LeaveRequest =>
        r.type === "Leave" &&
        r.status === "approved" &&
        (r.typeId === "vacation" || r.typeId === "Vacation")
    )
    .reduce((sum, r) => sum + (r.requestedDays || 0), 0);

  return {
    allowed,
    taken,
    remaining: allowed - taken,
  };
});

const sickLeaveStats = computed(() => {
  const attendance = props.userData.attendance;
  const allowed = attendance?.sickLeave || 0;

  // Calculate taken days from approved leave requests
  const taken = requests.value
    .filter(
      (r): r is LeaveRequest =>
        r.type === "Leave" &&
        r.status === "approved" &&
        (r.typeId === "sick-leave" || r.typeId === "Sick Leave")
    )
    .reduce((sum, r) => sum + (r.requestedDays || 0), 0);

  return {
    allowed,
    taken,
    remaining: allowed - taken,
  };
});

const parentalLeaveStats = computed(() => {
  const attendance = props.userData.attendance;
  const allowed = attendance?.parentalLeave || 0;

  // Calculate taken days from approved leave requests
  const taken = requests.value
    .filter(
      (r): r is LeaveRequest =>
        r.type === "Leave" &&
        r.status === "approved" &&
        (r.typeId === "parental-leave" || r.typeId === "Parental Leave")
    )
    .reduce((sum, r) => sum + (r.requestedDays || 0), 0);

  return {
    allowed,
    taken,
    remaining: allowed - taken,
  };
});

// Calculate advance statistics
const advanceStats = computed(() => {
  const advanceRequests = requests.value.filter(
    (r): r is AdvanceRequest => r.type === "Advance" && r.status === "approved"
  );

  const taken = advanceRequests.length;
  const totalAmount = advanceRequests.reduce(
    (sum, r) => sum + (r.amount || 0),
    0
  );

  // TODO: Calculate paid from payment records when implemented
  const paid = 0;
  const paidAmount = 0;

  const outstanding = taken - paid;
  const outstandingAmount = totalAmount - paidAmount;

  return {
    taken,
    amount: totalAmount,
    paid,
    paidAmount,
    outstanding,
    outstandingAmount,
  };
});

const leaveCards = computed(() => [
  {
    title: "Vacation",
    color: "primary",
    icon: "tabler-beach",
    allowed: vacationStats.value.allowed,
    taken: vacationStats.value.taken,
    remaining: vacationStats.value.remaining,
  },
  {
    title: "Sick Leave",
    color: "info",
    icon: "tabler-first-aid-kit",
    allowed: sickLeaveStats.value.allowed,
    taken: sickLeaveStats.value.taken,
    remaining: sickLeaveStats.value.remaining,
  },
  {
    title: "Parental Leave",
    color: "secondary",
    icon: "tabler-baby-carriage",
    allowed: parentalLeaveStats.value.allowed,
    taken: parentalLeaveStats.value.taken,
    remaining: parentalLeaveStats.value.remaining,
  },
]);

// Group config without a fixed order so groups follow the current sort
const groupBy = computed(() => [{ key: "monthYear" }]);

// Auto-expand grouped rows (mirrors document tab behaviour)
const AutoOpenGroups = defineComponent({
  name: "AutoOpenGroups",
  props: {
    groupedItems: {
      type: Array as PropType<ReadonlyArray<any>>,
      required: true,
    },
    toggleGroup: {
      type: Function as PropType<(group: any) => void>,
      required: true,
    },
    isGroupOpen: {
      type: Function as PropType<(group: any) => boolean>,
      required: true,
    },
  },
  setup(props) {
    type GroupEntry = {
      id?: string;
      type?: string;
      items?: unknown[];
    } & Record<string, unknown>;

    const autoOpened = new Set<string>();

    const expandGroups = (
      entries: unknown[],
      present: Set<string> = new Set<string>()
    ) => {
      for (const entry of entries) {
        if (!entry || typeof entry !== "object") continue;
        const group = entry as GroupEntry;
        if (group.type === "group") {
          const groupId = typeof group.id === "string" ? group.id : undefined;
          if (groupId) present.add(groupId);
          if (
            groupId &&
            !autoOpened.has(groupId) &&
            !props.isGroupOpen(group)
          ) {
            props.toggleGroup(group);
            autoOpened.add(groupId);
          } else if (groupId && props.isGroupOpen(group)) {
            autoOpened.add(groupId);
          }
          if (Array.isArray(group.items) && group.items.length) {
            expandGroups(group.items, present);
          }
        }
      }
      return present;
    };

    watch(
      () => props.groupedItems,
      (items) => {
        if (!Array.isArray(items)) return;
        const present = expandGroups(items);
        for (const id of Array.from(autoOpened)) {
          if (!present.has(id)) autoOpened.delete(id);
        }
      },
      { immediate: true, deep: true }
    );

    return () => null;
  },
});

function getRequestDescription(request: EmployeeRequest): string {
  if (request.type === "Leave") {
    const r = request as LeaveRequest;
    const typeLabel = r.typeId?.replace("-", " ") || "Leave";
    const days = r.requestedDays || 0;
    const remaining = r.deductible ? 0 : days;
    return `Leave\n${r.startDate} To ${
      r.returnDate
    } | #${days} days\n${typeLabel} | ${remaining} Remaining Days${
      r.reason ? `\n${r.reason}` : ""
    }`;
  }

  if (request.type === "Addition") {
    const r = request as any;
    return `Addition\n${r.additionType || "Addition"}${
      r.notes ? `\n${r.notes}` : ""
    }`;
  }

  if (request.type === "Deduction") {
    const r = request as any;
    return `Deduction\n${r.deductionType || "Deduction"}${
      r.notes ? `\n${r.notes}` : ""
    }`;
  }

  if (request.type === "Advance") {
    const r = request as AdvanceRequest;
    return `Advance\n${r.advanceType || "Advance"}${
      r.notes ? `\n${r.notes}` : ""
    }`;
  }

  if (request.type === "Time au Lieu") {
    const r = request as any;
    return `Time au Lieu\n${r.numberOfDays} days${r.note ? `\n${r.note}` : ""}`;
  }

  return (request as EmployeeRequest).type;
}

function getRequestAmount(request: EmployeeRequest): number {
  if (request.type === "Leave") return 0;
  if ("amount" in request) return (request as any).amount || 0;
  return 0;
}

function getRequestPeriod(request: EmployeeRequest): string {
  const start = (request as any).startDate || (request as any).date || null;
  const end = (request as any).returnDate || (request as any).endDate || null;

  const startDate = start ? new Date(start as any) : null;
  const endDate = end ? new Date(end as any) : null;

  if (
    startDate &&
    endDate &&
    !Number.isNaN(startDate.getTime()) &&
    !Number.isNaN(endDate.getTime())
  ) {
    const sameYear = startDate.getFullYear() === endDate.getFullYear();
    const sameMonth = sameYear && startDate.getMonth() === endDate.getMonth();
    if (sameYear && !sameMonth) {
      const startLabel = startDate.toLocaleDateString("en-US", {
        month: "short",
      });
      const endLabel = endDate.toLocaleDateString("en-US", {
        month: "short",
      });
      return `${startLabel}-${endLabel} ${startDate.getFullYear()}`;
    }
    const startLabel = startDate.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
    const endLabel = endDate.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
    return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
  }

  if (startDate && !Number.isNaN(startDate.getTime())) {
    return startDate.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  }

  return "-";
}

function getRequestDateValue(request: EmployeeRequest): Date | null {
  const raw = (request as any).startDate || (request as any).date || null;
  if (!raw) return null;
  const d = new Date(raw as any);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Format requests for table display
const formattedRequests = computed(() => {
  return requests.value.map((request) => ({
    id: request.id,
    type: request.type,
    description: getRequestDescription(request),
    date: (() => {
      const d = getRequestDateValue(request);
      return d
        ? d.toLocaleDateString("en-US", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "-";
    })(),
    dateValue: getRequestDateValue(request),
    monthYear: (() => {
      const d = getRequestDateValue(request);
      return d
        ? d.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          })
        : "No Date";
    })(),
    amount: getRequestAmount(request),
    period: getRequestPeriod(request),
    status: request.status,
    rawData: request,
  }));
});

// Filters
const filteredRequests = computed(() => {
  let filtered = formattedRequests.value;

  // Status filter
  if (selectedStatus.value && selectedStatus.value !== "All") {
    filtered = filtered.filter(
      (r) => r.status.toLowerCase() === selectedStatus.value?.toLowerCase()
    );
  }

  // Type filter
  if (selectedType.value && selectedType.value !== "All") {
    filtered = filtered.filter((r) => r.type === selectedType.value);
  }

  // Month filter
  if (selectedMonth.value) {
    filtered = filtered.filter((r) => {
      if (!r.dateValue) return false;
      const requestMonth = r.dateValue.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
      return requestMonth === selectedMonth.value;
    });
  }

  // Search filter
  const query = searchQuery.value.trim().toLowerCase();
  if (query) {
    filtered = filtered.filter(
      (r) =>
        r.description.toLowerCase().includes(query) ||
        r.type.toLowerCase().includes(query) ||
        r.status.toLowerCase().includes(query)
    );
  }

  return filtered;
});

// Pagination
const sortedRequests = computed(() => {
  return [...filteredRequests.value].sort((a, b) => {
    const aDate = a.dateValue ? a.dateValue.getTime() : 0;
    const bDate = b.dateValue ? b.dateValue.getTime() : 0;
    return bDate - aDate;
  });
});

const paginatedRequests = computed(() => {
  const start = (page.value - 1) * itemsPerPage.value;
  const end = start + itemsPerPage.value;
  return sortedRequests.value.slice(start, end);
});

const totalRequests = computed(() => filteredRequests.value.length);

// Available months for filter
const availableMonths = computed(() => {
  const months = new Set<string>();
  formattedRequests.value.forEach((r) => {
    if (!r.dateValue) return;
    const month = r.dateValue.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
    months.add(month);
  });
  return Array.from(months).sort((a, b) => {
    const dateA = new Date(a);
    const dateB = new Date(b);
    return dateB.getTime() - dateA.getTime();
  });
});

const getStatusColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case "approved":
      return "success";
    case "pending":
      return "warning";
    case "rejected":
      return "error";
    case "draft":
      return "default";
    default:
      return "default";
  }
};

const getTypeIcon = (type: string): string => {
  switch (type) {
    case "Leave":
      return "tabler-door-exit";
    case "Addition":
      return "tabler-plus";
    case "Deduction":
      return "tabler-minus";
    case "Advance":
      return "tabler-cash";
    case "Time au Lieu":
      return "tabler-clock";
    default:
      return "tabler-file";
  }
};

const getTypeIconColor = (type: string): string | undefined => {
  switch (type) {
    case "Deduction":
      return "error";
    default:
      return undefined;
  }
};

const headers = [
  { title: "DESCRIPTION", key: "description", sortable: true },
  { title: "DATE", key: "date", sortable: true },
  { title: "AMOUNT", key: "amount", sortable: true },
  { title: "PERIOD", key: "period", sortable: true },
  { title: "STATUS", key: "status", sortable: true },
  { title: "ACTIONS", key: "actions", sortable: false },
];

const updateItemsPerPage = (val: number) => {
  itemsPerPage.value = val;
  page.value = 1;
};

const deleteRequest = (requestId: number) => {
  deleteRequestCandidateId.value = requestId;
  confirmDeleteVisible.value = true;
};

const performDeleteRequest = () => {
  const requestId = deleteRequestCandidateId.value;
  if (requestId === null) return;

  const currentRequests = props.userData.requests || [];
  const updatedRequests = currentRequests.filter((r) => r.id !== requestId);

  employeesStore.updateEmployee(props.userData.id, {
    requests: updatedRequests,
  });

  notifications.push("Request deleted successfully", "success", 3500);
  confirmDeleteVisible.value = false;
  deleteRequestCandidateId.value = null;
};

const cancelDeleteRequest = () => {
  confirmDeleteVisible.value = false;
  deleteRequestCandidateId.value = null;
};
</script>

<template>
  <section>
    <VRow>
      <!-- Leave Cards -->
      <VCol
        v-for="card in leaveCards"
        :key="card.title"
        cols="12"
        sm="6"
        md="3"
      >
        <VCard>
          <VCardText>
            <!-- Header with Icon -->
            <div class="d-flex align-center justify-space-between mb-3">
              <VIcon :icon="card.icon" :color="card.color" size="24" />
              <h6 class="text-h6 font-weight-medium">{{ card.title }}</h6>
            </div>

            <VDivider class="mb-3" />

            <!-- Stats -->
            <div class="d-flex align-center justify-space-between py-1">
              <span class="text-sm">Allowed</span>
              <span
                class="text-sm font-weight-bold"
                :class="`text-${card.color}`"
                >{{ card.allowed }}</span
              >
            </div>
            <div class="d-flex align-center justify-space-between py-1">
              <span class="text-sm">Taken</span>
              <span class="text-sm font-weight-bold">{{ card.taken }}</span>
            </div>
            <div class="d-flex align-center justify-space-between py-1">
              <span class="text-sm">Remaining</span>
              <span class="text-sm font-weight-bold text-success">{{
                card.remaining
              }}</span>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <!-- Advances Card -->
      <VCol cols="12" sm="6" md="3">
        <VCard>
          <VCardText>
            <!-- Header with Icon -->
            <div class="d-flex align-center justify-space-between mb-3">
              <VIcon icon="tabler-cash" color="success" size="24" />
              <h6 class="text-h6 font-weight-medium">advances</h6>
            </div>

            <VDivider class="mb-3" />

            <!-- Stats -->
            <div class="d-flex align-center justify-space-between py-1">
              <span class="text-sm">Taken</span>
              <span class="text-sm font-weight-bold">
                {{ advanceStats.taken }} |
                {{ advanceStats.amount.toLocaleString() }}
              </span>
            </div>
            <div class="d-flex align-center justify-space-between py-1">
              <span class="text-sm">Paid</span>
              <span class="text-sm font-weight-bold">
                {{ advanceStats.paid }} |
                {{ advanceStats.paidAmount.toLocaleString() }}
              </span>
            </div>
            <div class="d-flex align-center justify-space-between py-1">
              <span class="text-sm">Outstanding</span>
              <span class="text-sm font-weight-bold text-warning">
                {{ advanceStats.outstanding }} |
                {{ advanceStats.outstandingAmount.toLocaleString() }}
              </span>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Requests Table Card -->
    <VRow class="mt-6">
      <VCol cols="12">
        <VCard>
          <VCardText>
            <VRow>
              <VCol cols="12" sm="3">
                <AppSelect
                  v-model="selectedStatus"
                  placeholder="Select Status"
                  :items="[
                    { title: 'All', value: 'All' },
                    { title: 'Draft', value: 'draft' },
                    { title: 'Pending', value: 'pending' },
                    { title: 'Approved', value: 'approved' },
                    { title: 'Rejected', value: 'rejected' },
                  ]"
                  clearable
                  clear-icon="tabler-x"
                />
              </VCol>

              <VCol cols="12" sm="3">
                <AppSelect
                  v-model="selectedType"
                  placeholder="Select Type"
                  :items="[
                    { title: 'All', value: 'All' },
                    { title: 'Leave', value: 'Leave' },
                    { title: 'Addition', value: 'Addition' },
                    { title: 'Deduction', value: 'Deduction' },
                    { title: 'Advance', value: 'Advance' },
                    { title: 'Time au Lieu', value: 'Time au Lieu' },
                  ]"
                  clearable
                  clear-icon="tabler-x"
                />
              </VCol>

              <VCol cols="12" sm="3">
                <AppSelect
                  v-model="selectedMonth"
                  placeholder="Select Month"
                  :items="availableMonths"
                  clearable
                  clear-icon="tabler-x"
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
                  { value: 10, title: '10' },
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

            <div
              class="app-user-search-filter d-flex align-center flex-wrap gap-4"
            >
              <div style="inline-size: 15.625rem">
                <AppTextField
                  v-model="searchQuery"
                  placeholder="Search Requests"
                />
              </div>

              <VBtn
                variant="tonal"
                color="secondary"
                prepend-icon="tabler-upload"
              >
                Export
              </VBtn>

              <VBtn
                prepend-icon="tabler-plus"
                append-icon="tabler-chevron-down"
              >
                Requests
                <VMenu activator="parent">
                  <VList>
                    <VListItem @click="openAddLeaveDrawer">
                      <template #prepend>
                        <VIcon icon="tabler-door-exit" />
                      </template>
                      <VListItemTitle>Leaves</VListItemTitle>
                    </VListItem>
                    <VDivider />
                    <VListItem @click="openAddAdditionsDrawer">
                      <template #prepend>
                        <VIcon icon="tabler-plus" />
                      </template>
                      <VListItemTitle>Additions</VListItemTitle>
                    </VListItem>
                    <VDivider />
                    <VListItem>
                      <template #prepend>
                        <VIcon icon="tabler-minus" />
                      </template>
                      <VListItemTitle>Deductions</VListItemTitle>
                    </VListItem>
                    <VDivider />
                    <VListItem>
                      <template #prepend>
                        <VIcon icon="tabler-cash" />
                      </template>
                      <VListItemTitle>Advances</VListItemTitle>
                    </VListItem>
                    <VDivider />
                    <VListItem>
                      <template #prepend>
                        <VIcon icon="tabler-clock" />
                      </template>
                      <VListItemTitle>Time au Lieu</VListItemTitle>
                    </VListItem>
                  </VList>
                </VMenu>
              </VBtn>
            </div>
          </VCardText>

          <VDivider />

          <!-- Table with Month Grouping -->
          <VDataTable
            :headers="headers"
            :items="paginatedRequests"
            hide-default-footer
            class="text-no-wrap"
            :group-by="groupBy"
          >
            <template
              #body.prepend="{ groupedItems, toggleGroup, isGroupOpen }"
            >
              <AutoOpenGroups
                :grouped-items="groupedItems"
                :toggle-group="toggleGroup"
                :is-group-open="isGroupOpen"
              />
            </template>

            <!-- Group Header -->
            <template #group-header="{ item, columns }">
              <tr class="request-group-header">
                <td :colspan="columns.length" class="py-3">
                  <span class="text-body-1 font-weight-medium">{{
                    item.value
                  }}</span>
                </td>
              </tr>
            </template>

            <!-- Description Column -->
            <template #item.description="{ item }">
              <div class="d-flex align-center gap-3 py-3">
                <VAvatar size="34" variant="tonal">
                  <VIcon :icon="getTypeIcon(item.type)" size="20" />
                </VAvatar>
                <div>
                  <div
                    class="text-sm"
                    style="line-height: 1.5; white-space: pre-line"
                  >
                    {{ item.description }}
                  </div>
                </div>
              </div>
            </template>

            <!-- Amount Column -->
            <template #item.amount="{ item }">
              <span v-if="item.amount > 0">{{
                item.amount.toLocaleString()
              }}</span>
              <span v-else class="text-disabled">-</span>
            </template>

            <!-- Status Column -->
            <template #item.status="{ item }">
              <VChip
                :color="getStatusColor(item.status)"
                size="small"
                class="text-capitalize"
              >
                {{ item.status }}
              </VChip>
            </template>

            <!-- Actions Column -->
            <template #item.actions="{ item }">
              <template v-if="item.type === 'Leave'">
                <IconBtn @click.stop="openEditLeave(item.rawData)">
                  <VIcon icon="tabler-edit" />
                </IconBtn>
              </template>

              <template v-if="item.type === 'Addition'">
                <IconBtn @click.stop="openEditAddition(item.rawData)">
                  <VIcon icon="tabler-edit" />
                </IconBtn>
              </template>

              <IconBtn>
                <VIcon icon="tabler-dots-vertical" />
                <VMenu activator="parent">
                  <VList>
                    <VListItem>
                      <template #prepend>
                        <VIcon icon="tabler-eye" />
                      </template>
                      <VListItemTitle>View Details</VListItemTitle>
                    </VListItem>

                    <VListItem @click="deleteRequest(item.id)">
                      <template #prepend>
                        <VIcon color="error" icon="tabler-trash" />
                      </template>
                      <VListItemTitle>Delete</VListItemTitle>
                    </VListItem>
                  </VList>
                </VMenu>
              </IconBtn>
            </template>
          </VDataTable>

          <VDivider />

          <!-- Pagination -->
          <VCardText
            class="d-flex align-center flex-wrap justify-end gap-4 pa-4"
          >
            <div class="d-flex align-center gap-2">
              <div class="text-sm text-disabled">
                {{ (page - 1) * itemsPerPage + 1 }}-{{
                  Math.min(page * itemsPerPage, totalRequests)
                }}
                of {{ totalRequests }}
              </div>
            </div>

            <VPagination
              v-model="page"
              :length="Math.ceil(totalRequests / itemsPerPage)"
              :total-visible="5"
            />
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Add / Edit Leave Drawer -->
    <VOverlay
      v-model="isAddLeaveOpen"
      class="add-leave-scrim"
      scrim="rgba(17, 24, 39, 0.72)"
      :z-index="1995"
    />
    <AddLeaveDrawer
      v-model:is-drawer-open="isAddLeaveOpen"
      :employee-name="(props.userData as any)?.name || ''"
      :available-days="props.userData?.attendance?.vacation || 0"
      :leave-data="selectedLeaveData"
      @submit="handleAddLeave"
      @close="selectedLeaveData = null"
    />

    <!-- Add / Edit Additions Drawer -->
    <VOverlay
      v-model="isAddAdditionsOpen"
      class="add-additions-scrim"
      scrim="rgba(17, 24, 39, 0.72)"
      :z-index="1995"
    />
    <AddAdditionsDrawer
      v-model:is-drawer-open="isAddAdditionsOpen"
      :addition-data="selectedAdditionData"
      @submit="handleAddAddition"
      @close="selectedAdditionData = null"
    />

    <!-- Confirm Delete Request Dialog -->
    <VDialog v-model="confirmDeleteVisible" persistent max-width="540">
      <VCard class="pa-sm-8 pa-4">
        <VCardTitle>Delete Request</VCardTitle>
        <VCardText>
          Are you sure you want to delete this request? This action cannot be
          undone.
        </VCardText>
        <VCardActions>
          <VBtn variant="text" @click="cancelDeleteRequest"> Cancel </VBtn>
          <VBtn color="error" variant="tonal" @click="performDeleteRequest">
            Delete
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </section>
</template>

<style scoped>
.request-group-header {
  background-color: rgba(var(--v-theme-surface-variant), 0.05);
  color: rgb(var(--v-theme-primary));
}

.request-group-header td {
  border: none;
}

.add-leave-scrim {
  inset-inline-end: 400px;
}

.add-leave-scrim :deep(.v-overlay__scrim) {
  inset-inline-end: 400px;
}

.add-additions-scrim {
  inset-inline-end: 400px;
}

.add-additions-scrim :deep(.v-overlay__scrim) {
  inset-inline-end: 400px;
}
</style>
