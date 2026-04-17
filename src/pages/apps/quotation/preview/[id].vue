<script setup lang="ts">
import { useConfigStore } from "@/stores/config";
import { useQuotationsStore } from "@/stores/quotations";
import {
  buildQuotationPaymentDetails,
  getQuotationCompanyAddressLines,
  getQuotationCompanyContactLines,
  resolveQuotationLogoUrl,
} from "@/utils/quotationConfig";
import { formatSystemDate } from "@core/utils/formatters";

import QuotationAddPaymentDrawer from "@/views/apps/quotation/QuotationAddPaymentDrawer.vue";
import QuotationSendQuotationDrawer from "@/views/apps/quotation/QuotationSendQuotationDrawer.vue";

const route = useRoute("apps-quotation-preview-id");
const configStore = useConfigStore();
configStore.init();
const quotationsStore = useQuotationsStore();
quotationsStore.init();

const quotationRecord = computed(() => quotationsStore.byId(route.params.id));
const quotation = computed(() => quotationRecord.value?.quotation ?? null);
const paymentMethod = computed(
  () => quotationRecord.value?.paymentMethod || "Bank Transfer",
);
const creditCardPaymentLink = computed(
  () => quotationRecord.value?.paymentLink?.trim() || "",
);
const showClientCompany = computed(() => {
  const clientName = quotation.value?.client.name.trim() || "";
  const clientCompany = quotation.value?.client.company.trim() || "";

  return Boolean(clientCompany) && clientCompany !== clientName;
});
const paymentDetails = computed(() => {
  if (!quotationRecord.value) return null;

  return {
    ...quotationRecord.value.paymentDetails,
    ...buildQuotationPaymentDetails(
      quotationRecord.value.quotation.total,
      configStore.legal,
      configStore.financial,
    ),
  };
});
const purchasedProducts = computed(
  () => quotationRecord.value?.purchasedProducts ?? [],
);
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

const isAddPaymentSidebarVisible = ref(false);
const isSendPaymentSidebarVisible = ref(false);

const printQuotation = () => {
  window.print();
};

const subtotal = computed(() =>
  purchasedProducts.value.reduce(
    (sum, item) => sum + Number(item.cost || 0) * Number(item.hours || 0),
    0,
  ),
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
  <section v-if="quotation && paymentDetails">
    <VRow>
      <VCol cols="12" md="9">
        <VCard class="quotation-preview-wrapper pa-6 pa-sm-12">
          <div
            class="quotation-header-preview d-flex flex-wrap justify-space-between flex-column flex-sm-row print-row bg-var-theme-background gap-6 rounded pa-6 mb-6"
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

              <h6
                v-for="(line, index) in companyAddressLines"
                :key="`address-${index}`"
                class="text-h6 font-weight-regular"
              >
                {{ line }}
              </h6>
              <h6
                v-for="(line, index) in companyContactLines"
                :key="`contact-${index}`"
                class="text-h6 font-weight-regular"
              >
                {{ line }}
              </h6>
            </div>

            <div>
              <h6 class="font-weight-medium text-lg mb-6">
                Quotation {{ quotation.quoteNumber }}
              </h6>

              <h6 class="text-h6 font-weight-regular">
                <span>Date Issued: </span>
                <span>{{ formatSystemDate(quotation.issuedDate) }}</span>
              </h6>

              <h6 class="text-h6 font-weight-regular">
                <span>Expiry Date: </span>
                <span>{{ formatSystemDate(quotation.dueDate) }}</span>
              </h6>
            </div>
          </div>

          <VRow class="print-row mb-6">
            <VCol class="text-no-wrap">
              <h6 class="text-h6 mb-4">Quotation To:</h6>

              <p class="mb-0">{{ quotation.client.name }}</p>
              <p v-if="showClientCompany" class="mb-0">
                {{ quotation.client.company }}
              </p>
              <p class="mb-0">
                {{ quotation.client.address }}, {{ quotation.client.country }}
              </p>
              <p class="mb-0">{{ quotation.client.contact }}</p>
              <p class="mb-0">{{ quotation.client.companyEmail }}</p>
            </VCol>

            <VCol class="text-no-wrap">
              <h6 class="text-h6 mb-4">Payment Details:</h6>
              <template v-if="paymentMethod === 'Bank Transfer'">
                <table>
                  <tbody>
                    <tr>
                      <td class="pe-4">Bank Name:</td>
                      <td>{{ paymentDetails.bankName }}</td>
                    </tr>
                    <tr>
                      <td class="pe-4">Country:</td>
                      <td>{{ paymentDetails.country }}</td>
                    </tr>
                    <tr>
                      <td class="pe-4">IBAN:</td>
                      <td>{{ paymentDetails.iban }}</td>
                    </tr>
                    <tr>
                      <td class="pe-4">SWIFT Code:</td>
                      <td>{{ paymentDetails.swiftCode }}</td>
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

          <VTable
            class="quotation-preview-table border text-high-emphasis overflow-hidden mb-6"
          >
            <thead>
              <tr>
                <th scope="col">ITEM</th>
                <th scope="col">DESCRIPTION</th>
                <th scope="col" class="text-center">QUANTITY</th>
                <th scope="col" class="text-center">PRICE</th>
                <th scope="col" class="text-center">TOTAL</th>
              </tr>
            </thead>

            <tbody class="text-base">
              <tr
                v-for="(item, index) in purchasedProducts"
                :key="`${item.title}-${index}`"
              >
                <td class="text-no-wrap">{{ item.title }}</td>
                <td class="text-no-wrap">{{ item.description }}</td>
                <td class="text-center">{{ item.hours }}</td>
                <td class="text-center">${{ item.cost }}</td>
                <td class="text-center">${{ item.cost * item.hours }}</td>
              </tr>
            </tbody>
          </VTable>

          <div class="d-flex justify-space-between flex-column flex-sm-row print-row">
            <div class="mb-2">
              <div class="d-flex align-center mb-1">
                <h6 class="text-h6 me-2">Salesperson:</h6>
                <span>{{ quotationRecord?.salesperson }}</span>
              </div>
              <p>{{ quotationRecord?.thanksNote }}</p>
            </div>

            <div>
              <table class="w-100">
                <tbody>
                  <tr>
                    <td class="pe-16">Subtotal:</td>
                    <td :class="$vuetify.locale.isRtl ? 'text-start' : 'text-end'">
                      <h6 class="text-base font-weight-medium">
                        ${{ subtotal.toLocaleString() }}
                      </h6>
                    </td>
                  </tr>
                  <tr>
                    <td class="pe-16">Discount:</td>
                    <td :class="$vuetify.locale.isRtl ? 'text-start' : 'text-end'">
                      <h6 class="text-base font-weight-medium">$0</h6>
                    </td>
                  </tr>
                  <tr>
                    <td class="pe-16">VAT:</td>
                    <td :class="$vuetify.locale.isRtl ? 'text-start' : 'text-end'">
                      <h6 class="text-base font-weight-medium">Included</h6>
                    </td>
                  </tr>
                </tbody>
              </table>

              <VDivider class="my-2" />

              <table class="w-100">
                <tbody>
                  <tr>
                    <td class="pe-16">Total:</td>
                    <td :class="$vuetify.locale.isRtl ? 'text-start' : 'text-end'">
                      <h6 class="text-base font-weight-medium">
                        ${{ quotation.total.toLocaleString() }}
                      </h6>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <template v-if="quotationRecord?.showClientNote">
            <VDivider class="my-6 border-dashed" />

            <p class="mb-0">
              <span class="text-high-emphasis font-weight-medium me-1">
                Client Note:
              </span>
              <span>{{ quotationRecord?.note }}</span>
            </p>
          </template>
        </VCard>
      </VCol>

      <VCol cols="12" md="3" class="d-print-none">
        <VCard>
          <VCardText>
            <VBtn
              block
              prepend-icon="tabler-send"
              class="mb-4"
              @click="isSendPaymentSidebarVisible = true"
            >
              Send Quotation
            </VBtn>

            <VBtn block color="secondary" variant="tonal" class="mb-4">
              Download
            </VBtn>

            <div class="d-flex flex-wrap gap-4">
              <VBtn
                variant="tonal"
                color="secondary"
                class="flex-grow-1"
                @click="printQuotation"
              >
                Print
              </VBtn>

              <VBtn
                color="secondary"
                variant="tonal"
                class="mb-4 flex-grow-1"
                :to="{ name: 'apps-quotation-edit-id', params: { id: route.params.id } }"
              >
                Edit
              </VBtn>
            </div>

            <VBtn
              block
              prepend-icon="tabler-currency-dollar"
              color="success"
              @click="isAddPaymentSidebarVisible = true"
            >
              Add Payment
            </VBtn>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <QuotationAddPaymentDrawer
      v-model:is-drawer-open="isAddPaymentSidebarVisible"
    />

    <QuotationSendQuotationDrawer
      v-model:is-drawer-open="isSendPaymentSidebarVisible"
    />
  </section>

  <section v-else>
    <VAlert type="error" variant="tonal">
      Quotation with ID {{ route.params.id }} not found!
    </VAlert>
  </section>
</template>

<style lang="scss">
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
  line-height: 1.2;
  margin: 0;
}

.quotation-preview-table {
  --v-table-header-color: var(--v-theme-surface);

  &.v-table .v-table__wrapper table thead tr th {
    border-block-end: 1px solid
      rgba(var(--v-border-color), var(--v-border-opacity)) !important;
  }
}

@media print {
  .v-theme--dark {
    --v-theme-surface: 255, 255, 255;
    --v-theme-on-surface: 47, 43, 61;
    --v-theme-on-background: 47, 43, 61;
  }

  body {
    background: none !important;
  }

  .quotation-header-preview,
  .quotation-preview-wrapper {
    padding: 0 !important;
  }

  .product-buy-now,
  .v-navigation-drawer,
  .layout-vertical-nav,
  .app-customizer-toggler,
  .layout-footer,
  .layout-navbar,
  .layout-navbar-and-nav-container,
  .vue-devtools__anchor {
    display: none;
  }

  .v-card {
    box-shadow: none !important;

    .print-row {
      flex-direction: row !important;
    }
  }

  .layout-content-wrapper {
    padding-inline-start: 0 !important;
  }

  .v-table__wrapper {
    overflow: hidden !important;
  }
}
</style>
