<script setup lang="ts">
import { useConfigStore } from "@/stores/config";
import { useNotificationsStore } from "@/stores/notifications";
import { computed, ref, watch } from "vue";

const store = useConfigStore();
store.init();
const notifications = useNotificationsStore();

type ApprovalOption = "none" | "one_level" | "two_level";

const options: { label: string; value: ApprovalOption }[] = [
  { label: "Not Required", value: "none" },
  { label: "One Level Approval", value: "one_level" },
  { label: "Two Levels Approval", value: "two_level" },
];

const model = ref<ApprovalOption>("none");
const isSaving = ref(false);
const initialValue = ref<ApprovalOption>("none");

const labelForValue = (value: ApprovalOption) =>
  options.find((opt) => opt.value === value)?.label ?? options[0].label;

const loadValue = () => {
  const stored =
    (store.configurations.hr?.requestApproval as ApprovalOption | undefined) ||
    "one_level";
  model.value = stored;
  initialValue.value = stored;
};

const isDirty = computed(() => model.value !== initialValue.value);

const saveValue = async () => {
  if (!isDirty.value || isSaving.value) return;
  isSaving.value = true;
  const res = await store.saveRemote({
    hr: { requestApproval: model.value },
  } as any);
  isSaving.value = false;
  if (res) {
    initialValue.value = model.value;
    notifications.push("Requests approval updated", "success", 2000);
  } else {
    notifications.push("Failed to update requests approval", "error", 3000);
    model.value = initialValue.value;
  }
};

watch(model, () => {
  void saveValue();
});

loadValue();
</script>

<template>
  <VCard title="Requests Approval" class="mb-6">
    <VCardText>
      <VSelect
        v-model="model"
        :items="options"
        item-title="label"
        item-value="value"
        :loading="isSaving"
        :disabled="isSaving"
      />
    </VCardText>
  </VCard>
</template>
