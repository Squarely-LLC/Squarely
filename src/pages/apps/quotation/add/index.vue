<script lang="ts" setup>
import DialogActionBar from "@/components/DialogActionBar.vue";
import type { ContactProperties } from "@/plugins/fake-api/handlers/apps/contact/types";
import type { Client } from "@/plugins/fake-api/handlers/apps/quotation/types";
import { useConfigStore } from "@/stores/config";
import { useContactsStore } from "@/stores/contacts";
import { cloneQuotationRecord, useQuotationsStore } from "@/stores/quotations";
import {
  buildQuotationNote,
  buildQuotationPaymentDetails,
  buildQuotationSalesperson,
  buildQuotationThanksNote,
} from "@/utils/quotationConfig";
import QuotationEditable from "@/views/apps/quotation/QuotationEditable.vue";
import QuotationSendQuotationDrawer from "@/views/apps/quotation/QuotationSendQuotationDrawer.vue";
import type {
  PurchasedProduct,
  QuotationData,
} from "@/views/apps/quotation/types";
import type { RouteLocationRaw } from "vue-router";
import { onBeforeRouteLeave } from "vue-router";

const route = useRoute();
const router = useRouter();
const configStore = useConfigStore();
configStore.init();
const contactsStore = useContactsStore();
contactsStore.init();
const quotationsStore = useQuotationsStore();
quotationsStore.init();

const mapContactToClient = (contact: ContactProperties): Client => ({
  address: contact.address?.trim() || "",
  company: contact.fullName.trim(),
  companyEmail: contact.email?.trim() || "",
  country: contact.country?.trim() || "Lebanon",
  contact: contact.number?.trim() || "",
  name: contact.fullName.trim(),
});

const buildDefaultClient = (): Client => {
  const firstContact = contactsStore.all.find((contact) =>
    contact.fullName?.trim(),
  );

  if (firstContact) return mapContactToClient(firstContact);

  return {
    address: "",
    company: "",
    companyEmail: "",
    country: "Lebanon",
    contact: "",
    name: "",
  };
};

const buildBlankQuotation = (): QuotationData => {
  const id = quotationsStore.nextId();

  return {
    quotation: {
      id,
      quoteNumber: `QT-${id}`,
      issuedDate: new Date().toISOString().slice(0, 10),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10),
      client: buildDefaultClient(),
      service: "Architectural services",
      total: 0,
      avatar: "",
      quotationStatus: "Pending",
      balance: 0,
      dealId: null,
      linkedRecordType: null,
      source: "squarely",
      attachmentName: null,
      parentQuotationId: null,
      isRevision: false,
      revisionLabel: null,
    },
    paymentDetails: buildQuotationPaymentDetails(
      0,
      configStore.legal,
      configStore.financial,
    ),
    purchasedProducts: [
      {
        title: "New line item",
        cost: 0,
        hours: 1,
        description: "",
      },
    ],
    note: buildQuotationNote(configStore.financial, 7),
    paymentMethod: "Bank Transfer",
    paymentLink: null,
    salesperson: buildQuotationSalesperson(configStore.legal),
    thanksNote: buildQuotationThanksNote(configStore.legal),
  };
};

const getBaseQuoteNumber = (quoteNumber: string) =>
  quoteNumber.trim().replace(/(?:-R\d+)+$/i, "");

const buildRevisionDraft = (parentId: number): QuotationData => {
  const sourceRecord = quotationsStore.byId(parentId);
  if (!sourceRecord) return buildBlankQuotation();

  const rootQuotationId =
    sourceRecord.quotation.parentQuotationId ?? sourceRecord.quotation.id;
  const baseQuoteNumberForLookup = getBaseQuoteNumber(
    sourceRecord.quotation.quoteNumber,
  );
  const revisionPattern = new RegExp(
    `^${baseQuoteNumberForLookup.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-R(\\d+)$`,
    "i",
  );
  const maxExistingNumber = quotationsStore.all.reduce((max, record) => {
    const match = record.quotation.quoteNumber.match(revisionPattern);
    return match?.[1] ? Math.max(max, Number(match[1])) : max;
  }, 0);
  const revisionNumber = maxExistingNumber + 1;
  const revisionLabel = `R${revisionNumber}`;
  const revisionId = quotationsStore.nextId();
  const baseQuoteNumber = getBaseQuoteNumber(
    sourceRecord.quotation.quoteNumber,
  );
  const revisionQuoteNumber = `${baseQuoteNumber}-${revisionLabel}`;
  const revisionDraft = cloneQuotationRecord(sourceRecord);

  revisionDraft.quotation.id = revisionId;
  revisionDraft.quotation.quoteNumber = revisionQuoteNumber;
  revisionDraft.quotation.parentQuotationId = rootQuotationId;
  revisionDraft.quotation.isRevision = true;
  revisionDraft.quotation.revisionLabel = revisionLabel;
  revisionDraft.quotation.issuedDate = new Date().toISOString().slice(0, 10);
  revisionDraft.quotation.dueDate = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000,
  )
    .toISOString()
    .slice(0, 10);
  revisionDraft.quotation.quotationStatus = "Pending";
  revisionDraft.note = `${sourceRecord.note}\n${revisionLabel} draft created from ${baseQuoteNumber}.`;

  return revisionDraft;
};

const buildInitialQuotation = (): QuotationData => {
  const revisionOf = Number(route.query.revisionOf);

  if (Number.isFinite(revisionOf) && revisionOf > 0) {
    return buildRevisionDraft(revisionOf);
  }

  return buildBlankQuotation();
};

const quotationData = ref<QuotationData>(buildInitialQuotation());
const initialDraftSnapshot = ref("");
const paymentTerms = ref(true);
const clientNotes = ref(false);
const paymentStub = ref(false);
const paymentMethods = ["Bank Transfer", "Cash", "Credit Card"];
const isSendQuotationSidebarVisible = ref(false);
const isLeaveDialogVisible = ref(false);
const pendingNavigationTarget = ref<RouteLocationRaw | null>(null);
const bypassUnsavedWarning = ref(false);

const buildDraftSnapshot = (draft: QuotationData) =>
  JSON.stringify(cloneQuotationRecord(draft));

initialDraftSnapshot.value = buildDraftSnapshot(quotationData.value);

const hasUnsavedChanges = computed(
  () => buildDraftSnapshot(quotationData.value) !== initialDraftSnapshot.value,
);

watch(
  () => route.query.revisionOf,
  () => {
    quotationData.value = buildInitialQuotation();
    initialDraftSnapshot.value = buildDraftSnapshot(quotationData.value);
  },
);

watch(
  () => quotationData.value.paymentMethod,
  (paymentMethod) => {
    if (paymentMethod !== "Credit Card") {
      quotationData.value.paymentLink = null;
    }
  },
);

const addProduct = (value: PurchasedProduct) => {
  quotationData.value.purchasedProducts.push(value);
};

const removeProduct = (id: number) => {
  quotationData.value.purchasedProducts.splice(id, 1);
};

const requestLeave = (target: RouteLocationRaw) => {
  if (!hasUnsavedChanges.value) {
    router.push(target);
    return;
  }

  pendingNavigationTarget.value = target;
  isLeaveDialogVisible.value = true;
};

const cancelLeave = () => {
  pendingNavigationTarget.value = null;
  isLeaveDialogVisible.value = false;
};

const confirmLeave = async () => {
  const target = pendingNavigationTarget.value;

  pendingNavigationTarget.value = null;
  isLeaveDialogVisible.value = false;
  if (!target) return;

  bypassUnsavedWarning.value = true;
  await router.push(target);
};

const saveQuotation = () => {
  const total = quotationData.value.purchasedProducts.reduce(
    (sum, product) =>
      sum + Number(product.cost || 0) * Number(product.hours || 0),
    0,
  );

  quotationData.value.quotation.total = total;
  quotationData.value.paymentDetails = buildQuotationPaymentDetails(
    total,
    configStore.legal,
    configStore.financial,
  );
  quotationData.value.note = buildQuotationNote(configStore.financial, 7);
  quotationData.value.salesperson = buildQuotationSalesperson(configStore.legal);
  quotationData.value.thanksNote = buildQuotationThanksNote(configStore.legal);
  quotationData.value.paymentLink =
    quotationData.value.paymentMethod === "Credit Card"
      ? quotationData.value.paymentLink?.trim() || null
      : null;

  const created = quotationsStore.addQuotation(
    cloneQuotationRecord(quotationData.value),
  );
  if (!created) return;

  initialDraftSnapshot.value = buildDraftSnapshot(quotationData.value);
  bypassUnsavedWarning.value = true;
  router.push({
    name: "apps-quotation-preview-id",
    params: { id: created.quotation.id },
  });
};

onBeforeRouteLeave((to) => {
  if (bypassUnsavedWarning.value) {
    bypassUnsavedWarning.value = false;
    return true;
  }

  if (!hasUnsavedChanges.value) return true;

  pendingNavigationTarget.value = to.fullPath;
  isLeaveDialogVisible.value = true;
  return false;
});

const onBeforeWindowUnload = (event: BeforeUnloadEvent) => {
  if (!hasUnsavedChanges.value) return;

  event.preventDefault();
  event.returnValue = "";
};

onMounted(() => {
  window.addEventListener("beforeunload", onBeforeWindowUnload);
});

onBeforeUnmount(() => {
  window.removeEventListener("beforeunload", onBeforeWindowUnload);
});
</script>

<template>
  <VRow>
    <VCol cols="12" md="9">
      <QuotationEditable
        :data="quotationData"
        @push="addProduct"
        @remove="removeProduct"
      />
    </VCol>

    <VCol cols="12" md="3">
      <VCard class="mb-8">
        <VCardText>
          <VBtn
            block
            prepend-icon="tabler-send"
            class="mb-4"
            @click="isSendQuotationSidebarVisible = true"
          >
            Send Quotation
          </VBtn>

          <VBtn
            block
            color="secondary"
            variant="tonal"
            class="mb-4"
            @click="requestLeave({ name: 'apps-quotation-list' })"
          >
            Back to List
          </VBtn>

          <VBtn block @click="saveQuotation">Save</VBtn>
        </VCardText>
      </VCard>

      <AppSelect
        id="payment-method"
        v-model="quotationData.paymentMethod"
        :items="paymentMethods"
        label="Accept Payment Via"
        class="mb-6"
      />

      <AppTextField
        v-if="quotationData.paymentMethod === 'Credit Card'"
        id="payment-link"
        v-model="quotationData.paymentLink"
        label="Credit Card Payment Link"
        placeholder="https://"
        class="mb-6"
      />

      <div class="d-flex align-center justify-space-between">
        <VLabel for="payment-terms">Payment Terms</VLabel>
        <div>
          <VSwitch id="payment-terms" v-model="paymentTerms" />
        </div>
      </div>

      <div class="d-flex align-center justify-space-between">
        <VLabel for="client-notes">Client Notes</VLabel>
        <div>
          <VSwitch id="client-notes" v-model="clientNotes" />
        </div>
      </div>

      <div class="d-flex align-center justify-space-between">
        <VLabel for="payment-stub">Payment Stub</VLabel>
        <div>
          <VSwitch id="payment-stub" v-model="paymentStub" />
        </div>
      </div>
    </VCol>
  </VRow>

  <QuotationSendQuotationDrawer
    v-model:is-drawer-open="isSendQuotationSidebarVisible"
  />

  <VDialog v-model="isLeaveDialogVisible" max-width="440" persistent>
    <VCard>
      <VCardText class="pt-6">
        You have unsaved changes in this quotation. Leave this page without
        saving?
      </VCardText>

      <VCardActions class="pt-2 px-6 pb-6">
        <DialogActionBar
          save-text="Leave"
          save-color="error"
          save-variant="tonal"
          cancel-text="Stay"
          @save="confirmLeave"
          @cancel="cancelLeave"
        />
      </VCardActions>
    </VCard>
  </VDialog>
</template>
