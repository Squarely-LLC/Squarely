<script setup lang="ts">
import type { ContactProperties } from "@/plugins/fake-api/handlers/apps/contact/types";
import { useConfigStore } from "@/stores/config";
import { useContactsStore } from "@/stores/contacts";
import { useInvoicesStore } from "@/stores/invoices";
import {
    buildQuotationPaymentDetails,
    formatCurrencyAmount,
    getQuotationCompanyAddressLines,
    getQuotationCompanyContactLines,
    getVatSummary,
    resolveQuotationLogoUrl,
} from "@/utils/quotationConfig";
import {
    getQuotationDiscountTotal,
    getQuotationGrandTotal,
    getQuotationSubtotal,
} from "@/utils/quotationPricing";
import type { Client } from "@db/apps/invoice/types";

import InvoiceProductEdit from "./InvoiceProductEdit.vue";
import type { InvoiceData, PurchasedProduct } from "./types";

interface Props {
  data: InvoiceData;
  documentLabel?: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "push", value: PurchasedProduct): void;
  (e: "remove", id: number): void;
}>();

const invoicesStore = useInvoicesStore();
invoicesStore.init();

const configStore = useConfigStore();
configStore.init();

const contactsStore = useContactsStore();
contactsStore.init();

const quotation = toRef(props.data, "quotation");
const note = toRef(props.data, "note");
const documentLabel = computed(() => props.documentLabel?.trim() || "Invoice");
const recipientLabel = computed(() => `${documentLabel.value} To`);
const vatSummary = computed(() => getVatSummary(configStore.financial));
const clientValidationMessage = "Client is required";

const mapContactToClient = (contact: ContactProperties): Client => ({
  address: contact.address?.trim() || "",
  company: contact.fullName.trim(),
  companyEmail: contact.email?.trim() || "",
  country: contact.country?.trim() || "Lebanon",
  contact: contact.number?.trim() || "",
  name: contact.fullName.trim(),
});

const clients = computed<Client[]>(() =>
  contactsStore.all
    .filter((contact) => contact.fullName?.trim())
    .map((contact) => mapContactToClient(contact)),
);

watch(
  () => [quotation.value.client.name, quotation.value.client.companyEmail],
  () => {
    const clientName = quotation.value.client.name.trim().toLowerCase();
    const clientEmail = quotation.value.client.companyEmail
      .trim()
      .toLowerCase();
    const matchedContact = contactsStore.all.find((contact) => {
      const contactEmail = contact.email?.trim().toLowerCase() || "";
      const contactName = contact.fullName?.trim().toLowerCase() || "";

      return (
        (clientEmail && contactEmail === clientEmail) ||
        (clientName && contactName === clientName)
      );
    });

    quotation.value.avatar = matchedContact?.picture || "";
  },
  { immediate: true },
);

const addItem = () => {
  emit("push", {
    catalogueItemId: null,
    title: "",
    cost: 0,
    hours: 1,
    discountType: "none",
    discountValue: 0,
    description: "",
  });
};

const removeProduct = (id: number) => {
  emit("remove", id);
};

const subtotal = computed(() =>
  getQuotationSubtotal(props.data.purchasedProducts),
);
const discountTotal = computed(() =>
  getQuotationDiscountTotal(props.data.purchasedProducts),
);
const total = computed(() =>
  getQuotationGrandTotal(props.data.purchasedProducts),
);
const paymentMethod = computed(
  () => props.data.paymentMethod || "Bank Transfer",
);
const creditCardPaymentLink = computed(
  () => props.data.paymentLink?.trim() || "",
);
const showClientCompany = computed(() => {
  const clientName = quotation.value.client.name.trim();
  const clientCompany = quotation.value.client.company.trim();

  return Boolean(clientCompany) && clientCompany !== clientName;
});
const isClientMissing = computed(() => !quotation.value.client.name.trim());
const displayPaymentDetails = computed(() => ({
  ...buildQuotationPaymentDetails(
    total.value,
    configStore.legal,
    configStore.financial,
  ),
  ...props.data.paymentDetails,
}));
const companyLogoUrl = ref("");
const companyName = computed(
  () => configStore.legal?.companyName?.trim() || "Squarely",
);
const companyAddressLines = computed(() =>
  getQuotationCompanyAddressLines(configStore.legal),
);
const companyContactLines = computed(() =>
  getQuotationCompanyContactLines(configStore.legal),
);

watch(
  () => configStore.legal?.logo,
  async (logo) => {
    companyLogoUrl.value = await resolveQuotationLogoUrl(logo);
  },
  { immediate: true },
);

</script>

<template>
  <VCard class="pa-6 pa-sm-12">
    <div
      class="d-flex flex-wrap justify-space-between flex-column rounded bg-var-theme-background flex-sm-row gap-6 pa-6 mb-6"
    >
      <div>
        <div class="quotation-company-brand mb-6">
          <img
            v-if="companyLogoUrl"
            :src="companyLogoUrl"
            :alt="companyName"
            class="quotation-company-logo"
          />
          <h6 class="app-logo-title quotation-company-title">
            {{ companyName }}
          </h6>
        </div>

        <p
          v-for="(line, index) in companyAddressLines"
          :key="`address-${index}`"
          class="text-high-emphasis mb-0"
        >
          {{ line }}
        </p>
        <p
          v-for="(line, index) in companyContactLines"
          :key="`contact-${index}`"
          class="text-high-emphasis mb-0"
        >
          {{ line }}
        </p>
      </div>

      <div class="d-flex flex-column gap-2">
        <div
          class="d-flex align-start align-sm-center gap-x-4 font-weight-medium text-lg flex-column flex-sm-row"
        >
          <span
            class="text-high-emphasis text-sm-end"
            style="inline-size: 5.625rem"
          >
            {{ documentLabel }}:
          </span>
          <span>
            <AppTextField
              id="quotation-id"
              :model-value="quotation.quoteNumber"
              disabled
              style="inline-size: 9.5rem"
            />
          </span>
        </div>

        <div
          class="d-flex gap-x-4 align-start align-sm-center flex-column flex-sm-row"
        >
          <span
            class="text-high-emphasis text-sm-end"
            style="inline-size: 5.625rem"
          >
            Date Issued:
          </span>

          <span style="inline-size: 9.5rem">
            <AppDateTimePicker
              id="issued-date"
              v-model="quotation.issuedDate"
              placeholder="YYYY-MM-DD"
              :config="{ position: 'auto right' }"
            />
          </span>
        </div>

        <div
          class="d-flex gap-x-4 align-start align-sm-center flex-column flex-sm-row"
        >
          <span
            class="text-high-emphasis text-sm-end"
            style="inline-size: 5.625rem"
          >
            Expiry Date:
          </span>
          <span style="min-inline-size: 9.5rem">
            <AppDateTimePicker
              id="due-date"
              v-model="quotation.dueDate"
              placeholder="YYYY-MM-DD"
              :config="{ position: 'auto right' }"
            />
          </span>
        </div>
      </div>
    </div>

    <VRow class="recipient-payment-row">
      <VCol cols="6" class="recipient-payment-col">
        <h6 class="text-h6 mb-4">{{ recipientLabel }}:</h6>

        <VSelect
          id="client-name"
          v-model="quotation.client"
          :items="clients"
          item-title="name"
          item-value="name"
          placeholder="Select Client"
          return-object
          class="mb-4"
          style="inline-size: 11.875rem"
          :error="isClientMissing"
          :error-messages="isClientMissing ? [clientValidationMessage] : []"
        />
        <p class="mb-0">{{ quotation.client.name }}</p>
        <p v-if="showClientCompany" class="mb-0">
          {{ quotation.client.company }}
        </p>
        <p v-if="quotation.client.address" class="mb-0">
          {{ quotation.client.address }}, {{ quotation.client.country }}
        </p>
        <p class="mb-0">{{ quotation.client.contact }}</p>
        <p class="mb-0">{{ quotation.client.companyEmail }}</p>
      </VCol>

      <VCol cols="6" class="recipient-payment-col">
        <h6 class="text-h6 mb-4">Payment Details:</h6>

        <template v-if="paymentMethod === 'Bank Transfer'">
          <table>
            <tbody>
              <tr>
                <td class="pe-4">Bank Name:</td>
                <td>{{ displayPaymentDetails.bankName }}</td>
              </tr>
              <tr>
                <td class="pe-4">Country:</td>
                <td>{{ displayPaymentDetails.country }}</td>
              </tr>
              <tr>
                <td class="pe-4">IBAN:</td>
                <td>
                  <p class="text-wrap me-4">
                    {{ displayPaymentDetails.iban }}
                  </p>
                </td>
              </tr>
              <tr>
                <td class="pe-4">SWIFT Code:</td>
                <td>{{ displayPaymentDetails.swiftCode }}</td>
              </tr>
            </tbody>
          </table>
        </template>

        <template v-else-if="paymentMethod === 'Cash'">
          <p class="mb-0">Cash</p>
        </template>

        <template v-else>
          <p class="mb-2">Credit card payment link</p>
          <p class="mb-0 text-wrap">
            <a
              v-if="creditCardPaymentLink"
              :href="creditCardPaymentLink"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ creditCardPaymentLink }}
            </a>
            <span v-else>No payment link added yet.</span>
          </p>
        </template>
      </VCol>
    </VRow>

    <VDivider class="my-6 border-dashed" />

    <div class="add-products-form">
      <div
        v-for="(product, index) in props.data.purchasedProducts"
        :key="index"
        class="mb-4"
      >
        <InvoiceProductEdit
          :id="index"
          :data="product"
          @remove-product="removeProduct"
        />
      </div>

      <VBtn size="small" prepend-icon="tabler-plus" @click="addItem">
        Add Item
      </VBtn>
    </div>

    <VDivider class="my-6 border-dashed" />

    <div class="d-flex justify-space-between flex-wrap flex-column flex-sm-row">
      <div class="totals-summary">
        <table class="w-100">
          <tbody>
            <tr>
              <td class="pe-16">Subtotal:</td>
              <td :class="$vuetify.locale.isRtl ? 'text-start' : 'text-end'">
                <h6 class="text-h6">
                  {{ formatCurrencyAmount(subtotal, configStore.financial) }}
                </h6>
              </td>
            </tr>
            <tr>
              <td class="pe-16">Discount:</td>
              <td :class="$vuetify.locale.isRtl ? 'text-start' : 'text-end'">
                <h6 class="text-h6">
                  {{
                    formatCurrencyAmount(discountTotal, configStore.financial)
                  }}
                </h6>
              </td>
            </tr>
            <tr>
              <td class="pe-16">{{ vatSummary.label }}:</td>
              <td :class="$vuetify.locale.isRtl ? 'text-start' : 'text-end'">
                <h6 class="text-h6">{{ vatSummary.value }}</h6>
              </td>
            </tr>
          </tbody>
        </table>

        <VDivider class="mt-4 mb-3" />

        <table class="w-100">
          <tbody>
            <tr>
              <td class="pe-16">Total:</td>
              <td :class="$vuetify.locale.isRtl ? 'text-start' : 'text-end'">
                <h6 class="text-h6">
                  {{ formatCurrencyAmount(total, configStore.financial) }}
                </h6>
              </td>
            </tr>
            <tr v-if="props.data.totalFx?.trim()">
              <td class="pe-16">Total FX:</td>
              <td :class="$vuetify.locale.isRtl ? 'text-start' : 'text-end'">
                <h6 class="text-h6">{{ props.data.totalFx }}</h6>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <template v-if="props.data.showClientNote">
      <VDivider class="my-6 border-dashed" />

      <div>
        <h6 class="text-h6 mb-2">Terms and Notes:</h6>
        <TiptapEditor
          v-model="note"
          class="terms-editor"
          placeholder="Write terms and notes here..."
        />
      </div>
    </template>
  </VCard>
</template>

<style scoped>
.quotation-company-brand {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
}

.quotation-company-logo {
  max-block-size: 72px;
  max-inline-size: 160px;
  object-fit: contain;
}

.quotation-company-title {
  margin: 0;
  line-height: 1.2;
}

.recipient-payment-row {
  flex-wrap: nowrap;
}

.recipient-payment-col {
  min-inline-size: 0;
}

.recipient-payment-col p,
.recipient-payment-col td {
  overflow-wrap: anywhere;
}

.terms-editor {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 6px;
  min-block-size: 150px;
}

.terms-editor :deep(.ProseMirror) {
  min-block-size: 150px;
  outline: none;
  overflow-y: auto;
  padding: 0.875rem 1rem;
}

.totals-summary {
  inline-size: min(100%, 22rem);
  margin-inline-start: auto;
}
</style>
