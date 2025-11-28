<script setup lang="ts">
import type {
  AdvanceRequest,
  EmployeeProperties,
  EmployeeRequest,
  LeaveRequest,
} from "@/plugins/fake-api/handlers/apps/employees/types";
import type { PropType } from "vue";
import { computed, defineComponent, defineProps, ref, watch } from "vue";

interface Props {
  userData: EmployeeProperties;
}

const props = defineProps<Props>();

// Get all requests
const requests = computed(() => props.userData.requests || []);

// Table state
const searchQuery = ref("");
const selectedStatus = ref<string>();
const selectedType = ref<string>();
const selectedMonth = ref<string>();
const itemsPerPage = ref(10);
const page = ref(1);

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

  return request.type;
}

function getRequestAmount(request: EmployeeRequest): number {
  if (request.type === "Leave") return 0;
  if ("amount" in request) return (request as any).amount || 0;
  return 0;
}

function getRequestPeriod(request: EmployeeRequest): string {
  if ("period" in request && (request as any).period)
    return (request as any).period;
  if ("periodId" in request && (request as any).periodId)
    return (request as any).periodId;
  return "-";
}

// Format requests for table display
const formattedRequests = computed(() => {
  return requests.value.map((request) => ({
    id: request.id,
    type: request.type,
    description: getRequestDescription(request),
    date: new Date(request.createdAt).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    dateValue: new Date(request.createdAt),
    monthYear: new Date(request.createdAt).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    }),
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
const paginatedRequests = computed(() => {
  const start = (page.value - 1) * itemsPerPage.value;
  const end = start + itemsPerPage.value;
  return filteredRequests.value.slice(start, end);
});

const totalRequests = computed(() => filteredRequests.value.length);

// Available months for filter
const availableMonths = computed(() => {
  const months = new Set<string>();
  formattedRequests.value.forEach((r) => {
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
      return "tabler-plane-departure";
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

              <VBtn prepend-icon="tabler-plus"> Requests </VBtn>
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
                <VAvatar
                  size="34"
                  :color="getStatusColor(item.status)"
                  variant="tonal"
                >
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
              <IconBtn>
                <VIcon icon="tabler-edit" />
              </IconBtn>

              <IconBtn>
                <VIcon icon="tabler-dots-vertical" />
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
</style>
