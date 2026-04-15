<script setup lang="ts">
interface Props {
  saveText?: string;
  cancelText?: string;
  saveType?: "button" | "submit" | "reset";
  cancelType?: "button" | "submit" | "reset";
  saveColor?: string;
  saveVariant?: "flat" | "text" | "tonal" | "elevated" | "outlined" | "plain";
  cancelColor?: string;
  cancelVariant?: "flat" | "text" | "tonal" | "elevated" | "outlined" | "plain";
  saveLoading?: boolean;
  saveDisabled?: boolean;
  cancelDisabled?: boolean;
}

withDefaults(defineProps<Props>(), {
  saveText: "Save",
  cancelText: "Cancel",
  saveType: "button",
  cancelType: "button",
  saveColor: "primary",
  saveVariant: "flat",
  cancelColor: "secondary",
  cancelVariant: "tonal",
  saveLoading: false,
  saveDisabled: false,
  cancelDisabled: false,
});

defineEmits<{
  (e: "save"): void;
  (e: "cancel"): void;
}>();
</script>

<template>
  <div class="d-flex flex-wrap justify-space-between align-center gap-4 w-100">
    <VBtn
      :type="saveType"
      :color="saveColor"
      :variant="saveVariant"
      :loading="saveLoading"
      :disabled="saveDisabled"
      @click="$emit('save')"
    >
      {{ saveText }}
    </VBtn>

    <VBtn
      :type="cancelType"
      :color="cancelColor"
      :variant="cancelVariant"
      :disabled="cancelDisabled"
      @click="$emit('cancel')"
    >
      {{ cancelText }}
    </VBtn>
  </div>
</template>
