<script setup lang="ts">
import { computed, reactive, ref } from "vue";

import type {
  JobProperties,
  JobStakeholder,
} from "@/plugins/fake-api/handlers/operations/jobs/types";
import { useJobsStore } from "@/stores/jobs";
import { useContactsStore } from "@/stores/contacts";
import { useNotificationsStore } from "@/stores/notifications";

interface Props {
  jobId: number | string;
}

const props = defineProps<Props>();

const jobsStore = useJobsStore();
const contactsStore = useContactsStore();
const notifications = useNotificationsStore();

contactsStore.init();

const job = computed<JobProperties | null>(() => jobsStore.byId(props.jobId));

const stakeholders = computed(() => job.value?.stakeholders ?? []);

const contactOptions = computed(() =>
  contactsStore.all.map((contact) => ({
    title: contact.fullName,
    value: contact.id,
  }))
);

const dialog = reactive({
  visible: false,
  mode: "create" as "create" | "edit",
  draft: {
    id: null as number | null,
    contactId: null as number | null,
    role: "",
  },
});

const targetStakeholderId = ref<number | null>(null);

const dialogTitle = computed(() =>
  dialog.mode === "create" ? "Add Stakeholder" : "Edit Stakeholder"
);

const resetDraft = () => {
  dialog.draft = {
    id: null,
    contactId: null,
    role: "",
  };
};

const openCreate = () => {
  dialog.mode = "create";
  dialog.visible = true;
  resetDraft();
};

const openEdit = (stakeholder: JobStakeholder) => {
  dialog.mode = "edit";
  dialog.visible = true;
  targetStakeholderId.value = stakeholder.id;
  dialog.draft = {
    id: stakeholder.id,
    contactId: stakeholder.contactId ?? null,
    role: stakeholder.role ?? "",
  };
};

const saveStakeholder = () => {
  if (!job.value) return;
  if (dialog.mode === "create") {
    jobsStore.addStakeholder(job.value.id, { ...dialog.draft });
    notifications.push("Stakeholder added", "success", 3000);
  } else if (targetStakeholderId.value !== null) {
    jobsStore.updateStakeholder(job.value.id, targetStakeholderId.value, {
      ...dialog.draft,
    });
    notifications.push("Stakeholder updated", "success", 3000);
  }

  dialog.visible = false;
  targetStakeholderId.value = null;
  resetDraft();
};

const deleteStakeholder = (stakeholder: JobStakeholder) => {
  if (!job.value) return;
  jobsStore.removeStakeholder(job.value.id, stakeholder.id);
  notifications.push("Stakeholder removed", "success", 3000);
};

const displayName = (stakeholder: JobStakeholder) => {
  if (!stakeholder.contactId) return "Unassigned";
  const contact = contactsStore.byId(stakeholder.contactId);
  if (contact) return contact.fullName;
  return (
    contactsStore.all.find((entry) => entry.id === stakeholder.contactId)?.fullName ||
    "Unassigned"
  );
};
</script>

<template>
  <VCard>
    <VCardText>
      <div class="d-flex justify-space-between align-center flex-wrap gap-4 mb-4">
        <div>
          <h5 class="text-h5 mb-1">Stakeholders</h5>
          <p class="text-body-2 text-medium-emphasis mb-0">
            Assign contacts to this job with a custom role.
          </p>
        </div>

        <VBtn prepend-icon="tabler-plus" @click="openCreate">Add Stakeholder</VBtn>
      </div>

      <VTable density="comfortable">
        <thead>
          <tr>
            <th>Name</th>
            <th>Role</th>
            <th class="text-end">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!stakeholders.length">
            <td colspan="3" class="text-center text-medium-emphasis py-6">
              No stakeholders yet. Add stakeholders to keep everyone aligned.
            </td>
          </tr>
          <tr v-for="stakeholder in stakeholders" :key="stakeholder.id">
            <td class="text-high-emphasis">{{ displayName(stakeholder) }}</td>
            <td class="text-medium-emphasis">{{ stakeholder.role || '--' }}</td>
            <td class="text-end">
              <VBtn variant="text" color="primary" @click="openEdit(stakeholder)">
                Edit
              </VBtn>
              <VBtn variant="text" color="error" @click="deleteStakeholder(stakeholder)">
                Delete
              </VBtn>
            </td>
          </tr>
        </tbody>
      </VTable>
    </VCardText>
  </VCard>

  <VDialog
    :model-value="dialog.visible"
    :width="$vuetify.display.smAndDown ? 'auto' : 520"
    @update:model-value="(val: boolean) => (dialog.visible = val)"
  >
    <DialogCloseBtn @click="dialog.visible = false" />
    <VCard>
      <VCardText>
        <h5 class="text-h5 mb-4">{{ dialogTitle }}</h5>

        <VRow>
          <VCol cols="12">
            <AppSelect
              v-model="dialog.draft.contactId"
              label="Contact"
              placeholder="Select contact"
              :items="contactOptions"
              clearable
              clear-icon="tabler-x"
            />
          </VCol>
          <VCol cols="12">
            <AppTextField
              v-model="dialog.draft.role"
              label="Role"
              placeholder="Project Sponsor"
            />
          </VCol>
          <VCol cols="12" class="d-flex justify-end gap-4">
            <VBtn variant="tonal" color="secondary" @click="dialog.visible = false">
              Cancel
            </VBtn>
            <VBtn @click="saveStakeholder">Save</VBtn>
          </VCol>
        </VRow>
      </VCardText>
    </VCard>
  </VDialog>
</template>
