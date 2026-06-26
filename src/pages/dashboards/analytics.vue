<script setup lang="ts">
import AddAdditionsDrawer from "@/views/apps/hr/view/AddAdditionsDrawer.vue";
import AddAdvancesDrawer from "@/views/apps/hr/view/AddAdvancesDrawer.vue";
import AddDeductionDrawer from "@/views/apps/hr/view/AddDeductionDrawer.vue";
import AddLeaveDrawer from "@/views/apps/hr/view/AddLeaveDrawer.vue";
import AddTimeAuLieuDrawer from "@/views/apps/hr/view/AddTimeAuLieuDrawer.vue";
import { useEmployeesStore } from "@/stores/employees";
import { useNotificationsStore } from "@/stores/notifications";
import { usePeopleStore } from "@/stores/people";
import { useTodos } from "@/stores/todos";
import { getSignedInIdentity } from "@/utils/currentAccount";
import customCheck from "@images/svg/Check.svg";
import customLaptop from "@images/svg/laptop.svg";
import customLightbulb from "@images/svg/lightbulb.svg";

type DashboardRequestType = "Addition" | "Deduction" | "Advance" | "Time au Lieu";
const requestTypes: DashboardRequestType[] = [
  "Addition",
  "Deduction",
  "Advance",
  "Time au Lieu",
];

const donutChartColors = {
  donut: {
    series1: "#22A95E",
    series2: "#24B364",
    series3: "#56CA00",
    series4: "#53D28C",
    series5: "#7EDDA9",
    series6: "#A9E9C5",
  },
};

const todosStore = useTodos();
const peopleStore = usePeopleStore();
const employeesStore = useEmployeesStore();
const notifications = useNotificationsStore();

todosStore.init();
peopleStore.init();
employeesStore.init();

const isLeaveDrawerOpen = ref(false);
const isRequestPickerOpen = ref(false);
const isAdditionDrawerOpen = ref(false);
const isDeductionDrawerOpen = ref(false);
const isAdvanceDrawerOpen = ref(false);
const isTimeAuLieuDrawerOpen = ref(false);

const selectedLeaveData = ref(null);
const selectedAdditionData = ref(null);
const selectedDeductionData = ref(null);
const selectedAdvanceData = ref(null);
const selectedTimeAuLieuData = ref(null);

const identity = computed(() => getSignedInIdentity());

const normalizeKey = (value: unknown) =>
  value === undefined || value === null || value === ""
    ? ""
    : String(value).trim().toLowerCase();

const addIdentityValue = (set: Set<string>, value: unknown) => {
  const key = normalizeKey(value);
  if (key) set.add(key);
};

const collectRefKeys = (value: any, set = new Set<string>()) => {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectRefKeys(entry, set));

    return set;
  }

  if (value && typeof value === "object") {
    [
      value.id,
      value.value,
      value.employeeId,
      value.personId,
      value.contactId,
      value.accountId,
      value.email,
      value.name,
      value.fullName,
      value.title,
      value.username,
    ].forEach((entry) => addIdentityValue(set, entry));

    return set;
  }

  addIdentityValue(set, value);

  return set;
};

const currentPerson = computed(() => {
  const signedIn = identity.value;
  const directCandidates = [
    signedIn.employeeId,
    signedIn.personId,
    signedIn.id,
    signedIn.accountId,
  ]
    .map((entry) => normalizeKey(entry))
    .filter(Boolean);

  return (
    peopleStore.hrPeople.find((person: any) =>
      [
        person.id,
        person.employeeId,
        person.personId,
        person.legacyEmployeeId,
      ]
        .map((entry) => normalizeKey(entry))
        .some((entry) => directCandidates.includes(entry)),
    ) ??
    peopleStore.hrPeople.find((person: any) => {
      const email = normalizeKey(signedIn.email);
      const name = normalizeKey(signedIn.name);

      return (
        (email && normalizeKey(person.email) === email) ||
        (name &&
          [person.name, person.fullName].map((entry) => normalizeKey(entry)).includes(name))
      );
    }) ??
    null
  );
});

const currentEmployee = computed(() => {
  const id =
    currentPerson.value?.id ??
    identity.value.employeeId ??
    identity.value.personId ??
    identity.value.id;

  return id ? employeesStore.byId(id) : null;
});

const currentUserKeys = computed(() => {
  const keys = new Set<string>();
  const signedIn = identity.value;

  [
    signedIn.id,
    signedIn.accountId,
    signedIn.employeeId,
    signedIn.personId,
    signedIn.email,
    signedIn.name,
    currentPerson.value?.id,
    currentPerson.value?.legacyEmployeeId,
    currentPerson.value?.email,
    (currentPerson.value as any)?.name,
    currentPerson.value?.fullName,
  ].forEach((entry) => addIdentityValue(keys, entry));

  return keys;
});

const directReports = computed(() => {
  const managerKeys = currentUserKeys.value;

  return peopleStore.hrPeople.filter((person: any) =>
    (person.hrProfile?.employment?.reportToIds ?? []).some((managerId: any) =>
      managerKeys.has(normalizeKey(managerId)),
    ),
  );
});

const dashboardPeople = computed(() => {
  const byId = new Map<string, any>();
  if (currentPerson.value) byId.set(String(currentPerson.value.id), currentPerson.value);
  directReports.value.forEach((person: any) => byId.set(String(person.id), person));

  return [...byId.values()];
});

const canSeeTeam = computed(() => directReports.value.length > 0);

const scopedIdentityKeys = computed(() => {
  const keys = new Set(currentUserKeys.value);

  if (canSeeTeam.value) {
    directReports.value.forEach((person: any) => {
      [
        person.id,
        person.legacyEmployeeId,
        person.employeeId,
        person.personId,
        person.email,
        person.name,
        person.fullName,
      ].forEach((entry) => addIdentityValue(keys, entry));
    });
  }

  return keys;
});

const matchesScope = (value: any, keys = scopedIdentityKeys.value) => {
  const valueKeys = collectRefKeys(value);

  return [...valueKeys].some((key) => keys.has(key));
};

const taskBelongsToScope = (task: any) =>
  [
    task.assignedTo,
    task.assignees,
    task.assigned,
    task.collaborators,
    task.owner,
    task.ownerId,
    task.employeeId,
    task.createdBy,
    task.requestedBy,
    task.author,
  ].some((entry) => matchesScope(entry));

const meetingBelongsToScope = (meeting: any) =>
  [
    meeting.linkedTo,
    meeting.attendees,
    meeting.collaborators,
    meeting.requestedBy,
    meeting.createdBy,
    meeting.author,
  ].some((entry) => matchesScope(entry));

const localDateKey = (value: any) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const todayKey = computed(() => localDateKey(new Date()));

const dateValue = (entry: any) =>
  entry?.dueAt ?? entry?.dueDate ?? entry?.date ?? entry?.startAt ?? "";

const isToday = (value: any) => localDateKey(value) === todayKey.value;

const isBeforeToday = (value: any) => {
  const key = localDateKey(value);

  return Boolean(key && key < todayKey.value);
};

const isTaskCompleted = (task: any) =>
  task?.status === "completed" ||
  task?.status === "Completed" ||
  task?.completed === true ||
  task?.isCompleted === true ||
  Boolean(task?.completedAt);

const isMeetingCompleted = (meeting: any) =>
  meeting?.status === "completed" ||
  meeting?.status === "COMPLETED" ||
  Boolean(meeting?.completedAt) ||
  Boolean(meeting?.mom?.completedAt);

const isMeetingCanceled = (meeting: any) => {
  const status = normalizeKey(meeting?.status);

  return status === "canceled" || status === "cancelled";
};

const scopedTasks = computed(() => todosStore.all.filter((task: any) => taskBelongsToScope(task)));

const scopedMeetings = computed(() =>
  todosStore.meetingsAll.filter((meeting: any) => meetingBelongsToScope(meeting)),
);

const scopedRequests = computed(() =>
  dashboardPeople.value.flatMap((person: any) => {
    const employee =
      employeesStore.byId(person.id) ??
      (person.legacyEmployeeId ? employeesStore.byId(person.legacyEmployeeId) : null) ??
      person;

    return (employee.requests ?? []).map((request: any) => ({
      ...request,
      employeeId: employee.id ?? person.id,
      employeeName:
        employee.fullName ??
        (employee as any).name ??
        person.fullName ??
        person.name ??
        "Employee",
    }));
  }),
);

const todaysTasks = computed(() =>
  scopedTasks.value.filter((task: any) => isToday(dateValue(task))),
);

const openTodaysTasks = computed(() =>
  todaysTasks.value.filter((task: any) => !isTaskCompleted(task)),
);

const overdueTasks = computed(() =>
  scopedTasks.value.filter(
    (task: any) => !isTaskCompleted(task) && isBeforeToday(dateValue(task)),
  ),
);

const todaysMeetings = computed(() =>
  scopedMeetings.value.filter(
    (meeting: any) => isToday(meeting.startAt) && !isMeetingCanceled(meeting),
  ),
);

const completedTodaysMeetings = computed(() =>
  todaysMeetings.value.filter((meeting: any) => isMeetingCompleted(meeting)),
);

const completionPercent = computed(() => {
  const tasks = scopedTasks.value;
  const meetings = scopedMeetings.value.filter((meeting: any) => !isMeetingCanceled(meeting));
  const total = tasks.length + meetings.length;
  if (!total) return 0;

  const completed =
    tasks.filter((task: any) => isTaskCompleted(task)).length +
    meetings.filter((meeting: any) => isMeetingCompleted(meeting)).length;

  return Math.round((completed / total) * 100);
});

const firstName = computed(() => {
  const name =
    (currentPerson.value as any)?.name ??
    currentPerson.value?.fullName ??
    identity.value.name ??
    "User";

  return String(name).trim().split(/\s+/)[0] || "User";
});

const statCards = computed(() => [
  {
    title: "Today's Tasks",
    value: `${openTodaysTasks.value.length}/${todaysTasks.value.length}`,
    hint:
      overdueTasks.value.length > 0
        ? `${overdueTasks.value.length} overdue`
        : "No overdue tasks",
    icon: customLaptop,
    color: "primary",
  },
  {
    title: "Today's Meetings",
    value: String(todaysMeetings.value.length),
    hint: `${completedTodaysMeetings.value.length} completed`,
    icon: customLightbulb,
    color: "info",
  },
  {
    title: "Requests",
    value: String(scopedRequests.value.length),
    hint: canSeeTeam.value ? "Own + team" : "Own",
    icon: customCheck,
    color: "warning",
  },
]);

const totalActivities = computed(
  () => scopedTasks.value.length + scopedMeetings.value.length + scopedRequests.value.length,
);

const donutSeries = computed(() => {
  const todayCount = openTodaysTasks.value.length;
  const outstandingCount = overdueTasks.value.length;
  if (todayCount + outstandingCount <= 0) return [1];

  return [todayCount, outstandingCount];
});

const donutLabels = computed(() =>
  openTodaysTasks.value.length + overdueTasks.value.length <= 0
    ? ["No to-dos"]
    : ["Today's To Dos", "Outstanding To Dos"],
);

const timeSpendingChartConfig = computed(() => ({
  chart: {
    height: 157,
    width: 130,
    parentHeightOffset: 0,
    type: "donut",
  },
  labels: donutLabels.value,
  colors: [
    donutChartColors.donut.series1,
    donutChartColors.donut.series2,
    donutChartColors.donut.series3,
    donutChartColors.donut.series4,
    donutChartColors.donut.series5,
    donutChartColors.donut.series6,
  ],
  stroke: { width: 0 },
  dataLabels: { enabled: false },
  legend: { show: false },
  tooltip: {
    theme: false,
    y: {
      formatter: (value: number) => `${Math.round(value)} to-dos`,
    },
  },
  grid: { padding: { top: 0 } },
  plotOptions: {
    pie: {
      donut: {
        size: "75%",
        labels: {
          show: true,
          value: {
            fontSize: "1.125rem",
            color: "rgba(var(--v-theme-on-background), var(--v-high-emphasis-opacity))",
            fontWeight: 500,
            offsetY: -15,
            formatter: () => `${completionPercent.value}%`,
          },
          name: { offsetY: 20 },
          total: {
            show: true,
            fontSize: "15px",
            label: "Completed",
            color: "rgba(var(--v-theme-on-background), var(--v-disabled-opacity))",
            formatter: () => `${completionPercent.value}%`,
          },
        },
      },
    },
  },
}));

const employeeRequestTarget = computed(() => {
  const employee =
    currentEmployee.value ??
    (currentPerson.value?.id ? employeesStore.byId(currentPerson.value.id) : null);

  return employee;
});

const currentEmployeeName = computed(
  () =>
    employeeRequestTarget.value?.fullName ??
    (employeeRequestTarget.value as any)?.name ??
    identity.value.name ??
    "",
);

const currentEmployeeAvailableDays = computed(
  () => Number(employeeRequestTarget.value?.attendance?.vacation ?? 0),
);

const addCurrentEmployeeRequest = (type: string, payload: any) => {
  const employee = employeeRequestTarget.value;
  if (!employee?.id) {
    notifications.push("Could not find current employee profile", "error", 3500);

    return;
  }

  const created = employeesStore.addRequest(employee.id, {
    ...payload,
    type,
    createdAt: new Date().toISOString(),
    status: "pending",
  });

  if (created) notifications.push(`${type} request submitted`, "success", 3500);
  else notifications.push(`Could not submit ${type.toLowerCase()} request`, "error", 3500);
};

const submitLeave = (payload: any) => {
  addCurrentEmployeeRequest("Leave", payload);
  selectedLeaveData.value = null;
  isLeaveDrawerOpen.value = false;
};

const submitAddition = (payload: any) => {
  addCurrentEmployeeRequest("Addition", payload);
  selectedAdditionData.value = null;
  isAdditionDrawerOpen.value = false;
};

const submitDeduction = (payload: any) => {
  addCurrentEmployeeRequest("Deduction", payload);
  selectedDeductionData.value = null;
  isDeductionDrawerOpen.value = false;
};

const submitAdvance = (payload: any) => {
  addCurrentEmployeeRequest("Advance", payload);
  selectedAdvanceData.value = null;
  isAdvanceDrawerOpen.value = false;
};

const submitTimeAuLieu = (payload: any) => {
  addCurrentEmployeeRequest("Time au Lieu", payload);
  selectedTimeAuLieuData.value = null;
  isTimeAuLieuDrawerOpen.value = false;
};

const openRequestDrawer = (type: DashboardRequestType) => {
  isRequestPickerOpen.value = false;
  selectedAdditionData.value = null;
  selectedDeductionData.value = null;
  selectedAdvanceData.value = null;
  selectedTimeAuLieuData.value = null;

  if (type === "Addition") isAdditionDrawerOpen.value = true;
  if (type === "Deduction") isDeductionDrawerOpen.value = true;
  if (type === "Advance") isAdvanceDrawerOpen.value = true;
  if (type === "Time au Lieu") isTimeAuLieuDrawerOpen.value = true;
};

</script>

<template>
  <div>
    <VRow class="py-6">
      <VCol
        cols="12"
        md="8"
        :class="$vuetify.display.mdAndUp ? 'border-e' : 'border-b'"
      >
        <div class="pe-3">
            <div class="d-flex flex-wrap justify-space-between gap-4">
              <div>
                <h5 class="text-h5 mb-2">
                  Welcome back,<span class="text-h4"> {{ firstName }} 👋🏻 </span>
                </h5>

                <div
                  class="text-wrap text-body-1"
                  style="max-inline-size: 420px;"
                >
                  {{ canSeeTeam ? "Your team dashboard for today." : "Your operational dashboard for today." }}
                </div>
              </div>

              <div class="d-flex flex-wrap gap-3 align-start">
                <VBtn
                  color="primary"
                  prepend-icon="tabler-calendar-plus"
                  @click="isLeaveDrawerOpen = true"
                >
                  Leave Requests
                </VBtn>
                <VBtn
                  color="secondary"
                  variant="tonal"
                  prepend-icon="tabler-forms"
                  @click="isRequestPickerOpen = true"
                >
                  Other Requests
                </VBtn>
              </div>
            </div>

            <div class="d-flex justify-space-between flex-wrap gap-4 mt-5">
              <div
                v-for="stat in statCards"
                :key="stat.title"
                class="dashboard-stat"
              >
                <div class="d-flex align-center">
                  <VAvatar
                    variant="tonal"
                    :color="stat.color"
                    rounded
                    size="54"
                    class="me-4"
                  >
                    <VIcon
                      :icon="stat.icon"
                      size="34"
                    />
                  </VAvatar>
                  <div>
                    <h6 class="text-h6 text-medium-emphasis">
                      {{ stat.title }}
                    </h6>
                    <div class="d-flex align-end gap-2">
                      <h4
                        class="text-h4"
                        :class="`text-${stat.color}`"
                      >
                        {{ stat.value }}
                      </h4>
                      <span class="text-caption text-medium-emphasis pb-1">
                        {{ stat.hint }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
      </VCol>

      <VCol
        cols="12"
        md="4"
      >
        <div class="d-flex justify-space-between align-center">
          <div class="d-flex flex-column ps-3">
            <h5 class="text-h5 mb-1 text-no-wrap">
              Total Activities
            </h5>
            <div class="text-body-1 mb-7">
              Tasks, meetings, requests
            </div>
            <h4 class="text-h4 mb-2">
              {{ totalActivities }}
            </h4>
            <div>
              <VChip
                color="success"
                label
                size="small"
              >
                {{ completionPercent }}% completed
              </VChip>
            </div>
          </div>
          <div>
            <VueApexCharts
              type="donut"
              height="150"
              width="150"
              :options="timeSpendingChartConfig"
              :series="donutSeries"
            />
          </div>
        </div>
      </VCol>
    </VRow>

    <VDialog
      v-model="isRequestPickerOpen"
      max-width="520"
    >
      <VCard>
        <VCardItem>
          <VCardTitle>Other Requests</VCardTitle>
          <VCardSubtitle>Select a request type for {{ currentEmployeeName || "current user" }}.</VCardSubtitle>
        </VCardItem>
        <VCardText>
          <VRow>
            <VCol
              v-for="requestType in requestTypes"
              :key="requestType"
              cols="12"
              sm="6"
            >
              <VBtn
                block
                variant="tonal"
                color="primary"
                @click="openRequestDrawer(requestType)"
              >
                {{ requestType }}
              </VBtn>
            </VCol>
          </VRow>
        </VCardText>
      </VCard>
    </VDialog>

    <VOverlay
      v-model="isLeaveDrawerOpen"
      scrim="rgba(17, 24, 39, 0.72)"
      :z-index="1995"
    />
    <AddLeaveDrawer
      v-model:is-drawer-open="isLeaveDrawerOpen"
      :employee-name="currentEmployeeName"
      :available-days="currentEmployeeAvailableDays"
      :leave-data="selectedLeaveData"
      @submit="submitLeave"
      @close="selectedLeaveData = null"
    />

    <VOverlay
      v-model="isAdditionDrawerOpen"
      scrim="rgba(17, 24, 39, 0.72)"
      :z-index="1995"
    />
    <AddAdditionsDrawer
      v-model:is-drawer-open="isAdditionDrawerOpen"
      :addition-data="selectedAdditionData"
      @submit="submitAddition"
      @close="selectedAdditionData = null"
    />

    <VOverlay
      v-model="isDeductionDrawerOpen"
      scrim="rgba(17, 24, 39, 0.72)"
      :z-index="1995"
    />
    <AddDeductionDrawer
      v-model:is-drawer-open="isDeductionDrawerOpen"
      :deduction-data="selectedDeductionData"
      @submit="submitDeduction"
      @close="selectedDeductionData = null"
    />

    <VOverlay
      v-model="isAdvanceDrawerOpen"
      scrim="rgba(17, 24, 39, 0.72)"
      :z-index="1995"
    />
    <AddAdvancesDrawer
      v-model:is-drawer-open="isAdvanceDrawerOpen"
      :advance-data="selectedAdvanceData"
      @submit="submitAdvance"
      @close="selectedAdvanceData = null"
    />

    <VOverlay
      v-model="isTimeAuLieuDrawerOpen"
      scrim="rgba(17, 24, 39, 0.72)"
      :z-index="1995"
    />
    <AddTimeAuLieuDrawer
      v-model:is-drawer-open="isTimeAuLieuDrawerOpen"
      :time-au-lieu-data="selectedTimeAuLieuData"
      @submit="submitTimeAuLieu"
      @close="selectedTimeAuLieuData = null"
    />
  </div>
</template>

<style lang="scss">
@use "@core/scss/template/libs/apex-chart.scss";

.dashboard-stat {
  min-inline-size: 210px;
}
</style>
