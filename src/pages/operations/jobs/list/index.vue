<script setup lang="ts">
import { computed, ref, watch } from "vue";

import type { JobProperties } from "@/plugins/fake-api/handlers/operations/jobs/types";
import { useContactsStore } from "@/stores/contacts";
import { useJobsStore } from "@/stores/jobs";
import { useNotificationsStore } from "@/stores/notifications";
import AddJobDialog from "@/views/operations/jobs/list/AddJobDialog.vue";
import JobEditDialog from "@/views/operations/jobs/list/JobEditDialog.vue";

type SortKey = "name" | "createdAt" | "stage" | "type" | "flag";
type SortOrder = "asc" | "desc";

type DecoratedStakeholder = {
  id: number;
  name: string;
  role: string;
  avatar: string | null;
  isPrimary: boolean;
};

const jobsStore = useJobsStore();
jobsStore.init();

const contactsStore = useContactsStore();
contactsStore.init();

const notifications = useNotificationsStore();

const searchQuery = ref("");
const selectedStage = ref<string | undefined>();
const selectedType = ref<string | undefined>();
const selectedFlag = ref<string | undefined>();

const sortOptions: {
  title: string;
  value: { key: SortKey; order: SortOrder };
}[] = [
  { title: "Name (A-Z)", value: { key: "name", order: "asc" } },
  { title: "Name (Z-A)", value: { key: "name", order: "desc" } },
  { title: "Recently Added", value: { key: "createdAt", order: "desc" } },
  { title: "Oldest", value: { key: "createdAt", order: "asc" } },
];

const selectedSort = ref(sortOptions[2].value);
const itemsPerPage = ref(15);
const page = ref(1);
const sortBy = ref<SortKey | undefined>(selectedSort.value?.key);
const orderBy = ref<SortOrder | undefined>(selectedSort.value?.order);
const selectedRows = ref<number[]>([]);

const headers = [
  { title: "Project", key: "project" },
  { title: "Stage", key: "stage" },
  { title: "Type", key: "type" },
  { title: "Flag", key: "flag" },
  { title: "Stakeholders", key: "stakeholders", sortable: false },
  { title: "Actions", key: "actions", sortable: false },
];

const stageOptions = [
  { title: "PRPSL", value: "PRPSL" },
  { title: "In Review", value: "In Review" },
  { title: "Project | In Progress", value: "Project | In Progress" },
  { title: "RFI", value: "RFI" },
];

const typeOptions = [
  { title: "Architecture", value: "Architecture" },
  { title: "Interior", value: "Interior" },
  { title: "Architecture & Interior", value: "Architecture & Interior" },
  { title: "Stands & Events", value: "Stands & Events" },
  { title: "Master Plan", value: "Master Plan" },
  { title: "Full Scope", value: "Full Scope" },
  { title: "Internal", value: "Internal" },
  { title: "Other", value: "Other" },
];

const flagOptions = [
  { title: "Low", value: "Low" },
  { title: "Normal", value: "Normal" },
  { title: "High", value: "High" },
];

watch(selectedSort, (value) => {
  sortBy.value = value?.key;
  orderBy.value = value?.order;
  page.value = 1;
});

watch([selectedStage, selectedType, selectedFlag, searchQuery], () => {
  page.value = 1;
});

const cloneJob = (job: JobProperties) => {
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(job);
    } catch (error) {
      console.warn("structuredClone failed for job clone", error);
    }
  }

  try {
    return JSON.parse(JSON.stringify(job)) as JobProperties;
  } catch (error) {
    console.warn("JSON clone failed for job", error);
    return { ...job };
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

const contactDirectory = computed(() => {
  const map = new Map<number, { name: string; picture: string | null }>();
  contactsStore.all.forEach((contact) => {
    if (contact?.id === null || contact?.id === undefined) return;
    map.set(Number(contact.id), {
      name: contact.fullName,
      picture: contact.picture || null,
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

const normalizedSearch = computed(() => searchQuery.value.trim().toLowerCase());

const matchesFilters = (job: JobProperties) => {
  const query = normalizedSearch.value;
  if (query) {
    const haystack = [job.name, job.code, job.location]
      .filter(Boolean)
      .map((value) => value!.toString().toLowerCase());

    const hasMatch = haystack.some((value) => value.includes(query));
    if (!hasMatch) return false;
  }

  if (selectedStage.value && job.stage !== selectedStage.value) return false;
  if (selectedType.value && job.type !== selectedType.value) return false;
  if (selectedFlag.value && job.flag !== selectedFlag.value) return false;

  return true;
};

const normalizeSortValue = (job: JobProperties, key?: SortKey) => {
  switch (key) {
    case "name":
      return job.name?.toLowerCase() ?? "";
    case "stage":
      return job.stage ?? "";
    case "type":
      return job.type ?? "";
    case "flag":
      return job.flag ?? "";
    case "createdAt":
    default:
      return job.createdAt ?? "";
  }
};

const compareJobs = (a: JobProperties, b: JobProperties) => {
  const key = sortBy.value ?? "createdAt";
  const order = orderBy.value ?? "desc";

  const aValue = normalizeSortValue(a, key);
  const bValue = normalizeSortValue(b, key);

  if (key === "createdAt") {
    const aDate = aValue ? new Date(aValue).getTime() : 0;
    const bDate = bValue ? new Date(bValue).getTime() : 0;
    return order === "asc" ? aDate - bDate : bDate - aDate;
  }

  const diff = String(aValue).localeCompare(String(bValue));
  return order === "asc" ? diff : -diff;
};

const filteredJobs = computed<JobProperties[]>(() =>
  jobsStore.all.map((job) => cloneJob(job)).filter((job) => matchesFilters(job))
);

const sortedJobs = computed<JobProperties[]>(() => {
  const items = [...filteredJobs.value];
  if (items.length > 1) items.sort(compareJobs);
  return items;
});

const displayedJobs = computed<JobProperties[]>(() => {
  const results = sortedJobs.value;
  const start = (page.value - 1) * itemsPerPage.value;
  const end =
    itemsPerPage.value === -1 ? results.length : start + itemsPerPage.value;
  return results.slice(start, end);
});

const totalJobs = computed(() => sortedJobs.value.length);

const decorateStakeholders = (job: JobProperties): DecoratedStakeholder[] => {
  if (!Array.isArray(job.stakeholders)) return [];

  return job.stakeholders.map((stakeholder, index) => {
    const contact = stakeholder.contactId
      ? getContactEntry(stakeholder.contactId)
      : null;
    const name = contact?.name || stakeholder.role || "Unassigned";

    return {
      id: stakeholder.id,
      name,
      role: stakeholder.role || "--",
      avatar: contact?.picture || null,
      isPrimary: index === 0,
    };
  });
};

const resolveFlagColor = (flag: JobProperties["flag"]) => {
  switch (flag) {
    case "High":
      return "error";
    case "Low":
      return "secondary";
    case "Normal":
    default:
      return "primary";
  }
};

const jobAvatarColor = (flag: JobProperties["flag"]) => resolveFlagColor(flag);

const relatedContactName = (job: JobProperties) => {
  const entry = getContactEntry(job.relatedTo);
  return entry?.name ?? "--";
};

const isAddJobDialogVisible = ref(false);
const isJobEditDialogVisible = ref(false);
const selectedJob = ref<JobProperties | null>(null);
const dialogLoading = ref(false);
const dialogError = ref<string | null>(null);

const openEditDialog = (job: JobProperties) => {
  selectedJob.value = cloneJob(job);
  dialogError.value = null;
  isJobEditDialogVisible.value = true;
};

const addJob = (payload: Partial<JobProperties>) => {
  dialogLoading.value = true;
  try {
    jobsStore.addJob(payload);
    notifications.push("Job created", "success", 3000);
  } catch (error) {
    console.error("Failed to create job", error);
    notifications.push("Failed to create job", "error", 4000);
  } finally {
    dialogLoading.value = false;
  }
};

const updateJob = (payload: JobProperties) => {
  if (!payload?.id) return;
  dialogLoading.value = true;
  dialogError.value = null;

  try {
    const updated = jobsStore.updateJob(payload.id, payload);
    if (!updated) {
      dialogError.value = "Failed to save job";
      notifications.push("Unable to update job", "error", 4000);
      return;
    }

    notifications.push("Job updated", "success", 3000);
    isJobEditDialogVisible.value = false;
    selectedJob.value = null;
  } catch (error) {
    console.error("Failed to update job", error);
    dialogError.value = "An unexpected error occurred";
    notifications.push("Failed to update job", "error", 4000);
  } finally {
    dialogLoading.value = false;
  }
};

const isConfirmDeleteVisible = ref(false);
const deleteCandidateId = ref<number | null>(null);

const confirmDelete = (id: number) => {
  deleteCandidateId.value = id;
  isConfirmDeleteVisible.value = true;
};

const performDelete = () => {
  if (deleteCandidateId.value === null) return;

  jobsStore.removeJob(deleteCandidateId.value);

  const index = selectedRows.value.findIndex(
    (row) => row === deleteCandidateId.value
  );
  if (index !== -1) selectedRows.value.splice(index, 1);

  notifications.push("Job deleted", "success", 3000);
  deleteCandidateId.value = null;
  isConfirmDeleteVisible.value = false;
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
      option.value.key === sortBy.value && option.value.order === orderBy.value
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
        <VCardTitle>Jobs</VCardTitle>
      </VCardItem>

      <VCardText>
        <VRow>
          <VCol cols="12" md="3">
            <AppSelect
              v-model="selectedStage"
              placeholder="Select Stage"
              :items="stageOptions"
              clearable
              clear-icon="tabler-x"
            />
          </VCol>

          <VCol cols="12" md="3">
            <AppSelect
              v-model="selectedType"
              placeholder="Select Type"
              :items="typeOptions"
              clearable
              clear-icon="tabler-x"
            />
          </VCol>

          <VCol cols="12" md="3">
            <AppSelect
              v-model="selectedFlag"
              placeholder="Select Flag"
              :items="flagOptions"
              clearable
              clear-icon="tabler-x"
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
            <AppTextField v-model="searchQuery" placeholder="Search Jobs" />
          </div>

          <VBtn variant="tonal" color="secondary" prepend-icon="tabler-upload">
            Export
          </VBtn>

          <VBtn
            prepend-icon="tabler-plus"
            @click="isAddJobDialogVisible = true"
          >
            Add New Job
          </VBtn>
        </div>
      </VCardText>

      <VDivider />

      <VDataTableServer
        v-model:items-per-page="itemsPerPage"
        v-model:model-value="selectedRows"
        v-model:page="page"
        :items="displayedJobs"
        item-value="id"
        :items-length="totalJobs"
        :headers="headers"
        class="text-no-wrap"
        show-select
        @update:options="updateOptions"
      >
        <template #item.project="{ item }">
          <div class="d-flex align-center gap-x-4 py-2">
            <VAvatar
              size="40"
              :variant="!item.avatar ? 'tonal' : undefined"
              :color="!item.avatar ? jobAvatarColor(item.flag) : undefined"
            >
              <VImg v-if="item.avatar" :src="item.avatar" />
              <span v-else>{{ avatarText(item.name) }}</span>
            </VAvatar>

            <div class="d-flex flex-column gap-1">
              <h6 class="text-base d-flex align-center gap-1 mb-0">
                <VIcon icon="tabler-briefcase" size="16" color="primary" />
                <RouterLink
                  :to="{
                    name: 'operations-jobs-view-id',
                    params: { id: item.id },
                  }"
                  class="font-weight-medium text-link"
                >
                  {{ item.name }}
                </RouterLink>
              </h6>

              <div class="text-sm text-medium-emphasis">
                <span v-if="item.code">{{ item.code }}</span>
                <span v-if="item.code && item.location"> � </span>
                <span v-if="item.location">{{ item.location }}</span>
              </div>

              <div
                class="d-flex align-center gap-2 text-xs text-medium-emphasis"
              >
                <VAvatar
                  v-if="getContactEntry(item.relatedTo)"
                  size="24"
                  :variant="
                    getContactEntry(item.relatedTo)?.picture
                      ? undefined
                      : 'tonal'
                  "
                  :color="
                    getContactEntry(item.relatedTo)?.picture
                      ? undefined
                      : 'primary'
                  "
                  :class="
                    getContactEntry(item.relatedTo)?.picture
                      ? null
                      : 'text-white font-weight-medium'
                  "
                >
                  <template v-if="getContactEntry(item.relatedTo)?.picture">
                    <VImg
                      :src="getContactEntry(item.relatedTo)?.picture || ''"
                    />
                  </template>
                  <template v-else>
                    <span>{{ avatarText(relatedContactName(item)) }}</span>
                  </template>
                </VAvatar>
                <span>
                  Related:
                  <span class="text-high-emphasis">{{
                    relatedContactName(item)
                  }}</span>
                </span>
              </div>
            </div>
          </div>
        </template>

        <template #item.stage="{ item }">
          <VChip color="info" label size="small">{{ item.stage }}</VChip>
        </template>

        <template #item.type="{ item }">
          <span class="text-high-emphasis text-body-1">{{ item.type }}</span>
        </template>

        <template #item.flag="{ item }">
          <VChip :color="resolveFlagColor(item.flag)" size="small" label>
            {{ item.flag }}
          </VChip>
        </template>

        <template #item.stakeholders="{ item }">
          <div class="d-flex align-center gap-2">
            <div
              v-if="decorateStakeholders(item).length"
              class="v-avatar-group demo-avatar-group"
            >
              <VAvatar
                v-for="stakeholder in decorateStakeholders(item).slice(0, 3)"
                :key="`${item.id}-${stakeholder.id}`"
                :size="40"
                :color="!stakeholder.avatar ? 'primary' : undefined"
                :class="[
                  !stakeholder.avatar ? 'text-white font-weight-medium' : null,
                  stakeholder.isPrimary ? 'job-primary-border' : null,
                ]"
              >
                <template v-if="stakeholder.avatar">
                  <VImg :src="stakeholder.avatar" />
                </template>
                <template v-else>
                  <span>{{ avatarText(stakeholder.name) }}</span>
                </template>

                <VTooltip activator="parent" location="top">
                  <div class="d-flex flex-column gap-1">
                    <span class="font-weight-medium">{{
                      stakeholder.name
                    }}</span>

                    <span
                      v-if="stakeholder.isPrimary"
                      class="text-body-2 text-primary"
                    >
                      Primary
                    </span>
                  </div>
                </VTooltip>
              </VAvatar>

              <VAvatar
                v-if="decorateStakeholders(item).length > 3"
                color="secondary"
                :size="40"
                class="font-weight-medium text-white"
              >
                +{{ decorateStakeholders(item).length - 3 }}
                <VTooltip activator="parent" location="top">
                  {{
                    decorateStakeholders(item)
                      .slice(3)
                      .map((entry) => entry.name)
                      .join(", ")
                  }}
                </VTooltip>
              </VAvatar>
            </div>
            <span v-else class="text-medium-emphasis">No stakeholders</span>
          </div>
        </template>

        <template #item.actions="{ item }">
          <IconBtn
            :to="{ name: 'operations-jobs-view-id', params: { id: item.id } }"
          >
            <VIcon icon="tabler-eye" />
          </IconBtn>

          <IconBtn @click="openEditDialog(item)">
            <VIcon icon="tabler-edit" />
          </IconBtn>

          <IconBtn @click="confirmDelete(item.id)">
            <VIcon icon="tabler-trash" />
          </IconBtn>
        </template>
      </VDataTableServer>
    </VCard>

    <AddJobDialog
      v-model:is-dialog-visible="isAddJobDialogVisible"
      @submit="addJob"
    />

    <JobEditDialog
      :job="selectedJob"
      v-model:is-dialog-visible="isJobEditDialogVisible"
      :loading="dialogLoading"
      :error="dialogError"
      @submit="updateJob"
    />
  </section>
</template>

<style scoped>
.job-primary-border {
  --job-primary-color: rgb(var(--v-theme-primary));

  position: relative;
}

.job-primary-border::after {
  position: absolute;
  border: 2px solid var(--job-primary-color);
  border-radius: inherit;
  content: "";
  inset: -2px;
  pointer-events: none;
}
</style>
