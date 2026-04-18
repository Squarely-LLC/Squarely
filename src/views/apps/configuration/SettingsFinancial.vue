<script setup lang="ts">
import { requiredValidator } from "@/@core/utils/validators";
import type {
  BankDetailsItem,
  DealsConfig,
  FinancialConfig,
  InvoicingSettings,
  VatSettings,
} from "@/plugins/fake-api/handlers/config/types";
import { useConfigStore } from "@/stores/config";
import { useNotificationsStore } from "@/stores/notifications";
import { normalizeRichText } from "@/utils/richText";
import { computed, onMounted, ref } from "vue";
const isAddPaymentMethodsDialogVisible = ref(false);
const isPaymentProvidersDialogVisible = ref(false);

// Config store
const store = useConfigStore();
const notifications = useNotificationsStore();
store.init();

// Local UI state: ensure non-optional shape for template bindings
type FinancialUiState = Partial<FinancialConfig> & {
  currency: string;
  vat: VatSettings;
  bankDetails: BankDetailsItem[];
  invoicing: InvoicingSettings & {
    showNotes: boolean;
    termsAndNotes: string;
  };
  invoiceSequence: string;
  paymentReminders: {
    enabled: boolean;
    invoiceDaysBefore: number;
    purchaseDaysBefore: number;
  };
};

type DealsUiState = Partial<DealsConfig> & {
  quotationStartsSeq: string;
  proformaStartSeq: string;
};

// Initialize with safe defaults to avoid undefined access on first render
const fin = ref<FinancialUiState>({
  currency: "US Dollar (USD $)",
  vat: { enabled: false, registrationNumber: "" },
  bankDetails: [{ enabled: false }],
  invoicing: {
    showNotes: true,
    termsAndNotes: "",
  },
  invoiceSequence: "",
  paymentReminders: {
    enabled: false,
    invoiceDaysBefore: 0,
    purchaseDaysBefore: 0,
  },
});

const deals = ref<DealsUiState>({
  quotationStartsSeq: "",
  proformaStartSeq: "",
});

const ensureDefaults = () => {
  fin.value.currency ??= "US Dollar (USD $)";
  fin.value.vat ??= { enabled: false, registrationNumber: "" };
  fin.value.bankDetails ??= [{ enabled: false }];
  if (!fin.value.bankDetails[0]) fin.value.bankDetails[0] = { enabled: false };
  fin.value.invoicing ??= {
    showNotes: true,
    termsAndNotes: "",
  };
  fin.value.invoicing.showNotes ??= true;
  fin.value.invoicing.termsAndNotes ??= "";
  fin.value.invoiceSequence ??= "";
  fin.value.paymentReminders ??= {
    enabled: false,
    invoiceDaysBefore: 0,
    purchaseDaysBefore: 0,
  };
  deals.value.quotationStartsSeq ??= "";
  deals.value.proformaStartSeq ??= "";
};

const syncFromStore = () => {
  const cfg = (store.financial || {}) as FinancialConfig;
  const dealsCfg = (store.all?.deals || {}) as DealsConfig;
  const termsAndNotes =
    normalizeRichText(cfg.invoicing?.noteOnQuotation) ||
    normalizeRichText(cfg.invoicing?.noteOnProforma) ||
    normalizeRichText(cfg.invoicing?.notesOnInvoice) ||
    fin.value.invoicing.termsAndNotes;

  fin.value = {
    ...fin.value,
    ...cfg,
    vat: {
      enabled: cfg.vat?.enabled ?? fin.value.vat.enabled,
      registrationNumber:
        cfg.vat?.registrationNumber ?? fin.value.vat.registrationNumber,
      attachDocument: cfg.vat?.attachDocument ?? fin.value.vat.attachDocument,
    },
    bankDetails: cfg.bankDetails?.length
      ? [{ ...fin.value.bankDetails[0], ...cfg.bankDetails[0] }]
      : fin.value.bankDetails,
    invoicing: {
      showNotes: cfg.invoicing?.showNotes ?? fin.value.invoicing.showNotes,
      termsAndNotes: normalizeRichText(termsAndNotes),
    },
    paymentReminders: {
      enabled:
        cfg.paymentReminders?.enabled ?? fin.value.paymentReminders.enabled,
      invoiceDaysBefore:
        cfg.paymentReminders?.invoiceDaysBefore ??
        fin.value.paymentReminders.invoiceDaysBefore,
      purchaseDaysBefore:
        cfg.paymentReminders?.purchaseDaysBefore ??
        fin.value.paymentReminders.purchaseDaysBefore,
    },
  } as FinancialUiState;

  deals.value = {
    ...deals.value,
    ...dealsCfg,
    quotationStartsSeq:
      dealsCfg.quotationStartsSeq ?? deals.value.quotationStartsSeq,
    proformaStartSeq: dealsCfg.proformaStartSeq ?? deals.value.proformaStartSeq,
  };

  ensureDefaults();
};

onMounted(syncFromStore);

// Dirty tracking and persistence
const savedSnapshot = ref<string>("");
const takeSnapshot = () => {
  // Only persist a single bank detail for now
  const snap = {
    currency: fin.value.currency,
    vat: { ...fin.value.vat },
    bankDetails: fin.value.bankDetails?.length
      ? [{ ...fin.value.bankDetails[0] }]
      : [],
    invoicing: {
      showNotes: fin.value.invoicing.showNotes,
      noteOnQuotation: normalizeRichText(fin.value.invoicing.termsAndNotes),
      noteOnProforma: normalizeRichText(fin.value.invoicing.termsAndNotes),
      notesOnInvoice: normalizeRichText(fin.value.invoicing.termsAndNotes),
    },
    invoiceSequence: fin.value.invoiceSequence,
    quotationStartsSeq: deals.value.quotationStartsSeq,
    proformaStartSeq: deals.value.proformaStartSeq,
    paymentReminders: { ...fin.value.paymentReminders },
  };
  return JSON.stringify(snap);
};

// Initialize snapshot after first sync
onMounted(() => {
  savedSnapshot.value = takeSnapshot();
});

const isDirty = computed(() => takeSnapshot() !== savedSnapshot.value);

// Validation helpers and form validity
const nonEmpty = (v?: string | null) => !!String(v ?? "").trim().length;
const bank0 = computed(
  () =>
    (fin.value.bankDetails && fin.value.bankDetails[0]) ||
    ({ enabled: false } as BankDetailsItem),
);

const isVatValid = computed(
  () => !fin.value.vat.enabled || nonEmpty(fin.value.vat.registrationNumber),
);
const isBankValid = computed(
  () =>
    !bank0.value.enabled ||
    (nonEmpty(bank0.value.bankName) &&
      nonEmpty(bank0.value.accountName) &&
      nonEmpty(bank0.value.iban) &&
      nonEmpty(bank0.value.accountNumber) &&
      nonEmpty(bank0.value.branch) &&
      nonEmpty(bank0.value.swiftCode)),
);
const isCurrencyValid = computed(() => nonEmpty(fin.value.currency));
const isInvoiceValid = computed(() => nonEmpty(fin.value.invoiceSequence));
const isDealsValid = computed(
  () =>
    nonEmpty(deals.value.quotationStartsSeq) &&
    nonEmpty(deals.value.proformaStartSeq),
);
const isRemindersValid = computed(() => {
  if (!fin.value.paymentReminders.enabled) return true;
  const inv = Number(fin.value.paymentReminders.invoiceDaysBefore ?? 0);
  const pur = Number(fin.value.paymentReminders.purchaseDaysBefore ?? 0);
  return Number.isFinite(inv) && inv >= 0 && Number.isFinite(pur) && pur >= 0;
});
const isValid = computed(
  () =>
    isVatValid.value &&
    isBankValid.value &&
    isCurrencyValid.value &&
    isInvoiceValid.value &&
    isDealsValid.value &&
    isRemindersValid.value,
);

const toServerPayload = (): Partial<FinancialConfig> => {
  return {
    currency: fin.value.currency,
    vat: { ...fin.value.vat },
    bankDetails: fin.value.bankDetails?.length
      ? [{ ...fin.value.bankDetails[0] }]
      : [],
    invoicing: {
      showNotes: fin.value.invoicing.showNotes,
      noteOnQuotation: normalizeRichText(fin.value.invoicing.termsAndNotes),
      noteOnProforma: normalizeRichText(fin.value.invoicing.termsAndNotes),
      notesOnInvoice: normalizeRichText(fin.value.invoicing.termsAndNotes),
    },
    invoiceSequence: fin.value.invoiceSequence,
    paymentReminders: { ...fin.value.paymentReminders },
  } as Partial<FinancialConfig>;
};

const toDealsPayload = (): Partial<DealsConfig> => {
  return {
    ...(store.all?.deals || {}),
    quotationStartsSeq: deals.value.quotationStartsSeq,
    proformaStartSeq: deals.value.proformaStartSeq,
  };
};

const onDiscard = () => {
  syncFromStore();
  savedSnapshot.value = takeSnapshot();
};

const onSave = async () => {
  const payload = toServerPayload();
  const res = await store.saveRemote({
    financial: payload,
    deals: toDealsPayload(),
  } as any);
  if (res) {
    notifications.push("Financial settings saved", "success", 2500);
    syncFromStore();
    savedSnapshot.value = takeSnapshot();
  } else {
    notifications.push("Failed to save financial settings", "error", 3000);
  }
};

// Derived/computed helpers bound in template
const sequenceContainsYear = computed({
  get() {
    const seq = String(fin.value.invoiceSequence || "");
    return /Y{2,4}|\{year\}/i.test(seq);
  },
  set(val: boolean) {
    let seq = String(fin.value.invoiceSequence || "");
    const has = /Y{2,4}|\{year\}/i.test(seq);
    if (val && !has)
      fin.value.invoiceSequence = (seq ? seq + "-" : "") + "YYYY";
    if (!val && has)
      fin.value.invoiceSequence = seq.replace(/-?(Y{2,4}|\{year\})/gi, "");
  },
});

const invoiceReminderDays = computed<number>({
  get() {
    return fin.value.paymentReminders.invoiceDaysBefore ?? 0;
  },
  set(v: number) {
    const val = Math.max(0, Number(v) || 0);
    fin.value.paymentReminders.invoiceDaysBefore = val;
  },
});

const purchaseReminderDays = computed<number>({
  get() {
    return fin.value.paymentReminders.purchaseDaysBefore ?? 0;
  },
  set(v: number) {
    const val = Math.max(0, Number(v) || 0);
    fin.value.paymentReminders.purchaseDaysBefore = val;
  },
});

const paymentRemindersEnabled = computed<boolean>({
  get() {
    return !!fin.value.paymentReminders?.enabled;
  },
  set(v: boolean) {
    if (!fin.value.paymentReminders)
      fin.value.paymentReminders = {
        enabled: v,
        invoiceDaysBefore: 0,
        purchaseDaysBefore: 0,
      };
    else fin.value.paymentReminders.enabled = v;
  },
});
</script>

<template>
  <div>
    <!-- 👉 Payment Providers  -->
    <VCard class="mb-6" title="Currency">
      <VCardText>
        <AppSelect
          placeholder="Select Currency"
          :items="[
            'US Dollar (USD $)',
            'Euro (EUR €)',
            'British Pound (GBP £)',
          ]"
          v-model="fin.currency"
        />
      </VCardText>
    </VCard>

    <!-- 👉 VAT -->
    <VCard class="mb-6" title="VAT">
      <template #append>
        <VSwitch
          v-model="fin.vat.enabled"
          inset
          hide-details
          density="compact"
          class="ma-0 pa-0"
        />
      </template>
      <VCardText>
        <VRow>
          <VCol cols="12" md="12">
            <template v-if="fin.vat.enabled">
              <AppTextField
                v-model="fin.vat.registrationNumber"
                :rules="[requiredValidator]"
                label="VAT Registration Number"
              />
            </template>
            <template v-else>
              <AppTextField
                v-model="fin.vat.registrationNumber"
                :rules="[requiredValidator]"
                label="TRN Registration Number"
              />
            </template>
          </VCol>
        </VRow>
      </VCardText>
    </VCard>

    <!-- 👉 Manual Payment Methods -->
    <VCard title="Bank Details" class="mb-6">
      <template #append>
        <VSwitch
          v-model="fin.bankDetails[0].enabled"
          inset
          hide-details
          density="compact"
          class="ma-0 pa-0"
        />
      </template>
      <VCardText>
        <VRow>
          <template v-if="fin.bankDetails[0].enabled">
            <VCol cols="12" md="6">
              <AppTextField
                v-model="fin.bankDetails[0].bankName"
                :rules="[requiredValidator]"
                label="Bank Name"
              />
            </VCol>
            <VCol cols="12" md="6">
              <AppTextField
                v-model="fin.bankDetails[0].accountName"
                :rules="[requiredValidator]"
                label="Account Name"
              />
            </VCol>
            <VCol cols="12" md="6">
              <AppTextField
                v-model="fin.bankDetails[0].iban"
                :rules="[requiredValidator]"
                label="IBN Number"
              />
            </VCol>
            <VCol cols="12" md="6">
              <AppTextField
                v-model="fin.bankDetails[0].accountNumber"
                :rules="[requiredValidator]"
                label="Account Number"
              />
            </VCol>
            <VCol cols="12" md="6">
              <AppTextField
                v-model="fin.bankDetails[0].branch"
                :rules="[requiredValidator]"
                label="Bank Branch"
              />
            </VCol>
            <VCol cols="12" md="6">
              <AppTextField
                v-model="fin.bankDetails[0].swiftCode"
                :rules="[requiredValidator]"
                label="Swift Code"
              />
            </VCol>
          </template>
          <template v-else>
            <VCol cols="12" md="12">
              <h3 class="text-center disabled">
                <VIcon :icon="'tabler-ban'" size="22" class="cursor-default" />

                Banking is disabled
              </h3>
            </VCol>
          </template>
        </VRow>
      </VCardText>
    </VCard>

    <VCard title="Invoicing" class="mb-6">
      <VCardText>
        <VRow>
          <VCol cols="12" md="6">
            <AppTextField
              v-model="deals.quotationStartsSeq"
              :rules="[requiredValidator]"
              label="Quotation Prefix"
              placeholder="QTN-"
            />
          </VCol>
          <VCol cols="12" md="6">
            <AppTextField
              v-model="deals.proformaStartSeq"
              :rules="[requiredValidator]"
              label="Proforma Prefix"
              placeholder="PF-"
            />
          </VCol>
          <VCol cols="12" md="6">
            <AppTextField
              v-model="fin.invoiceSequence"
              :rules="[requiredValidator]"
              label="Invoice Prefix / Sequence"
            />
          </VCol>
          <VCol cols="12" md="6">
            <div class="d-flex align-center" style="padding-block-start: 28px">
              <span class="me-4">Sequence Contains the Year?</span>
              <VSwitch
                v-model="sequenceContainsYear"
                inset
                hide-details
                density="compact"
                :true-value="true"
                :false-value="false"
                class="ma-0"
              >
                <template #label>
                  <span class="text-sm">{{
                    sequenceContainsYear ? "Yes" : "No"
                  }}</span>
                </template>
              </VSwitch>
            </div>
          </VCol>
        </VRow>
      </VCardText>
      <VDivider class="mx-5" />
      <VCardText>
        <VRow>
          <VCol cols="12">
            <div
              class="d-flex align-center justify-space-between flex-wrap gap-4"
            >
              <div>
                <h6 class="text-h6">Terms and Notes</h6>
                <p class="text-body-2 mb-0">
                  Controls the default terms and notes visibility for quotation,
                  proforma, and invoice documents.
                </p>
              </div>

              <VSwitch
                v-model="fin.invoicing.showNotes"
                inset
                hide-details
                density="compact"
                class="ma-0"
              />
            </div>
          </VCol>
          <VCol cols="12">
            <TiptapEditor
              v-model="fin.invoicing.termsAndNotes"
              class="terms-editor"
              placeholder="Prices valid for 14 days from issue date."
            />
          </VCol>
        </VRow>
      </VCardText>
      <VDivider class="mx-5" />
      <VCardText>
        <VRow>
          <VCol cols="12" md="6" class="d-flex align-center flex-wrap">
            <span class="me-2">Remind After Invoice is not Paid after</span>
            <span class="inline-number-with-unit">
              <VTextField
                v-model.number="invoiceReminderDays"
                type="number"
                min="0"
                hide-details
                density="compact"
                class="field-inline"
                style="inline-size: 72px"
                :rules="[requiredValidator]"
                @keydown="
                  (e: KeyboardEvent) => {
                    if (
                      e.key === '-' ||
                      e.key === 'e' ||
                      e.key === 'E' ||
                      e.key === '+'
                    )
                      e.preventDefault();
                  }
                "
                @input="
                  (e: Event) => {
                    const val = parseFloat(
                      (e.target as HTMLInputElement).value,
                    );
                    if (val < 0 || isNaN(val)) invoiceReminderDays = 0;
                  }
                "
              />
              <span>Days</span>
            </span>
          </VCol>
          <VCol cols="12" md="6" class="d-flex align-center flex-wrap">
            <span class="me-2">Remind After Purchase is not Paid for </span>
            <span class="inline-number-with-unit">
              <VTextField
                v-model.number="purchaseReminderDays"
                type="number"
                min="0"
                hide-details
                density="compact"
                class="field-inline"
                style="inline-size: 72px"
                :rules="[requiredValidator]"
                @keydown="
                  (e: KeyboardEvent) => {
                    if (
                      e.key === '-' ||
                      e.key === 'e' ||
                      e.key === 'E' ||
                      e.key === '+'
                    )
                      e.preventDefault();
                  }
                "
                @input="
                  (e: Event) => {
                    const val = parseFloat(
                      (e.target as HTMLInputElement).value,
                    );
                    if (val < 0 || isNaN(val)) purchaseReminderDays = 0;
                  }
                "
              />
              <span>Days</span>
            </span>
          </VCol>
        </VRow>
      </VCardText>
    </VCard>

    <div class="d-flex justify-end gap-x-4">
      <VBtn
        color="secondary"
        variant="tonal"
        :disabled="!isDirty"
        @click="onDiscard"
      >
        Discard
      </VBtn>
      <VBtn color="primary" :disabled="!isDirty || !isValid" @click="onSave">
        Save changes
      </VBtn>
    </div>
  </div>

  <AddPaymentMethodDialog
    v-model:is-dialog-visible="isAddPaymentMethodsDialogVisible"
  />
  <PaymentProvidersDialog
    v-model:is-dialog-visible="isPaymentProvidersDialogVisible"
  />
</template>

<style scoped>
.terms-editor {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 6px;
  min-block-size: 180px;
}

.terms-editor :deep(.ProseMirror) {
  min-block-size: 180px;
  outline: none;
  overflow-y: auto;
  padding: 0.875rem 1rem;
}
</style>

<style lang="scss" scoped>
.paypal-logo {
  background-color: #fff;
  block-size: 37px;
  box-shadow: 0 2px 4px 0 rgba(165, 163, 174, 30%);
  inline-size: 58px;
}

.compact-number-input :deep(.v-field__input) {
  padding-inline-end: 4px !important;
}

.compact-number-input :deep(.v-field) {
  padding-inline-end: 0 !important;
}

.inline-number-with-unit {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.field-inline :deep(.v-input),
.field-inline :deep(.v-field) {
  margin: 0 !important;
}

@media (max-width: 599px) {
  .inline-number-with-unit {
    gap: 4px;
  }
}
</style>
