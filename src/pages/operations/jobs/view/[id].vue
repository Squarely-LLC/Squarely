<script setup lang="ts">
import { computed, onMounted, ref, toRaw, watch } from "vue";

import type { JobProperties } from "@/plugins/fake-api/handlers/operations/jobs/types";
import { useJobsStore } from "@/stores/jobs";
import { useContactsStore } from "@/stores/contacts";
import JobSummaryCard from "@/views/operations/jobs/view/JobSummaryCard.vue";
import JobProjectInfoTab from "@/views/operations/jobs/view/JobProjectInfoTab.vue";
import JobMilestonesGoalsTab from "@/views/operations/jobs/view/JobMilestonesGoalsTab.vue";
import JobStakeholdersTab from "@/views/operations/jobs/view/JobStakeholdersTab.vue";

const route = useRoute("operations-jobs-view-id");

const jobsStore = useJobsStore();
jobsStore.init();

const contactsStore = useContactsStore();
contactsStore.init();

const cloneJob = (job: JobProperties | null) => {
  if (!job) return null;
  const raw = toRaw(job) as JobProperties;

  if (typeof structuredClone === "function") {
    try {
      return structuredClone(raw);
    } catch (error) {
      console.warn("structuredClone failed for job clone", error);
    }
  }

  try {
    return JSON.parse(JSON.stringify(raw)) as JobProperties;
  } catch (error) {
    console.warn("JSON clone failed for job clone", error);
    return { ...raw };
  }
};

const job = ref<JobProperties | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

const contactDirectory = computed(() => {
  const map = new Map<number, { name: string }>();
  contactsStore.all.forEach((contact) => {
    if (contact?.id === null || contact?.id === undefined) return;
    map.set(Number(contact.id), { name: contact.fullName });
  });
  return map;
});

const resolveJob = () => {
  loading.value = true;
  const found = jobsStore.byId(route.params.id);

  if (found) {
    job.value = cloneJob(found);
    error.value = null;
  } else {
    job.value = null;
    error.value = "Job not found.";
  }

  loading.value = false;
};

onMounted(resolveJob);
watch(() => route.params.id, resolveJob);
watch(
  () => jobsStore.byId(route.params.id),
  (value) => {
    if (!value) {
      job.value = null;
      error.value = "Job not found.";
      return;
    }
    job.value = cloneJob(value);
    error.value = null;
  }
);

const jobTab = ref(0);

const tabs = [
  { icon: "tabler-clipboard", title: "Project Info" },
  { icon: "tabler-flag", title: "Milestones & Goals" },
  { icon: "tabler-users", title: "Stakeholders" },
] as const;
</script>

<template>
  <div>
    <VProgressLinear v-if="loading" indeterminate color="primary" class="mb-4" />

    <VRow v-if="job">
      <VCol cols="12" md="4" lg="3">
        <JobSummaryCard :job="job" :contact-directory="contactDirectory" />
      </VCol>

      <VCol cols="12" md="8" lg="9">
        <VTabs v-model="jobTab" class="v-tabs-pill mb-4">
          <VTab v-for="tab in tabs" :key="tab.icon">
            <VIcon :size="18" :icon="tab.icon" class="me-1" />
            <span>{{ tab.title }}</span>
          </VTab>
        </VTabs>

        <VWindow v-model="jobTab" class="disable-tab-transition" :touch="false">
          <VWindowItem>
            <JobProjectInfoTab :job-id="job.id" />
          </VWindowItem>

          <VWindowItem>
            <JobMilestonesGoalsTab :job-id="job.id" />
          </VWindowItem>

          <VWindowItem>
            <JobStakeholdersTab :job-id="job.id" />
          </VWindowItem>
        </VWindow>
      </VCol>
    </VRow>

    <VAlert v-else-if="error" type="error" variant="tonal">
      {{ error }}
    </VAlert>
  </div>
</template>
