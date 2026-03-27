<script setup lang="ts">
import { formatSystemDate, formatSystemMonthYear } from "@core/utils/formatters";
import type {
  AdvanceRequest,
  EmployeeProperties,
  EmployeeRequest,
  LeaveRequest,
} from "@/plugins/fake-api/handlers/apps/employees/types";
import { useEmployeesStore } from "@/stores/employees";
import { useNotificationsStore } from "@/stores/notifications";
import type { PropType } from "vue";
import { computed, defineComponent, ref, watch } from "vue";
import AddAdditionsDrawer from "./AddAdditionsDrawer.vue";
import AddAdvancesDrawer from "./AddAdvancesDrawer.vue";
import AddDeductionDrawer from "./AddDeductionDrawer.vue";
import AddLeaveDrawer from "./AddLeaveDrawer.vue";
import AddTimeAuLieuDrawer from "./AddTimeAuLieuDrawer.vue";

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

// Add Deduction drawer state
const isAddDeductionOpen = ref(false);
const selectedDeductionData = ref<any | null>(null);

// Add Advances drawer state
const isAddAdvancesOpen = ref(false);
const selectedAdvanceData = ref<any | null>(null);

// Add Time au Lieu drawer state
const isAddTimeAuLieuOpen = ref(false);
const selectedTimeAuLieuData = ref<any | null>(null);

const openAddLeaveDrawer = () => {
  selectedLeaveData.value = null;
  isAddLeaveOpen.value = true;
};

const openAddAdditionsDrawer = () => {
  selectedAdditionData.value = null;
  isAddAdditionsOpen.value = true;
};

const openAddDeductionDrawer = () => {
  selectedDeductionData.value = null;
  isAddDeductionOpen.value = true;
};

const openAddAdvancesDrawer = () => {
  selectedAdvanceData.value = null;
  isAddAdvancesOpen.value = true;
};

const openAddTimeAuLieuDrawer = () => {
  selectedTimeAuLieuData.value = null;
  isAddTimeAuLieuOpen.value = true;
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

const openEditDeduction = (request: any) => {
  if (!request || request.type !== "Deduction") return;
  selectedDeductionData.value = JSON.parse(JSON.stringify(request));
  isAddDeductionOpen.value = true;
};

const openEditAdvance = (request: any) => {
  if (!request || request.type !== "Advance") return;
  selectedAdvanceData.value = JSON.parse(JSON.stringify(request));
  isAddAdvancesOpen.value = true;
};

const openEditTimeAuLieu = (request: any) => {
  if (!request || request.type !== "Time au Lieu") return;
  selectedTimeAuLieuData.value = JSON.parse(JSON.stringify(request));
  isAddTimeAuLieuOpen.value = true;
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

const handleAddDeduction = (payload: any) => {
  const currentRequests = props.userData.requests || [];
  const newId =
    currentRequests.length > 0
      ? Math.max(...currentRequests.map((r: any) => r.id || 0)) + 1
      : 1;

  // if editing existing request
  if (selectedDeductionData.value && selectedDeductionData.value.id) {
    const updated = currentRequests.map((r: any) =>
      r.id === selectedDeductionData.value.id ? { ...r, ...payload } : r
    );
    employeesStore.updateEmployee(props.userData.id, {
      requests: JSON.parse(JSON.stringify(updated)),
    });
    notifications.push("Deduction request updated", "success", 3500);
  } else {
    const newRequest = {
      ...payload,
      id: newId,
      type: "Deduction",
      createdAt: new Date().toISOString(),
      status: "pending",
    };
    employeesStore.updateEmployee(props.userData.id, {
      requests: JSON.parse(JSON.stringify([...currentRequests, newRequest])),
    });
    notifications.push("Deduction request added", "success", 3500);
  }

  selectedDeductionData.value = null;
  isAddDeductionOpen.value = false;
};

const handleAddAdvance = (payload: any) => {
  const currentRequests = props.userData.requests || [];
  const newId =
    currentRequests.length > 0
      ? Math.max(...currentRequests.map((r: any) => r.id || 0)) + 1
      : 1;

  // if editing existing request
  if (selectedAdvanceData.value && selectedAdvanceData.value.id) {
    const updated = currentRequests.map((r: any) =>
      r.id === selectedAdvanceData.value.id ? { ...r, ...payload } : r
    );
    employeesStore.updateEmployee(props.userData.id, {
      requests: JSON.parse(JSON.stringify(updated)),
    });
    notifications.push("Advance request updated", "success", 3500);
  } else {
    const newRequest = {
      ...payload,
      id: newId,
      type: "Advance",
      createdAt: new Date().toISOString(),
      status: "pending",
    };
    employeesStore.updateEmployee(props.userData.id, {
      requests: JSON.parse(JSON.stringify([...currentRequests, newRequest])),
    });
    notifications.push("Advance request added", "success", 3500);
  }

  selectedAdvanceData.value = null;
  isAddAdvancesOpen.value = false;
};

const handleAddTimeAuLieu = (payload: any) => {
  const currentRequests = props.userData.requests || [];
  const newId =
    currentRequests.length > 0
      ? Math.max(...currentRequests.map((r: any) => r.id || 0)) + 1
      : 1;

  // if editing existing request
  if (selectedTimeAuLieuData.value && selectedTimeAuLieuData.value.id) {
    const updated = currentRequests.map((r: any) =>
      r.id === selectedTimeAuLieuData.value.id ? { ...r, ...payload } : r
    );
    employeesStore.updateEmployee(props.userData.id, {
      requests: JSON.parse(JSON.stringify(updated)),
    });
    notifications.push("Time au Lieu request updated", "success", 3500);
  } else {
    const newRequest = {
      ...payload,
      id: newId,
      type: "Time au Lieu",
      createdAt: new Date().toISOString(),
      status: "pending",
    };
    employeesStore.updateEmployee(props.userData.id, {
      requests: JSON.parse(JSON.stringify([...currentRequests, newRequest])),
    });
    notifications.push("Time au Lieu request added", "success", 3500);
  }

  selectedTimeAuLieuData.value = null;
  isAddTimeAuLieuOpen.value = false;
};

// Get all requests
const requests = computed(() => {
  const reqs = props.userData.requests || [];
  console.log("📊 RAW REQUESTS from userData:", reqs.length, reqs);
  return reqs;
});

// Table state
const searchQuery = ref("");
const selectedStatus = ref<string>();
const selectedType = ref<string>();
const selectedMonth = ref<string>();
const itemsPerPage = ref(5);
const page = ref(1);
// Sorting state (controlled externally so we can sort before grouping)
const sortBy = ref<string | undefined>(undefined);
const orderBy = ref<string | undefined>(undefined);
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

// Track whether the table is grouped (we default to grouping by monthYear)
const groupingActive = computed(() =>
  Boolean(groupBy.value && groupBy.value.length > 0)
);

// Custom grouped pagination
// Vuetify applies grouping after pagination which hides items; to keep groups
// intact while paginating we implement our own grouped pagination:
// - group the sorted items by `monthYear` into `groupedRequests`
// - compute which groups overlap the current page (based on itemsPerPage)
// - include the whole groups on that page (so groups aren't split across pages)
const groupedRequests = computed(() => {
  const map = new Map<string, typeof sortedRequests.value>();
  for (const r of sortedRequests.value) {
    const key = r.monthYear ?? "No Date";
    if (!map.has(key)) map.set(key, [] as typeof sortedRequests.value);
    map.get(key)!.push(r);
  }
  return Array.from(map.entries()).map(([key, items]) => ({ key, items }));
});

const totalDataItems = computed(() => sortedRequests.value.length);

// Determine which groups belong on the current page. Pages are computed on
// data item counts (not counting group header rows). If a group overlaps the
// page range, the whole group is included on that page.
const pagedGroups = computed(() => {
  if (!groupingActive.value || (itemsPerPage.value ?? 0) <= 0)
    return groupedRequests.value;

  const pageSize = itemsPerPage.value as number;
  const start = (page.value - 1) * pageSize;
  const end = page.value * pageSize - 1;

  const result: Array<{ key: string; items: typeof sortedRequests.value }> = [];
  let idx = 0;
  for (const g of groupedRequests.value) {
    const groupStart = idx;
    const groupEnd = idx + g.items.length - 1;
    // advance index for next group
    idx += g.items.length;
    // include group if it overlaps the page window
    if (groupEnd < start) continue;
    if (groupStart > end && result.length > 0) break; // we've passed the page window
    if (groupStart > end && result.length === 0) continue; // skip leading groups
    result.push(g);
  }
  console.log(
    "📦 pagedGroups page=",
    page.value,
    "pageSize=",
    itemsPerPage.value,
    "groups=",
    result.map((g) => g.key)
  );
  return result;
});

// Flatten the paged groups into rows the table can render. We include a
// synthetic header object for group labels (marked with __isGroup) followed
// by the group's items.
const displayedItems = computed(() => {
  if (!groupingActive.value) {
    // Un-grouped mode: apply pagination client-side using page and itemsPerPage
    const n = itemsPerPage.value ?? 0;
    if (n === -1) return sortedRequests.value;
    const start = (page.value - 1) * n;
    return sortedRequests.value.slice(start, start + n);
  }

  const out: Array<any> = [];
  let gi = 0;
  for (const g of pagedGroups.value) {
    out.push({ __isGroup: true, id: `group-${gi++}`, value: g.key });
    for (const it of g.items) out.push(it);
  }
  return out;
});

// When switching pages or toggling grouping/itemsPerPage we should ensure the
// page number stays valid — reset to first page for clarity.
watch([itemsPerPage, groupingActive], () => (page.value = 1));

// Debugging: log page changes so we can confirm clicks update the page ref
watch(
  () => page.value,
  (p) => console.log("📄 page changed ->", p),
  { immediate: false }
);

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
        console.log(
          "🔓 AUTO-OPENED GROUPS:",
          Array.from(autoOpened),
          "Total groups:",
          present.size
        );
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
    return `Leave\n${formatSystemDate(String(r.startDate))} To ${
      r.returnDate ? formatSystemDate(String(r.returnDate)) : "-"
    } | #${days} days\n${typeLabel} | ${remaining} Remaining Days${
      r.reason ? `\n${r.reason}` : ""
    }`;
  }

  if (request.type === "Addition") {
    const r = request as any;
    const typeLabel = r.additionType?.replace("-", " ") || "Addition";
    return `Addition\n${typeLabel}${r.amount ? ` | Amount: ${r.amount}` : ""}${
      r.notes ? `\n${r.notes}` : ""
    }`;
  }

  if (request.type === "Deduction") {
    const r = request as any;
    const typeLabel = r.deductionType?.replace("-", " ") || "Deduction";
    return `Deduction\n${typeLabel}${r.amount ? ` | Amount: ${r.amount}` : ""}${
      r.notes ? `\n${r.notes}` : ""
    }`;
  }

  if (request.type === "Advance") {
    const r = request as AdvanceRequest;
    const typeLabel = r.advanceType?.replace("-", " ") || "Advance";
    return `Advance\n${typeLabel}${r.amount ? ` | Amount: ${r.amount}` : ""}${
      r.payBackInMonths ? ` | Pay back: ${r.payBackInMonths} months` : ""
    }${r.notes ? `\n${r.notes}` : ""}`;
  }

  if (request.type === "Time au Lieu") {
    const r = request as any;
    return `Time au Lieu\n${r.numberOfDays} days${r.note ? `\n${r.note}` : ""}`;
  }

  return (request as EmployeeRequest).type;
}

function getRequestAmount(request: EmployeeRequest): number {
  if (request.type === "Leave") return 0;
  if (request.type === "Time au Lieu") return 0;
  // For Addition, Deduction, and Advance types
  if ("amount" in request) {
    const amount = (request as any).amount;
    return typeof amount === "string" ? parseFloat(amount) || 0 : amount || 0;
  }
  return 0;
}

function getRequestPeriod(request: EmployeeRequest): string {
  // For Addition, Deduction, and Advance - use the period field directly
  if (request.type === "Addition" || request.type === "Deduction") {
    const period = (request as any).period;
    if (period) return period;
  }

  if (request.type === "Advance") {
    const startOfPaymentPeriod = (request as any).startOfPaymentPeriod;
    if (startOfPaymentPeriod) return startOfPaymentPeriod;
  }

  // For Leave and Time au Lieu - calculate from dates
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
      const startLabel = formatSystemMonthYear(startDate).split(" ")[0];
      const endLabel = formatSystemMonthYear(endDate).split(" ")[0];
      return `${startLabel}-${endLabel} ${startDate.getFullYear()}`;
    }
    const startLabel = formatSystemMonthYear(startDate);
    const endLabel = formatSystemMonthYear(endDate);
    return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
  }

  if (startDate && !Number.isNaN(startDate.getTime())) {
    return formatSystemMonthYear(startDate);
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
  const formatted = requests.value.map((request) => ({
    id: request.id,
    type: request.type,
    description: getRequestDescription(request),
    date: (() => {
      const d = getRequestDateValue(request);
      return d
        ? formatSystemDate(d)
        : "-";
    })(),
    dateValue: getRequestDateValue(request),
    monthYear: (() => {
      const d = getRequestDateValue(request);
      return d ? formatSystemMonthYear(d) : "No Date";
    })(),
    amount: getRequestAmount(request),
    period: getRequestPeriod(request),
    status: request.status,
    rawData: request,
  }));
  console.log("✨ FORMATTED REQUESTS:", formatted.length, formatted);
  return formatted;
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
      const requestMonth = formatSystemMonthYear(r.dateValue);
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

  console.log("🔍 FILTERED REQUESTS:", filtered.length, "Active filters:", {
    status: selectedStatus.value,
    type: selectedType.value,
    month: selectedMonth.value,
    search: searchQuery.value,
  });
  return filtered;
});

// Sorting - VDataTable will handle pagination
const sortedRequests = computed(() => {
  const list = [...filteredRequests.value];

  // No explicit sort by header -> default to DATE desc
  if (!sortBy.value) {
    list.sort((a, b) => {
      const aDate = a.dateValue ? a.dateValue.getTime() : 0;
      const bDate = b.dateValue ? b.dateValue.getTime() : 0;
      return bDate - aDate;
    });
  } else {
    const key = sortBy.value;
    const direction = orderBy.value === "desc" ? -1 : 1;

    list.sort((a, b) => {
      let aVal: any = (a as any)[key];
      let bVal: any = (b as any)[key];

      // special handling for date and amount
      if (key === "date") {
        aVal = a.dateValue ? a.dateValue.getTime() : 0;
        bVal = b.dateValue ? b.dateValue.getTime() : 0;
      }

      if (key === "amount") {
        aVal = Number(a.amount || 0);
        bVal = Number(b.amount || 0);
      }

      // normalize strings
      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();

      if (aVal > bVal) return 1 * direction;
      if (aVal < bVal) return -1 * direction;
      return 0;
    });
  }

  console.log("📅 SORTED REQUESTS:", list.length, {
    sortBy: sortBy.value,
    orderBy: orderBy.value,
  });

  // Check for month groupings
  const monthGroups = new Map();
  list.forEach((req) => {
    const count = monthGroups.get(req.monthYear) || 0;
    monthGroups.set(req.monthYear, count + 1);
  });
  // (monthGroups already computed from 'list' above)
  console.log(
    "📊 MONTH GROUPS:",
    Array.from(monthGroups.entries()).map(
      ([month, count]) => `${month}: ${count} items`
    )
  );

  return list;
});

const totalRequests = computed(() => filteredRequests.value.length);

// Available months for filter
const availableMonths = computed(() => {
  const months = new Set<string>();
  formattedRequests.value.forEach((r) => {
    if (!r.dateValue) return;
    const month = formatSystemMonthYear(r.dateValue);
    months.add(month);
  });
  return Array.from(months).sort((a, b) => {
    const dateA = new Date(`01 ${a}`);
    const dateB = new Date(`01 ${b}`);
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

// Capture table header clicks (Vuetify emits update:options)
const updateOptions = (options: any) => {
  // options.sortBy is an array like [{ key: 'date', order: 'desc' }]
  sortBy.value = options.sortBy?.[0]?.key;
  orderBy.value = options.sortBy?.[0]?.order;
  // whenever sorting changes, return to first page
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

defineExpose({
  openLeaveDrawer: openAddLeaveDrawer,
});
</script>

<template>
  <section>
    <div class="requests-stack">
      <div class="table-block">
        <VRow>
          <VCol cols="12">
            <VCard>
              <VCardText>
                <VRow>
                  <VCol cols="12" sm="4">
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

                  <VCol cols="12" sm="4">
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

                  <VCol cols="12" sm="4">
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
                        <VListItem @click="openAddDeductionDrawer">
                          <template #prepend>
                            <VIcon icon="tabler-minus" />
                          </template>
                          <VListItemTitle>Deductions</VListItemTitle>
                        </VListItem>
                        <VDivider />
                        <VListItem @click="openAddAdvancesDrawer">
                          <template #prepend>
                            <VIcon icon="tabler-cash" />
                          </template>
                          <VListItemTitle>Advances</VListItemTitle>
                        </VListItem>
                        <VDivider />
                        <VListItem @click="openAddTimeAuLieuDrawer">
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
              <VDataTableServer
                :items-per-page="-1"
                :headers="headers"
                :items="displayedItems"
                :items-length="totalDataItems"
                hide-default-footer
                class="text-no-wrap"
                :group-by="[]"
                @update:options="updateOptions"
              >
                <!-- Custom body rendering to support grouped pagination -->
                <template #body="{ items }">
                  <template v-for="row in items">
                    <tr
                      v-if="row.__isGroup"
                      :key="`group-${row.id}`"
                      class="request-group-header"
                    >
                      <td :colspan="headers.length" class="py-3">
                        <span class="text-body-1 font-weight-medium">{{
                          row.value
                        }}</span>
                      </td>
                    </tr>

                    <tr v-else :key="`row-${row.id}`">
                      <!-- DESCRIPTION -->
                      <td>
                        <div class="d-flex align-center gap-3 py-3">
                          <VAvatar size="34" variant="tonal">
                            <VIcon :icon="getTypeIcon(row.type)" size="20" />
                          </VAvatar>
                          <div>
                            <div
                              class="text-sm"
                              style="line-height: 1.5; white-space: pre-line"
                            >
                              {{ row.description }}
                            </div>
                          </div>
                        </div>
                      </td>

                      <!-- DATE -->
                      <td>{{ row.date }}</td>

                      <!-- AMOUNT -->
                      <td>
                        <span v-if="row.amount > 0">{{
                          row.amount.toLocaleString()
                        }}</span>
                        <span v-else class="text-disabled">-</span>
                      </td>

                      <!-- PERIOD -->
                      <td>{{ row.period }}</td>

                      <!-- STATUS -->
                      <td>
                        <VChip
                          :color="getStatusColor(row.status)"
                          size="small"
                          class="text-capitalize"
                        >
                          {{ row.status }}
                        </VChip>
                      </td>

                      <!-- ACTIONS -->
                      <td>
                        <template v-if="row.type === 'Leave'">
                          <IconBtn @click.stop="openEditLeave(row.rawData)">
                            <VIcon icon="tabler-edit" />
                          </IconBtn>
                        </template>

                        <template v-if="row.type === 'Addition'">
                          <IconBtn @click.stop="openEditAddition(row.rawData)">
                            <VIcon icon="tabler-edit" />
                          </IconBtn>
                        </template>

                        <template v-if="row.type === 'Deduction'">
                          <IconBtn @click.stop="openEditDeduction(row.rawData)">
                            <VIcon icon="tabler-edit" />
                          </IconBtn>
                        </template>

                        <template v-if="row.type === 'Advance'">
                          <IconBtn @click.stop="openEditAdvance(row.rawData)">
                            <VIcon icon="tabler-edit" />
                          </IconBtn>
                        </template>

                        <template v-if="row.type === 'Time au Lieu'">
                          <IconBtn
                            @click.stop="openEditTimeAuLieu(row.rawData)"
                          >
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

                              <VListItem @click="deleteRequest(row.id)">
                                <template #prepend>
                                  <VIcon color="error" icon="tabler-trash" />
                                </template>
                                <VListItemTitle>Delete</VListItemTitle>
                              </VListItem>
                            </VList>
                          </VMenu>
                        </IconBtn>
                      </td>
                    </tr>
                  </template>
                </template>

                <!-- (custom body renders rows including description, amount, status and actions) -->
              </VDataTableServer>

              <VDivider />

              <!-- Pagination -->
              <VCardText
                class="d-flex align-center flex-wrap justify-end gap-4 pa-4"
              >
                <div class="d-flex align-center gap-2">
                  <div class="text-sm text-disabled">
                    <template v-if="itemsPerPage > 0">
                      {{ (page - 1) * itemsPerPage + 1 }}-{{
                        Math.min(page * itemsPerPage, totalDataItems)
                      }}
                      of {{ totalDataItems }}
                    </template>
                    <template v-else>
                      1-{{ totalDataItems }} of {{ totalDataItems }}
                    </template>
                  </div>
                </div>

                <VPagination
                  v-model="page"
                  :length="
                    itemsPerPage > 0
                      ? Math.ceil(totalDataItems / itemsPerPage)
                      : 1
                  "
                  :total-visible="5"
                />
              </VCardText>
            </VCard>
          </VCol>
        </VRow>
      </div>

      <div class="cards-block">
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
      </div>
    </div>

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

    <!-- Add / Edit Deduction Drawer -->
    <VOverlay
      v-model="isAddDeductionOpen"
      class="add-deduction-scrim"
      scrim="rgba(17, 24, 39, 0.72)"
      :z-index="1995"
    />
    <AddDeductionDrawer
      v-model:is-drawer-open="isAddDeductionOpen"
      :deduction-data="selectedDeductionData"
      @submit="handleAddDeduction"
      @close="selectedDeductionData = null"
    />

    <!-- Add / Edit Advances Drawer -->
    <VOverlay
      v-model="isAddAdvancesOpen"
      class="add-advances-scrim"
      scrim="rgba(17, 24, 39, 0.72)"
      :z-index="1995"
    />
    <AddAdvancesDrawer
      v-model:is-drawer-open="isAddAdvancesOpen"
      :advance-data="selectedAdvanceData"
      @submit="handleAddAdvance"
      @close="selectedAdvanceData = null"
    />

    <!-- Add / Edit Time au Lieu Drawer -->
    <VOverlay
      v-model="isAddTimeAuLieuOpen"
      class="add-time-au-lieu-scrim"
      scrim="rgba(17, 24, 39, 0.72)"
      :z-index="1995"
    />
    <AddTimeAuLieuDrawer
      v-model:is-drawer-open="isAddTimeAuLieuOpen"
      :time-au-lieu-data="selectedTimeAuLieuData"
      @submit="handleAddTimeAuLieu"
      @close="selectedTimeAuLieuData = null"
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
.requests-stack {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.table-block {
  order: 1;
}

.cards-block {
  order: 2;
}

@media (min-width: 960px) {
  .requests-stack {
    gap: 2rem;
  }

  .table-block {
    order: 2;
  }

  .cards-block {
    order: 1;
  }
}

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

.add-deduction-scrim {
  inset-inline-end: 400px;
}

.add-deduction-scrim :deep(.v-overlay__scrim) {
  inset-inline-end: 400px;
}

.add-advances-scrim {
  inset-inline-end: 400px;
}

.add-advances-scrim :deep(.v-overlay__scrim) {
  inset-inline-end: 400px;
}

.add-time-au-lieu-scrim {
  inset-inline-end: 400px;
}

.add-time-au-lieu-scrim :deep(.v-overlay__scrim) {
  inset-inline-end: 400px;
}
</style>
