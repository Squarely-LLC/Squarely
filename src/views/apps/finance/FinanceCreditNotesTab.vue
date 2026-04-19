<script setup lang="ts">
import DialogActionBar from "@/components/DialogActionBar.vue";
import { useCreditNotesStore } from "@/stores/creditNotes";
import { useNotificationsStore } from "@/stores/notifications";
import { formatSystemDate } from "@core/utils/formatters";

interface Emit {
  (e: "create-credit-note"): void;
  (e: "edit-credit-note", noteId: number): void;
}

const emit = defineEmits<Emit>();

const creditNotesStore = useCreditNotesStore();
const notifications = useNotificationsStore();
const router = useRouter();

creditNotesStore.init();

const searchQuery = ref("");
const selectedStatus = ref<"Draft" | "Issued" | "Voided" | null>(null);
const itemsPerPage = ref(10);
const page = ref(1);
const sortBy = ref<string>();
const orderBy = ref<string>();

const isDeleteDialogOpen = ref(false);
const pendingDeleteId = ref<number | null>(null);

const headers = [
  { title: "#", key: "id" },
  { title: "Invoice", key: "invoice" },
  { title: "Date", key: "date" },
  { title: "Amount", key: "amount" },
  { title: "Status", key: "status", sortable: false },
  { title: "Actions", key: "actions", sortable: false },
];

const statusColor = (value: string) => {
  if (value === "Issued") return "success";
  if (value === "Voided") return "error";
  return "warning";
};

const notes = computed(() => creditNotesStore.all);

const filteredNotes = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  let records = notes.value.filter((record) => {
    const matchesQuery =
      !query ||
      record.noteNumber.toLowerCase().includes(query) ||
      record.linkedInvoiceNumber.toLowerCase().includes(query) ||
      record.clientName.toLowerCase().includes(query) ||
      record.reason.toLowerCase().includes(query);
    const matchesStatus = !selectedStatus.value || record.status === selectedStatus.value;
    return matchesQuery && matchesStatus;
  });

  if (sortBy.value) {
    records = [...records].sort((left, right) => {
      const isDesc = orderBy.value === "desc";
      const field = sortBy.value ?? "";
      const map = {
        id: left.noteNumber.localeCompare(right.noteNumber),
        invoice: left.linkedInvoiceNumber.localeCompare(right.linkedInvoiceNumber),
        date: new Date(left.issuedDate).getTime() - new Date(right.issuedDate).getTime(),
        amount: left.amount - right.amount,
      } as Record<string, number>;

      return (map[field] || 0) * (isDesc ? -1 : 1);
    });
  }

  return records;
});

const totalNotes = computed(() => filteredNotes.value.length);
const paginatedNotes = computed(() => {
  if (itemsPerPage.value === -1) return filteredNotes.value;
  const start = (page.value - 1) * itemsPerPage.value;
  return filteredNotes.value.slice(start, start + itemsPerPage.value);
});

const openCreateDrawer = () => {
  emit("create-credit-note");
};

const openEditDrawer = (id: number) => {
  emit("edit-credit-note", id);
};

const openDeleteDialog = (id: number) => {
  pendingDeleteId.value = id;
  isDeleteDialogOpen.value = true;
};

const closeDeleteDialog = () => {
  pendingDeleteId.value = null;
  isDeleteDialogOpen.value = false;
};

const confirmDelete = () => {
  if (pendingDeleteId.value === null) return closeDeleteDialog();
  creditNotesStore.removeNote(pendingDeleteId.value);
  notifications.push("Credit note deleted successfully.", "success", 3500);
  closeDeleteDialog();
};

const updateOptions = (options: any) => {
  sortBy.value = options.sortBy[0]?.key;
  orderBy.value = options.sortBy[0]?.order;
};

const menuList = (id: number) => [
  {
    title: "Edit",
    value: "edit",
    prependIcon: "tabler-pencil",
    onClick: () => openEditDrawer(id),
  },
  {
    title: "Open Invoice",
    value: "open-invoice",
    prependIcon: "tabler-external-link",
    onClick: () => {
      const note = creditNotesStore.byId(id);
      if (!note) return;
      router.push(`/apps/invoice/preview/${note.linkedInvoiceId}`);
    },
  },
  {
    title: "Delete",
    value: "delete",
    prependIcon: "tabler-trash",
    class: "text-error",
    onClick: () => openDeleteDialog(id),
  },
];

watch([searchQuery, selectedStatus, itemsPerPage], () => {
  page.value = 1;
});

watch(totalNotes, (value) => {
  const maxPage =
    itemsPerPage.value === -1 ? 1 : Math.max(1, Math.ceil(value / itemsPerPage.value));
  if (page.value > maxPage) page.value = maxPage;
});
</script>

<template>
  <section id="credit-note-list">
    <VCard>
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
            <AppTextField v-model="searchQuery" placeholder="Search Credit Note" />
          </div>
          <div class="quotation-list-filter">
            <AppSelect
              v-model="selectedStatus"
              placeholder="Status"
              clearable
              clear-icon="tabler-x"
              single-line
              :items="['Draft', 'Issued', 'Voided']"
            />
          </div>
          <VBtn prepend-icon="tabler-plus" @click="openCreateDrawer">Add Credit Note</VBtn>
        </div>
      </VCardText>
      <VDivider />

      <VDataTableServer
        v-model:items-per-page="itemsPerPage"
        v-model:page="page"
        :items-length="totalNotes"
        :headers="headers"
        :items="paginatedNotes"
        item-value="id"
        class="text-no-wrap"
        @update:options="updateOptions"
      >
        <template #item.id="{ item }">
          <VBtn
            variant="text"
            class="pa-0 text-none font-weight-medium"
            @click="openEditDrawer(item.id)"
          >
            {{ item.noteNumber }}
          </VBtn>
        </template>

        <template #item.invoice="{ item }">
          <div class="d-flex flex-column">
            <RouterLink :to="`/apps/invoice/preview/${item.linkedInvoiceId}`" class="text-link">
              {{ item.linkedInvoiceNumber }}
            </RouterLink>
            <span class="text-sm text-disabled">{{ item.clientName }}</span>
          </div>
        </template>

        <template #item.date="{ item }">{{ formatSystemDate(item.issuedDate) }}</template>
        <template #item.amount="{ item }">${{ item.amount.toLocaleString() }}</template>
        <template #item.status="{ item }">
          <VChip :color="statusColor(item.status)" size="x-small" variant="tonal" label>
            {{ item.status }}
          </VChip>
        </template>
        <template #item.actions="{ item }">
          <MoreBtn :menu-list="menuList(item.id)" item-props color="undefined" />
        </template>
        <template #bottom>
          <TablePagination
            v-model:page="page"
            :items-per-page="itemsPerPage"
            :total-items="totalNotes"
          />
        </template>
      </VDataTableServer>
    </VCard>

    <VDialog v-model="isDeleteDialogOpen" max-width="440" persistent>
      <VCard>
        <VCardText class="pt-6">
          Are you sure you want to delete this credit note?
        </VCardText>
        <VCardActions class="pt-2 px-6 pb-6">
          <DialogActionBar
            save-text="Delete"
            save-color="error"
            save-variant="tonal"
            cancel-text="Cancel"
            @save="confirmDelete"
            @cancel="closeDeleteDialog"
          />
        </VCardActions>
      </VCard>
    </VDialog>
  </section>
</template>

<style lang="scss">
#credit-note-list {
  .quotation-list-toolbar {
    justify-content: flex-end;
  }

  .quotation-list-filter {
    inline-size: 12rem;
  }
}
</style>
