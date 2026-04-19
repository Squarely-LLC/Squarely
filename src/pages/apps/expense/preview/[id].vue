<script setup lang="ts">
import { useExpensesStore } from "@/stores/expenses";
import { useNotificationsStore } from "@/stores/notifications";
import { createPdfFileFromElement } from "@/utils/domPdf";
import EmailDialog from "@/views/apps/email/EmailDialog.vue";
import { formatSystemDate } from "@core/utils/formatters";

const route = useRoute();
const router = useRouter();
const expensesStore = useExpensesStore();
const notifications = useNotificationsStore();

expensesStore.init();

const isEmbeddedActionFrame = route.query.embedded === "1";
const expensePdfTarget = ref<HTMLElement | null>(null);
const isEmailDialogOpen = ref(false);
const emailDialogRef = ref<any | null>(null);
const hasExecutedAutoAction = ref(false);

const expenseRecord = computed(() => expensesStore.byId(String(route.params.id)));
const expense = computed(() => expenseRecord.value?.expense ?? null);

const expenseEmailDraft = computed(() => {
  if (!expense.value) {
    return { to: "", subject: "", message: "", attachments: [] };
  }

  return {
    to: expense.value.supplier.email?.trim() || "",
    subject: `Bill ${expense.value.billNumber}`,
    message: `Dear ${expense.value.supplier.name || "there"},

Please find bill ${expense.value.billNumber} attached.

Amount: $${expense.value.amount.toLocaleString()}

Thank you,
Squarely`.trim(),
    attachments: [{ name: `${expense.value.billNumber}.pdf` }],
  };
});

const triggerPdfDownload = async () => {
  if (!expense.value || !expensePdfTarget.value) return;

  const pdfFile = await createPdfFileFromElement(
    expensePdfTarget.value,
    `${expense.value.billNumber}.pdf`,
  );
  const objectUrl = URL.createObjectURL(pdfFile);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = pdfFile.name;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
};

const printExpense = async () => {
  if (!expensePdfTarget.value || !expense.value) return;

  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=900,height=1200");
  if (!printWindow) return;

  printWindow.document.write(`
    <html>
      <head>
        <title>${expense.value.billNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
          .expense-preview-print { max-width: 800px; margin: 0 auto; }
          .expense-header { display: flex; justify-content: space-between; margin-bottom: 24px; }
          .expense-card { border: 1px solid #d1d5db; border-radius: 8px; padding: 20px; }
          .expense-row { display: flex; justify-content: space-between; gap: 16px; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
          .expense-row:last-child { border-bottom: 0; }
          .expense-label { color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
          .expense-value { font-size: 15px; font-weight: 600; }
        </style>
      </head>
      <body>
        ${expensePdfTarget.value.outerHTML}
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
};

const openExpenseEmailDialog = () => {
  isEmailDialogOpen.value = true;
  nextTick(() => {
    emailDialogRef.value?.openWith?.(expenseEmailDraft.value);
  });
};

const onExpenseEmailSend = (payload: any) => {
  const recipients = Array.isArray(payload?.to)
    ? payload.to.filter(Boolean)
    : payload?.to
      ? [String(payload.to)]
      : [];
  const subject = String(payload?.subject || "(no subject)");
  notifications.push(
    `Email sent${recipients.length ? ` to ${recipients.length} recipient${recipients.length > 1 ? "s" : ""}` : ""}: ${subject}`,
    "success",
    3500,
  );
  isEmailDialogOpen.value = false;
};

const editExpense = () => {
  router.push({ path: "/finance", query: { tab: "expenses" } });
};

const handleEmbeddedAction = async (action: "print" | "download") => {
  if (action === "print") {
    await printExpense();
    return;
  }

  await triggerPdfDownload();
};

const handlePreviewActionMessage = async (event: MessageEvent) => {
  if (!isEmbeddedActionFrame) return;
  if (event.origin !== window.location.origin) return;
  if (event.data?.type !== "expense-preview-action") return;

  const action = event.data?.payload?.action;
  if (action !== "print" && action !== "download") return;
  if (hasExecutedAutoAction.value) return;

  hasExecutedAutoAction.value = true;
  await handleEmbeddedAction(action);
  window.setTimeout(() => {
    hasExecutedAutoAction.value = false;
  }, 250);
};

onMounted(() => {
  if (isEmbeddedActionFrame) {
    window.addEventListener("message", handlePreviewActionMessage);
    window.parent.postMessage(
      {
        type: "expense-preview-ready",
        expenseId: expense.value?.id ?? null,
      },
      window.location.origin,
    );
    return;
  }

  if (route.query.email === "1") {
    openExpenseEmailDialog();
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("message", handlePreviewActionMessage);
});
</script>

<template>
  <div class="expense-preview-page pa-6">
    <VAlert v-if="!expense" color="error" variant="tonal">
      Bill not found.
    </VAlert>

    <template v-else>
      <div v-if="!isEmbeddedActionFrame" class="d-flex justify-end mb-6 gap-3">
        <VBtn variant="tonal" @click="editExpense">Back To List</VBtn>
        <VBtn variant="tonal" prepend-icon="tabler-printer" @click="printExpense">
          Print
        </VBtn>
        <VBtn variant="tonal" prepend-icon="tabler-download" @click="triggerPdfDownload">
          Download
        </VBtn>
        <VBtn prepend-icon="tabler-mail" @click="openExpenseEmailDialog">
          Email
        </VBtn>
      </div>

      <div ref="expensePdfTarget" class="expense-preview-print">
        <div class="expense-header">
          <div>
            <h2 class="text-h4 mb-2">Bill</h2>
            <div class="text-body-1">Squarely LLC</div>
          </div>

          <div class="text-right">
            <div class="text-caption text-uppercase">Bill #</div>
            <div class="text-h6">{{ expense.billNumber }}</div>
          </div>
        </div>

        <VCard class="expense-card" flat>
          <VCardText>
            <div class="expense-row">
              <div>
                <div class="expense-label">Supplier</div>
                <div class="expense-value">{{ expense.supplier.name || "-" }}</div>
              </div>
              <div class="text-right">
                <div class="expense-label">Date</div>
                <div class="expense-value">{{ formatSystemDate(expense.billDate) }}</div>
              </div>
            </div>

            <div class="expense-row">
              <div>
                <div class="expense-label">Category</div>
                <div class="expense-value">{{ expense.category || "-" }}</div>
              </div>
              <div class="text-right">
                <div class="expense-label">Supplier Invoice</div>
                <div class="expense-value">{{ expense.supplierInvoiceNumber || "-" }}</div>
              </div>
            </div>

            <div class="expense-row">
              <div>
                <div class="expense-label">Status</div>
                <div class="expense-value">{{ expense.status }}</div>
              </div>
              <div class="text-right">
                <div class="expense-label">Amount</div>
                <div class="expense-value">${{ expense.amount.toLocaleString() }}</div>
              </div>
            </div>

            <div class="expense-row">
              <div>
                <div class="expense-label">Attachment</div>
                <div class="expense-value">{{ expense.attachmentName || "No attachment" }}</div>
              </div>
              <div class="text-right">
                <div class="expense-label">Paid At</div>
                <div class="expense-value">
                  {{ expense.paidAt ? formatSystemDate(expense.paidAt) : "-" }}
                </div>
              </div>
            </div>

            <div class="expense-row">
              <div class="w-100">
                <div class="expense-label">Note</div>
                <div class="expense-value">{{ expenseRecord?.note || "-" }}</div>
              </div>
            </div>
          </VCardText>
        </VCard>
      </div>

      <EmailDialog
        ref="emailDialogRef"
        v-model:is-dialog-visible="isEmailDialogOpen"
        @close="isEmailDialogOpen = false"
        @send="onExpenseEmailSend"
      />
    </template>
  </div>
</template>

<style scoped>
.expense-preview-page {
  min-block-size: 100%;
}

.expense-preview-print {
  max-inline-size: 860px;
  margin-inline: auto;
}

.expense-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-block-end: 1.5rem;
}

.expense-card {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
}

.expense-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding-block: 0.875rem;
  border-block-end: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.expense-row:last-child {
  border-block-end: 0;
}

.expense-label {
  margin-block-end: 0.35rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.expense-value {
  white-space: pre-wrap;
  font-size: 0.975rem;
  font-weight: 600;
}
</style>
