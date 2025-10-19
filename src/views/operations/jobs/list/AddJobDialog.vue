<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import type { VForm } from "vuetify/components/VForm";

import {
  requiredValidator,
} from "@/@core/utils/validators";
import type {
  JobFlag,
  JobProperties,
  JobStage,
  JobType,
} from "@/plugins/fake-api/handlers/operations/jobs/types";
import { useContactsStore } from "@/stores/contacts";

interface Props {
  isDialogVisible: boolean;
}

interface Emit {
  (e: "submit", value: Partial<JobProperties>): void;
  (e: "update:isDialogVisible", value: boolean): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emit>();

const refForm = ref<VForm>();
const isFormValid = ref(false);

const contactsStore = useContactsStore();
contactsStore.init();

const stageOptions: JobStage[] = [
  "PRPSL",
  "In Review",
  "Project | In Progress",
  "RFI",
];

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

const contactOptions = computed(() =>
  contactsStore.all.map((contact) => ({
    title: contact.fullName,
    value: contact.id,
  }))
);

const localJob = ref<Partial<JobProperties>>({
  name: "",
  code: "",
  startDate: undefined,
  location: "",
  stage: "PRPSL",
  type: "Architecture",
  flag: "Normal",
  relatedTo: null,
  collaborators: [],
  note: "",
});

const dialogModelValueUpdate = (value: boolean) => {
  emit("update:isDialogVisible", value);
};

const resetForm = () => {
  refForm.value?.reset();
  refForm.value?.resetValidation();
  localJob.value = {
    name: "",
    code: "",
    startDate: undefined,
    location: "",
    stage: "PRPSL",
    type: "Architecture",
    flag: "Normal",
    relatedTo: null,
    collaborators: [],
    note: "",
  };
  nextTick(() => {
    refForm.value?.resetValidation();
  });
};

watch(
  () => props.isDialogVisible,
  (visible) => {
    if (!visible) return;
    nextTick(() => {
      refForm.value?.resetValidation();
    });
  }
);

const onSubmit = async () => {
  const { valid } = (await refForm.value?.validate()) ?? { valid: true };
  if (!valid) return;

  emit("submit", { ...localJob.value });
  emit("update:isDialogVisible", false);
  nextTick(() => resetForm());
};

const onCancel = () => {
  resetForm();
  emit("update:isDialogVisible", false);
};
</script>

<template>
  <VDialog
    :width="$vuetify.display.smAndDown ? 'auto' : 680"
    :model-value="isDialogVisible"
    @update:model-value="dialogModelValueUpdate"
  >
    <DialogCloseBtn @click="dialogModelValueUpdate(false)" />

    <VCard class="pa-sm-8 pa-4">
      <VCardText>
        <h4 class="text-h5 text-center mb-2">Add New Job</h4>
        <p class="text-body-2 text-center mb-6">
          Capture the key information for a new job record.
        </p>

        <VForm ref="refForm" v-model="isFormValid" @submit.prevent="onSubmit">
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
                :items="contactOptions"
                clearable
                clear-icon="tabler-x"
              />
            </VCol>

            <VCol cols="12">
              <AppSelect
                v-model="localJob.collaborators"
                label="Collaborators"
                placeholder="Select collaborators"
                :items="contactOptions"
                multiple
                chips
                clearable
                clear-icon="tabler-x"
              />
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

            <VCol cols="12" class="d-flex flex-wrap justify-center gap-4 mt-4">
              <VBtn type="submit">Submit</VBtn>
              <VBtn variant="tonal" color="secondary" @click="onCancel">
                Cancel
              </VBtn>
            </VCol>
          </VRow>
        </VForm>
      </VCardText>
    </VCard>
  </VDialog>
</template>
