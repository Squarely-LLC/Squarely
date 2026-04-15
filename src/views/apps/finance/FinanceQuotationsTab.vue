<script setup lang="ts">
import { formatSystemDate } from "@core/utils/formatters";
import type { Invoice } from "@db/apps/invoice/types";

type InvoiceStatus =
  | "Downloaded"
  | "Draft"
  | "Paid"
  | "Sent"
  | "Partial Payment"
  | "Past Due"
  | null;

const searchQuery = ref("");
const selectedStatus = ref<InvoiceStatus>(null);
const selectedRows = ref<number[]>([]);

const itemsPerPage = ref(10);
const page = ref(1);
const sortBy = ref();
const orderBy = ref();

const updateOptions = (options: any) => {
  sortBy.value = options.sortBy[0]?.key;
  orderBy.value = options.sortBy[0]?.order;
};

const headers = [
  { title: "#", key: "id" },
  { title: "Status", key: "status", sortable: false },
  { title: "Client", key: "client" },
  { title: "Total", key: "total" },
  { title: "Issued Date", key: "date" },
  { title: "Balance", key: "balance" },
  { title: "Actions", key: "actions", sortable: false },
];

const { data: invoiceData, execute: fetchInvoices } = await useApi<any>(
  createUrl("/apps/invoice", {
    query: {
      q: searchQuery,
      status: selectedStatus,
      itemsPerPage,
      page,
      sortBy,
      orderBy,
    },
  }),
);

const quotations = computed((): Invoice[] => invoiceData.value.invoices);
const totalQuotations = computed(() => invoiceData.value.totalInvoices);

const resolveBalanceVariant = (balance: string | number, total: number) => {
  if (balance === total) return { status: "Unpaid", chip: { color: "error" } };

  if (balance === 0) return { status: "Paid", chip: { color: "success" } };

  return { status: balance, chip: { variant: "text" } };
};

const resolveStatusVariantAndIcon = (status: string) => {
  if (status === "Partial Payment")
    return { variant: "warning", icon: "tabler-chart-pie-2" };
  if (status === "Paid") return { variant: "success", icon: "tabler-check" };
  if (status === "Downloaded")
    return { variant: "info", icon: "tabler-arrow-down" };
  if (status === "Draft") return { variant: "primary", icon: "tabler-folder" };
  if (status === "Sent") return { variant: "secondary", icon: "tabler-mail" };
  if (status === "Past Due") return { variant: "error", icon: "tabler-help" };

  return { variant: "secondary", icon: "tabler-x" };
};

const computedMoreList = computed(() => {
  return (paramId: number) => [
    {
      title: "Download",
      value: "download",
      prependIcon: "tabler-download",
    },
    {
      title: "Edit",
      value: "edit",
      prependIcon: "tabler-pencil",
      to: { name: "apps-invoice-edit-id", params: { id: paramId } },
    },
    {
      title: "Duplicate",
      value: "duplicate",
      prependIcon: "tabler-layers-intersect",
    },
  ];
});

const deleteQuotation = async (id: number) => {
  await $api(`/apps/invoice/${id}`, { method: "DELETE" });

  const index = selectedRows.value.findIndex(row => row === id);

  if (index !== -1) selectedRows.value.splice(index, 1);

  fetchInvoices();
};
</script>

<template>
  <section v-if="quotations">
    <VCard id="quotation-list">
      <VCardText class="d-flex flex-wrap gap-4">
        <div class="d-flex align-center gap-2">
          <span>Show</span>
          <AppSelect
            :model-value="itemsPerPage"
            :items="[
              { value: 10, title: '10' },
              { value: 25, title: '25' },
              { value: 50, title: '50' },
              { value: 100, title: '100' },
              { value: -1, title: 'All' },
            ]"
            style="inline-size: 6.25rem"
            @update:model-value="itemsPerPage = parseInt($event, 10)"
          />
        </div>

        <VSpacer />

        <div class="quotation-list-toolbar d-flex align-center flex-wrap gap-4">
          <div class="quotation-list-filter">
            <AppTextField
              v-model="searchQuery"
              placeholder="Search Quotation"
            />
          </div>

          <div class="quotation-list-filter">
            <AppSelect
              v-model="selectedStatus"
              placeholder="Quotation Status"
              clearable
              clear-icon="tabler-x"
              single-line
              :items="['Downloaded', 'Draft', 'Sent', 'Paid', 'Partial Payment', 'Past Due']"
            />
          </div>

          <VBtn
            prepend-icon="tabler-plus"
            :to="{ name: 'apps-invoice-add' }"
          >
            Create quotation
          </VBtn>
        </div>
      </VCardText>
      <VDivider />

      <VDataTableServer
        v-model:model-value="selectedRows"
        v-model:items-per-page="itemsPerPage"
        v-model:page="page"
        show-select
        :items-length="totalQuotations"
        :headers="headers"
        :items="quotations"
        item-value="id"
        class="text-no-wrap"
        @update:options="updateOptions"
      >
        <template #item.id="{ item }">
          <RouterLink :to="{ name: 'apps-invoice-preview-id', params: { id: item.id } }">
            #{{ item.id }}
          </RouterLink>
        </template>

        <template #item.status="{ item }">
          <VTooltip>
            <template #activator="{ props }">
              <VAvatar
                :size="28"
                v-bind="props"
                :color="resolveStatusVariantAndIcon(item.invoiceStatus).variant"
                variant="tonal"
              >
                <VIcon
                  :size="16"
                  :icon="resolveStatusVariantAndIcon(item.invoiceStatus).icon"
                />
              </VAvatar>
            </template>
            <p class="mb-0">
              {{ item.invoiceStatus }}
            </p>
            <p class="mb-0">
              Balance: {{ item.balance }}
            </p>
            <p class="mb-0">
              Due date: {{ formatSystemDate(item.dueDate) }}
            </p>
          </VTooltip>
        </template>

        <template #item.client="{ item }">
          <div class="d-flex align-center">
            <VAvatar
              size="34"
              :color="!item.avatar.length ? resolveStatusVariantAndIcon(item.invoiceStatus).variant : undefined"
              :variant="!item.avatar.length ? 'tonal' : undefined"
              class="me-3"
            >
              <VImg
                v-if="item.avatar.length"
                :src="item.avatar"
              />
              <span v-else>{{ avatarText(item.client.name) }}</span>
            </VAvatar>
            <div class="d-flex flex-column">
              <RouterLink
                :to="{ name: 'pages-user-profile-tab', params: { tab: 'profile' } }"
                class="text-link font-weight-medium"
              >
                {{ item.client.name }}
              </RouterLink>
              <span class="text-sm text-medium-emphasis">{{ item.client.companyEmail }}</span>
            </div>
          </div>
        </template>

        <template #item.total="{ item }">
          ${{ item.total }}
        </template>

        <template #item.date="{ item }">
          {{ formatSystemDate(item.issuedDate) }}
        </template>

        <template #item.balance="{ item }">
          <VChip
            v-if="typeof resolveBalanceVariant(item.balance, item.total).status === 'string'"
            :color="resolveBalanceVariant(item.balance, item.total).chip.color"
            label
            size="x-small"
          >
            {{ resolveBalanceVariant(item.balance, item.total).status }}
          </VChip>

          <template v-else>
            <span class="text-base text-high-emphasis">
              {{ Number(resolveBalanceVariant(item.balance, item.total).status) > 0 ? `$${resolveBalanceVariant(item.balance, item.total).status}` : `-$${Math.abs(Number(resolveBalanceVariant(item.balance, item.total).status))}` }}
            </span>
          </template>
        </template>

        <template #item.actions="{ item }">
          <IconBtn @click="deleteQuotation(item.id)">
            <VIcon icon="tabler-trash" />
          </IconBtn>

          <IconBtn :to="{ name: 'apps-invoice-preview-id', params: { id: item.id } }">
            <VIcon icon="tabler-eye" />
          </IconBtn>

          <MoreBtn
            :menu-list="computedMoreList(item.id)"
            item-props
            color="undefined"
          />
        </template>

        <template #bottom>
          <TablePagination
            v-model:page="page"
            :items-per-page="itemsPerPage"
            :total-items="totalQuotations"
          />
        </template>
      </VDataTableServer>
    </VCard>
  </section>

  <section v-else>
    <VCard>
      <VCardTitle>No Quotation Found</VCardTitle>
    </VCard>
  </section>
</template>

<style lang="scss">
#quotation-list {
  .quotation-list-toolbar {
    justify-content: flex-end;
  }

  .quotation-list-filter {
    inline-size: 12rem;
  }
}
</style>
