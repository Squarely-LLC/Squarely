<script setup lang="ts">
import { useDealsStore } from "@/stores/deals";
import { useNotificationsStore } from "@/stores/notifications";
import { computed, watch } from "vue";

const dealsStore = useDealsStore();
const notifications = useNotificationsStore();
const route = useRoute();
const userData = useCookie("userData");
const accessToken = useCookie("accessToken");

const isAuthenticated = computed(() => Boolean(userData.value && accessToken.value));
const isAuthRoute = computed(() => {
  const routePath = String(route.path || "").toLowerCase();
  const routeName = String(route.name || "").toLowerCase();

  return (
    Boolean(route.meta?.unauthenticatedOnly) ||
    routePath === "/login" ||
    routePath === "/register" ||
    routePath.includes("forgot-password") ||
    routePath.includes("reset-password") ||
    routeName.includes("login") ||
    routeName.includes("register") ||
    routeName.includes("forgot-password") ||
    routeName.includes("reset-password")
  );
});
const canShowDialog = computed(() => isAuthenticated.value && !isAuthRoute.value);

watch(
  canShowDialog,
  (canShow) => {
    if (canShow) dealsStore.init();
  },
  { immediate: true },
);

const pendingDeal = computed(() =>
  canShowDialog.value ? dealsStore.latestPendingStageDeal : null,
);
const pendingTransition = computed(
  () => pendingDeal.value?.pendingStageTransition ?? null,
);
const isDialogVisible = computed(() => Boolean(pendingTransition.value));

const dialogSubtitle = computed(() => {
  if (!pendingDeal.value) return "";

  return pendingDeal.value.code?.trim() || `Deal #${pendingDeal.value.id}`;
});

const currentStageLabel = computed(
  () => pendingDeal.value?.stage?.trim() || "No stage",
);
const targetStageLabel = computed(
  () => pendingTransition.value?.targetStage?.trim() || "",
);
const transitionReasonLabel = computed(
  () => pendingTransition.value?.reason?.trim() || "Lifecycle update",
);

const dismissTransition = () => {
  if (!pendingDeal.value) return;

  dealsStore.dismissPendingStageTransition(pendingDeal.value.id);
  notifications.push(
    "Manual deal stage kept. Automatic lifecycle update dismissed.",
    "warning",
    4000,
  );
};

const approveTransition = () => {
  if (!pendingDeal.value) return;

  dealsStore.approvePendingStageTransition(pendingDeal.value.id);
  notifications.push(
    `Deal stage updated to ${targetStageLabel.value}.`,
    "success",
    3500,
  );
};
</script>

<template>
  <VDialog :model-value="isDialogVisible" max-width="560" persistent>
    <DialogCloseBtn @click="dismissTransition" />
    <VCard class="pa-sm-6 pa-4">
      <VCardItem>
        <VCardTitle>Deal Stage Conflict</VCardTitle>
        <VCardSubtitle>
          {{ dialogSubtitle }}
        </VCardSubtitle>
      </VCardItem>

      <VCardText>
        <VAlert type="warning" variant="tonal" class="mb-4">
          You manually changed this deal stage. The latest lifecycle event wants
          to move it back into the normal flow.
        </VAlert>

        <div class="d-flex flex-column gap-3 text-body-2">
          <div>
            Current stage:
            <strong>{{ currentStageLabel }}</strong>
          </div>
          <div>
            Requested automatic stage:
            <strong>{{ targetStageLabel }}</strong>
          </div>
          <div>
            Trigger:
            <strong>{{ transitionReasonLabel }}</strong>
          </div>
        </div>

        <p class="text-body-2 text-medium-emphasis mt-4 mb-0">
          Approving this will return the deal to the automatic lifecycle.
          Declining it keeps your manual stage and leaves the deal out of flow.
        </p>
      </VCardText>

      <VCardActions class="justify-end">
        <VBtn color="secondary" variant="tonal" @click="dismissTransition">
          Keep Manual Stage
        </VBtn>
        <VBtn color="warning" @click="approveTransition">
          Apply Automatic Stage
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
