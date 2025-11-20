<script setup lang="ts">
import HrApprovalCard from "./HrApprovalCard.vue";
import HrLeavesCard from "./HrLeavesCard.vue";
import HrListCard from "./HrListCard.vue";
</script>

<template>
  <div class="d-flex flex-column">
    <!-- <VCard class="mb-6">
      <VCardText
        >Type and add parameters relevant to your HR policies by pressing Enter
        or tab . Double-click a parameter to edit it. click on X to remove a
        parameter.</VCardText
      >
    </VCard> -->

    <HrListCard list-key="additions" title="Additions" item-label="Addition" />

    <HrListCard
      list-key="deductions"
      title="Deductions"
      item-label="Deduction"
    />

    <HrListCard list-key="advances" title="Advances" item-label="Advance" />

    <HrLeavesCard />

    <HrListCard
      list-key="departments"
      title="Departments"
      item-label="Department"
    />

    <HrApprovalCard />
  </div>
</template>
