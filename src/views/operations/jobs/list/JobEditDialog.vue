<script setup lang="ts">
import { requiredValidator } from "@/@core/utils/validators";
import DialogActionBar from "@/components/DialogActionBar.vue";
import type {
  JobFlag,
  JobProperties,
  JobStatus,
  JobType,
} from "@/plugins/fake-api/handlers/operations/jobs/types";
import { useConfigStore } from "@/stores/config";
import { jobStatusChipStyle, jobStatusColor } from "@/utils/jobStatusColors";
import {
  getEmployeeOptions,
  getSalesContactOptions,
} from "@/utils/peopleOptions";
import { computed, nextTick, ref, toRaw, watch } from "vue";
import type { VForm } from "vuetify/components/VForm";
interface Props {
  job?: JobProperties | null;
  isDialogVisible: boolean;
  loading?: boolean;
  error?: string | null;
}
interface Emit {
  (e: "submit", value: JobProperties): void;
  (e: "update:isDialogVisible", value: boolean): void;
}
const props = withDefaults(defineProps<Props>(), {
  job: null,
  loading: false,
  error: null,
});
const emit = defineEmits<Emit>();
const configStore = useConfigStore();
configStore.init();

const relatedContactOptions = computed(() => getSalesContactOptions());
const collaboratorOptions = computed(() => getEmployeeOptions());

const statusOptions = computed(() => {
  return (configStore.configurations?.crm?.jobStatuses || [
    "New",
    "Pending",
    "In Progress",
    "On Hold",
    "Completed",
    "Closed",
  ]) as JobStatus[];
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
const flagOptions: JobFlag[] = ["Normal", "High"];
const refForm = ref<VForm>();
const isFormValid = ref(false);
const sanitiseJob = (job: JobProperties | null) => {
  if (!job) return null;
  const raw = toRaw(job) as JobProperties;
  return {
    ...raw,
    collaborators: Array.isArray(raw.collaborators)
      ? [...raw.collaborators]
      : [],
  } satisfies JobProperties;
};
const localJob = ref<JobProperties | null>(sanitiseJob(props.job));
watch(
  () => props.job,
  (value) => {
    localJob.value = sanitiseJob(value ?? null);
    nextTick(() => {
      refForm.value?.resetValidation();
    });
  },
);
const dialogModelValueUpdate = (value: boolean) => {
  emit("update:isDialogVisible", value);
};
const onSubmit = async () => {
  if (!localJob.value) return;
  const { valid } = (await refForm.value?.validate()) ?? { valid: true };
  if (!valid) return;
  emit("submit", {
    ...localJob.value,
    stage: localJob.value.status ?? localJob.value.stage,
  });
};
const onCancel = () => {
  localJob.value = sanitiseJob(props.job ?? null);
  emit("update:isDialogVisible", false);
};
</script>
<template>
  <VDialog
    :width="$vuetify.display.smAndDown ? 'auto' : 700"
    :model-value="isDialogVisible"
    @update:model-value="dialogModelValueUpdate"
  >
    <DialogCloseBtn @click="dialogModelValueUpdate(false)" />
    <VCard class="pa-sm-8 pa-4">
      <VCardText>
        <h4 class="text-h5 text-center mb-2">Edit Job</h4>
        <p class="text-body-2 text-center mb-6">
          Update the project information and save your changes.
        </p>
        <VAlert
          v-if="error"
          type="error"
          variant="tonal"
          class="mb-4"
          density="comfortable"
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
                label="Project Code"
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
                v-model="localJob.status"
                label="Status"
                placeholder="Select Status"
                :items="statusOptions"
                :rules="[requiredValidator]"
              >
                <template #selection="{ item }">
                  <VChip
                    :color="jobStatusColor(String(item?.value ?? item?.title ?? ''))"
                    :style="jobStatusChipStyle(String(item?.value ?? item?.title ?? ''))"
                    label
                    size="small"
                  >
                    {{ item?.title }}
                  </VChip>
                </template>
              </AppSelect>
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
                v-model="localJob.projectManagerId"
                label="Project Manager"
                placeholder="Select project manager"
                :items="collaboratorOptions"
                item-title="title"
                item-value="value"
                :rules="[requiredValidator]"
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
                clearable
                clear-icon="tabler-x"
              >
                <template #selection="{ item, index }">
                  <span v-if="index === 0" class="text-truncate">
                    {{ item.raw.title }}
                    <span
                      v-if="(localJob.collaborators?.length ?? 0) > 1"
                      class="text-medium-emphasis"
                    >
                      (+{{ (localJob.collaborators?.length ?? 0) - 1 }} more)
                    </span>
                  </span>
                </template>
              </AppSelect>
            </VCol>
            <VCol cols="12">
              <AppTextarea
                v-model="localJob.note"
                label="Notes"
                placeholder="Notes about the project"
                auto-grow
                rows="3"
              />
            </VCol>
            <VCol cols="12" class="mt-4">
              <DialogActionBar
                save-type="submit"
                :save-loading="loading"
                @save="() => undefined"
                @cancel="onCancel"
              />
            </VCol>
          </VRow>
        </VForm>
        <VAlert v-else type="warning" variant="tonal">
          Unable to load job details.
        </VAlert>
      </VCardText>
    </VCard>
  </VDialog>
</template>
