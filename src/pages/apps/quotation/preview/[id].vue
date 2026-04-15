<script setup lang="ts">
import { useQuotationsStore } from "@/stores/quotations";
import { formatSystemDate } from "@core/utils/formatters";
import { VNodeRenderer } from "@layouts/components/VNodeRenderer";
import { themeConfig } from "@themeConfig";

import QuotationAddPaymentDrawer from "@/views/apps/quotation/QuotationAddPaymentDrawer.vue";
import QuotationSendQuotationDrawer from "@/views/apps/quotation/QuotationSendQuotationDrawer.vue";

const route = useRoute("apps-quotation-preview-id");
const quotationsStore = useQuotationsStore();
quotationsStore.init();

const quotationRecord = computed(() => quotationsStore.byId(route.params.id));
const quotation = computed(() => quotationRecord.value?.quotation ?? null);
const paymentDetails = computed(() => quotationRecord.value?.paymentDetails ?? null);
const purchasedProducts = computed(
  () => quotationRecord.value?.purchasedProducts ?? [],
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
              <div class="d-flex align-center app-logo mb-6">
                <VNodeRenderer :nodes="themeConfig.app.logo" />
                <h6 class="app-logo-title">{{ themeConfig.app.title }}</h6>
              </div>

              <h6 class="text-h6 font-weight-regular">
                Office 149, 450 South Brand Brooklyn
              </h6>
              <h6 class="text-h6 font-weight-regular">
                San Diego County, CA 91905, USA
              </h6>
              <h6 class="text-h6 font-weight-regular">
                +1 (123) 456 7891, +44 (876) 543 2198
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
                <span>Due Date: </span>
                <span>{{ formatSystemDate(quotation.dueDate) }}</span>
              </h6>
            </div>
          </div>

          <VRow class="print-row mb-6">
            <VCol class="text-no-wrap">
              <h6 class="text-h6 mb-4">Quotation To:</h6>

              <p class="mb-0">{{ quotation.client.name }}</p>
              <p class="mb-0">{{ quotation.client.company }}</p>
              <p class="mb-0">
                {{ quotation.client.address }}, {{ quotation.client.country }}
              </p>
              <p class="mb-0">{{ quotation.client.contact }}</p>
              <p class="mb-0">{{ quotation.client.companyEmail }}</p>
            </VCol>

            <VCol class="text-no-wrap">
              <h6 class="text-h6 mb-4">Payment Details:</h6>
              <table>
                <tbody>
                  <tr>
                    <td class="pe-4">Total Due:</td>
                    <td>{{ paymentDetails.totalDue }}</td>
                  </tr>
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
            </VCol>
          </VRow>

          <VTable
            class="quotation-preview-table border text-high-emphasis overflow-hidden mb-6"
          >
            <thead>
              <tr>
                <th scope="col">ITEM</th>
                <th scope="col">DESCRIPTION</th>
                <th scope="col" class="text-center">HOURS</th>
                <th scope="col" class="text-center">RATE</th>
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
                    <td class="pe-16">Tax:</td>
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

          <VDivider class="my-6 border-dashed" />

          <p class="mb-0">
            <span class="text-high-emphasis font-weight-medium me-1">Note:</span>
            <span>{{ quotationRecord?.note }}</span>
          </p>
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
