<script lang="ts" setup>
import { useConfigStore } from "@/stores/config";
import { cloneQuotationRecord, useQuotationsStore } from "@/stores/quotations";
import {
  buildQuotationNote,
  buildQuotationPaymentDetails,
  buildQuotationSalesperson,
  buildQuotationThanksNote,
} from "@/utils/quotationConfig";
import type {
  PurchasedProduct,
  QuotationData,
} from "@/views/apps/quotation/types";
import QuotationAddPaymentDrawer from "@/views/apps/quotation/QuotationAddPaymentDrawer.vue";
import QuotationEditable from "@/views/apps/quotation/QuotationEditable.vue";
import QuotationSendQuotationDrawer from "@/views/apps/quotation/QuotationSendQuotationDrawer.vue";

const route = useRoute("apps-quotation-edit-id");
const router = useRouter();
const configStore = useConfigStore();
configStore.init();
const quotationsStore = useQuotationsStore();
quotationsStore.init();

const sourceRecord = quotationsStore.byId(route.params.id);
const quotationData = ref<QuotationData | null>(
  sourceRecord ? cloneQuotationRecord(sourceRecord) : null,
);

const addProduct = (value: PurchasedProduct) => {
  quotationData.value?.purchasedProducts.push(value);
};

const removeProduct = (id: number) => {
  quotationData.value?.purchasedProducts.splice(id, 1);
};

const isSendSidebarActive = ref(false);
const isAddPaymentSidebarActive = ref(false);
const paymentTerms = ref(true);
const clientNotes = ref(false);
const paymentStub = ref(false);
const paymentMethods = ["Bank Transfer", "Cash", "Credit Card"];

watch(
  () => quotationData.value?.paymentMethod,
  (paymentMethod) => {
    if (quotationData.value && paymentMethod !== "Credit Card") {
      quotationData.value.paymentLink = null;
    }
  },
);

const saveQuotation = () => {
  if (!quotationData.value) return;

  const total = quotationData.value.purchasedProducts.reduce(
    (sum, product) => sum + Number(product.cost || 0) * Number(product.hours || 0),
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

  quotationsStore.updateQuotation(
    quotationData.value.quotation.id,
    cloneQuotationRecord(quotationData.value),
  );

  router.push({
    name: "apps-quotation-preview-id",
    params: { id: quotationData.value.quotation.id },
  });
};
</script>

<template>
  <VRow v-if="quotationData?.quotation">
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
            @click="isSendSidebarActive = true"
          >
            Send Quotation
          </VBtn>

          <div class="d-flex flex-wrap gap-4">
            <VBtn
              color="secondary"
              variant="tonal"
              class="flex-grow-1"
              :to="{
                name: 'apps-quotation-preview-id',
                params: { id: route.params.id },
              }"
            >
              Preview
            </VBtn>

            <VBtn class="mb-4 flex-grow-1" @click="saveQuotation">Save</VBtn>
          </div>

          <VBtn
            block
            color="success"
            prepend-icon="tabler-currency-dollar"
            @click="isAddPaymentSidebarActive = true"
          >
            Add Payment
          </VBtn>
        </VCardText>
      </VCard>

      <AppSelect
        id="payment-method"
        v-model="quotationData.paymentMethod"
        :items="paymentMethods"
        label="Accept Payment Via"
        class="mb-4"
      />

      <AppTextField
        v-if="quotationData.paymentMethod === 'Credit Card'"
        id="payment-link"
        v-model="quotationData.paymentLink"
        label="Credit Card Payment Link"
        placeholder="https://"
        class="mb-4"
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

    <QuotationSendQuotationDrawer v-model:is-drawer-open="isSendSidebarActive" />
    <QuotationAddPaymentDrawer
      v-model:is-drawer-open="isAddPaymentSidebarActive"
    />
  </VRow>

  <section v-else>
    <VAlert type="error" variant="tonal">
      Quotation with ID {{ route.params.id }} not found!
    </VAlert>
  </section>
</template>
