<script setup lang="ts">
import type { EmployeeProperties } from "@/plugins/fake-api/handlers/apps/employees/types";
import { useEmployeesStore } from "@/stores/employees";
import { useNotificationsStore } from "@/stores/notifications";
import AddNewUserDialog from "@/views/apps/hr/list/AddNewUserDialog.vue";
import { computed, ref } from "vue";

interface Props {
  isDialogVisible: boolean;
  currentEmployeeId?: number | string;
  existingManagerIds?: Array<number | string>;
}

interface Emit {
  (e: "update:isDialogVisible", val: boolean): void;
  (e: "add-manager", payload: { managerId: number | string }): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emit>();

const dialogVisibleUpdate = (val: boolean) => {
  emit("update:isDialogVisible", val);
};

const employeesStore = useEmployeesStore();
const notificationsStore = useNotificationsStore();

const availableManagers = computed(() => {
  const all = employeesStore.all || [];

  const excludeIds = new Set(
    (props.existingManagerIds || []).map((id) => String(id))
  );

  if (props.currentEmployeeId) {
    excludeIds.add(String(props.currentEmployeeId));
  }

  return all
    .filter((emp) => !excludeIds.has(String(emp.id)))
    .map((emp) => ({
      id: emp.id,
      avatar: emp.picture || "",
      name: emp.fullName,
      email: emp.email || "",
      department: emp.employment?.department || "",
    }));
});

const selectedManagerId = ref<number | string | null>(null);
const isAddNewEmployeeDialogVisible = ref(false);

const onAddNewEmployeeSubmit = (payload: Partial<EmployeeProperties>) => {
  const created = employeesStore.addEmployee(payload);
  selectedManagerId.value = created.id;
  isAddNewEmployeeDialogVisible.value = false;
  notificationsStore.push("Employee created", "success", 3000);
};

const addManager = () => {
  if (!selectedManagerId.value) return;

  emit("add-manager", {
    managerId: selectedManagerId.value,
  });

  emit("update:isDialogVisible", false);
  selectedManagerId.value = null;
  notificationsStore.push("Manager added", "success", 2500);
};

const avatarInitials = (name?: string | null) => {
  const safeName = (name ?? "").trim();
  if (!safeName) return "??";

  const initials = safeName
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return initials || safeName.slice(0, 2).toUpperCase();
};
</script>

<template>
  <VDialog
    :model-value="props.isDialogVisible"
    :width="$vuetify.display.smAndDown ? '600' : 600"
    @update:model-value="dialogVisibleUpdate"
  >
    <DialogCloseBtn @click="$emit('update:isDialogVisible', false)" />

    <VCard class="pa-2 pa-sm-10">
      <VCardText>
        <h4 class="text-h4 text-center mb-2">Reports To</h4>
        <p class="text-body-1 text-center mb-6">
          Select a manager this employee reports to
        </p>

        <div class="d-flex align-center gap-3">
          <div class="flex-grow-1">
            <AppAutocomplete
              label="Select Manager"
              :items="availableManagers"
              item-title="name"
              item-value="id"
              v-model="selectedManagerId"
              placeholder="Search for manager..."
            >
              <template #item="{ props: listItemProp, item }">
                <VListItem v-bind="listItemProp">
                  <template #prepend>
                    <VAvatar
                      size="30"
                      :color="item.raw.avatar ? undefined : 'primary'"
                      :variant="!item.raw.avatar ? 'tonal' : undefined"
                    >
                      <template v-if="item.raw.avatar">
                        <VImg :src="item.raw.avatar" />
                      </template>
                      <template v-else>
                        <span class="font-weight-medium">{{
                          avatarInitials(item.raw.name)
                        }}</span>
                      </template>
                    </VAvatar>
                  </template>

                  <VListItemTitle>{{ item.raw.name }}</VListItemTitle>
                  <VListItemSubtitle class="text-body-2">
                    {{ item.raw.department || "No department" }} •
                    {{ item.raw.email }}
                  </VListItemSubtitle>
                </VListItem>
              </template>
            </AppAutocomplete>
          </div>
        </div>

        <VBtn
          variant="text"
          color="primary"
          class="mt-3"
          @click="isAddNewEmployeeDialogVisible = true"
        >
          <VIcon start icon="tabler-plus" /> Add New Employee
          <VTooltip activator="parent" location="top">
            Add new employee
          </VTooltip>
        </VBtn>

        <div class="d-flex justify-center gap-3 mt-6">
          <VBtn
            variant="tonal"
            color="secondary"
            @click="$emit('update:isDialogVisible', false)"
          >
            Cancel
          </VBtn>
          <VBtn
            @click="addManager"
            prepend-icon="tabler-user-check"
            :disabled="!selectedManagerId"
          >
            Add Manager
          </VBtn>
        </div>

        <AddNewUserDialog
          v-model:is-dialog-visible="isAddNewEmployeeDialogVisible"
          @submit="onAddNewEmployeeSubmit"
        />
      </VCardText>
    </VCard>
  </VDialog>
</template>
