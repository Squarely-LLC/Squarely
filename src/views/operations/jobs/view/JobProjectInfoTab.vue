<script setup lang="ts">
import { requiredValidator } from "@/@core/utils/validators";
import type {
  JobFlag,
  JobProperties,
  JobStage,
  JobType,
} from "@/plugins/fake-api/handlers/operations/jobs/types";
import { useConfigStore } from "@/stores/config";
import { useJobsStore } from "@/stores/jobs";
import { useNotificationsStore } from "@/stores/notifications";
import {
  getEmployeeOptions,
  getSalesContactOptions,
} from "@/utils/peopleOptions";
import { computed, nextTick, ref, watch } from "vue";
import type { VForm } from "vuetify/components/VForm";
interface Props {
  jobId: number | string;
}
const props = defineProps<Props>();
const jobsStore = useJobsStore();
const notifications = useNotificationsStore();
const configStore = useConfigStore();
configStore.init();

const stageOptions = computed(() => {
  return (configStore.configurations?.crm?.jobStages || [
    "PRPSL",
    "In Review",
    "Project | In Progress",
    "RFI",
  ]) as JobStage[];
});
const typeOptions: JobType[] = [
  "Architecture",
  "Interior",
  "Architecture & Interior",
  "Stands & Events",
  "Master Plan",
  "Full Scope",
  "Internal",
  "Other",
];
const flagOptions: JobFlag[] = ["Low", "Normal", "High"];
const job = computed(() => jobsStore.byId(props.jobId));
const relatedContactOptions = computed(() => getSalesContactOptions());
const collaboratorOptions = computed(() => getEmployeeOptions());

const refForm = ref<VForm>();
const isFormValid = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const localJob = ref<Partial<JobProperties> | null>(null);
const hydrateLocalJob = (target: JobProperties | null) => {
  if (!target) {
    localJob.value = null;
    return;
  }
  localJob.value = {
    id: target.id,
    name: target.name,
    code: target.code ?? "",
    startDate: target.startDate,
    endDate: target.endDate,
    location: target.location ?? "",
    stage: target.stage,
    type: target.type,
    flag: target.flag,
    relatedTo: target.relatedTo ?? null,
    collaborators: Array.isArray(target.collaborators)
      ? [...target.collaborators]
      : [],
    note: target.note ?? "",
  };
};
watch(
  job,
  (value) => {
    hydrateLocalJob(value ?? null);
    nextTick(() => refForm.value?.resetValidation());
  },
  { immediate: true },
);
const onSubmit = async () => {
  if (!localJob.value || !localJob.value.id) return;
  const { valid } = (await refForm.value?.validate()) ?? { valid: true };
  if (!valid) return;
  saving.value = true;
  error.value = null;
  try {
    const updated = jobsStore.updateJob(localJob.value.id, {
      ...localJob.value,
      collaborators: localJob.value.collaborators ?? [],
    });
    if (!updated) {
      error.value = "Failed to update project";
      notifications.push("Unable to update job", "error", 4000);
      return;
    }
    notifications.push("Project information updated", "success", 3000);
    hydrateLocalJob(updated);
  } catch (err) {
    console.error("Failed to update project info", err);
    error.value = "An unexpected error occurred";
    notifications.push("Failed to update job", "error", 4000);
  } finally {
    saving.value = false;
  }
};
const onReset = () => {
  hydrateLocalJob(job.value ?? null);
  nextTick(() => refForm.value?.resetValidation());
};
</script>
<template>
  <VCard>
    <VCardText>
      <h5 class="text-h5 mb-1">Project Info</h5>
      <p class="text-body-2 text-medium-emphasis mb-6">
        Update the key project information, collaborators and notes.
      </p>
      <VAlert
        v-if="error"
        type="error"
        variant="tonal"
        density="comfortable"
        class="mb-4"
      >
        {{ error }}
      </VAlert>
      <VForm
        v-if="localJob"
        ref="refForm"
        v-model="isFormValid"
        @submit.prevent="onSubmit"
      >
        <VRow>
          <VCol cols="12" md="6">
            <AppTextField
              v-model="localJob.name"
              label="Project Name"
              placeholder="Ted's Project"
              :rules="[requiredValidator]"
            />
          </VCol>
          <VCol cols="12" md="6">
            <AppTextField
              v-model="localJob.code"
              label="Code"
              placeholder="P-1234"
            />
          </VCol>
          <VCol cols="12" md="6">
            <AppDateTimePicker
              v-model="localJob.startDate"
              label="Start Date"
              placeholder="YYYY-MM-DD HH:mm"
              clearable
            />
          </VCol>
          <VCol cols="12" md="6">
            <AppDateTimePicker
              v-model="localJob.endDate"
              label="End Date"
              placeholder="YYYY-MM-DD HH:mm"
              clearable
            />
          </VCol>
          <VCol cols="12" md="6">
            <AppTextField
              v-model="localJob.location"
              label="Location"
              placeholder="Beirut, Lebanon"
            />
          </VCol>
          <VCol cols="12" md="6">
            <AppSelect
              v-model="localJob.stage"
              label="Stage"
              placeholder="Select Stage"
              :items="stageOptions"
              :rules="[requiredValidator]"
            />
          </VCol>
          <VCol cols="12" md="6">
            <AppSelect
              v-model="localJob.type"
              label="Type"
              placeholder="Select Type"
              :items="typeOptions"
              :rules="[requiredValidator]"
            />
          </VCol>
          <VCol cols="12" md="6">
            <AppSelect
              v-model="localJob.flag"
              label="Flag"
              placeholder="Select Flag"
              :items="flagOptions"
              :rules="[requiredValidator]"
            />
          </VCol>
          <VCol cols="12" md="6">
            <AppSelect
              v-model="localJob.relatedTo"
              label="Related To"
              placeholder="Select Contact"
              :items="relatedContactOptions"
              clearable
              clear-icon="tabler-x"
            />
          </VCol>
          <VCol cols="12" md="6">
            <AppSelect
              v-model="localJob.collaborators"
              label="Collaborators"
              placeholder="Select collaborators"
              :items="collaboratorOptions"
              multiple
              chips
              closable-chips
              clearable
            />
          </VCol>
          <VCol cols="12">
            <AppTextarea
              v-model="localJob.note"
              label="Notes"
              placeholder="Notes about the project"
              auto-grow
              rows="4"
            />
          </VCol>
          <VCol cols="12" class="d-flex flex-wrap gap-4 justify-center mt-4">
            <VBtn :loading="saving" type="submit">Save</VBtn>
            <VBtn
              variant="tonal"
              color="secondary"
              :disabled="saving"
              @click="onReset"
            >
              Reset
            </VBtn>
          </VCol>
        </VRow>
      </VForm>
      <VAlert v-else type="warning" variant="tonal">
        Unable to load project information.
      </VAlert>
    </VCardText>
  </VCard>
</template>
