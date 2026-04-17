<script lang="ts" setup>
import { requiredValidator, urlValidator } from "@/@core/utils/validators";
import { useConfigStore } from "@/stores/config";
import { useEmployeesStore } from "@/stores/employees";
import { cloneQuotationRecord, useQuotationsStore } from "@/stores/quotations";
import { buildQuotationPaymentDetails } from "@/utils/quotationConfig";
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
const employeesStore = useEmployeesStore();
employeesStore.init();
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
const paymentStub = ref(false);
const paymentMethods = ["Bank Transfer", "Cash", "Credit Card"];
const approvalModes = ["Automatic", "Request Approval"] as const;
const creditCardPaymentLinkError = ref<string | null>(null);
const approvalError = ref<string | null>(null);
const dealOptions = computed(() => {
  const options = new Map<number, { title: string; value: number }>();

  for (const record of quotationsStore.all) {
    const quotation = record.quotation;
    if (!quotation.dealId) continue;

    options.set(quotation.dealId, {
      title: `Deal ${quotation.dealId} - ${quotation.client.name}`,
      value: quotation.dealId,
    });
  }

  return Array.from(options.values());
});
const employeeOptions = computed(() =>
  employeesStore.all.map((employee) => ({
    title: employee.fullName,
    value: employee.id,
  })),
);

watch(
  () => quotationData.value?.paymentMethod,
  (paymentMethod) => {
    if (quotationData.value && paymentMethod !== "Credit Card") {
      quotationData.value.paymentLink = null;
      creditCardPaymentLinkError.value = null;
    }
  },
);

watch(
  () => quotationData.value?.approvalMode,
  (approvalMode) => {
    if (quotationData.value && approvalMode !== "Request Approval") {
      quotationData.value.approverEmployeeId = null;
      approvalError.value = null;
    }
  },
);

watch(
  () => quotationData.value?.paymentLink,
  (paymentLink) => {
    if (!quotationData.value || quotationData.value.paymentMethod !== "Credit Card") {
      creditCardPaymentLinkError.value = null;
      return;
    }

    const requiredResult = requiredValidator(paymentLink);
    if (requiredResult !== true) {
      creditCardPaymentLinkError.value = String(requiredResult);
      return;
    }

    const urlResult = urlValidator(paymentLink);
    creditCardPaymentLinkError.value =
      urlResult === true ? null : String(urlResult);
  },
);

const validateCreditCardPaymentLink = () => {
  if (!quotationData.value || quotationData.value.paymentMethod !== "Credit Card") {
    creditCardPaymentLinkError.value = null;
    return true;
  }

  const requiredResult = requiredValidator(quotationData.value.paymentLink);
  if (requiredResult !== true) {
    creditCardPaymentLinkError.value = String(requiredResult);
    return false;
  }

  const urlResult = urlValidator(quotationData.value.paymentLink);
  if (urlResult !== true) {
    creditCardPaymentLinkError.value = String(urlResult);
    return false;
  }

  creditCardPaymentLinkError.value = null;
  return true;
};

const validateApprovalSelection = () => {
  if (!quotationData.value || quotationData.value.approvalMode !== "Request Approval") {
    approvalError.value = null;
    return true;
  }

  if (
    quotationData.value.approverEmployeeId === null ||
    quotationData.value.approverEmployeeId === undefined ||
    quotationData.value.approverEmployeeId === ""
  ) {
    approvalError.value = "Please select an approver";
    return false;
  }

  approvalError.value = null;
  return true;
};

const saveQuotation = () => {
  if (!quotationData.value) return;
  if (!validateCreditCardPaymentLink()) return;
  if (!validateApprovalSelection()) return;

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
  quotationData.value.paymentLink =
    quotationData.value.paymentMethod === "Credit Card"
      ? quotationData.value.paymentLink?.trim() || null
      : null;
  quotationData.value.quotation.linkedRecordType = quotationData.value.quotation.dealId
    ? "deal"
    : null;
  quotationData.value.approverEmployeeId =
    quotationData.value.approvalMode === "Request Approval"
      ? quotationData.value.approverEmployeeId ?? null
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
        :rules="[requiredValidator, urlValidator]"
        :error-messages="creditCardPaymentLinkError ? [creditCardPaymentLinkError] : []"
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
          <VSwitch id="client-notes" v-model="quotationData.showClientNote" />
        </div>
      </div>

      <div class="d-flex align-center justify-space-between">
        <VLabel for="payment-stub">Payment Stub</VLabel>
        <div>
          <VSwitch id="payment-stub" v-model="paymentStub" />
        </div>
      </div>

      <AppSelect
        id="deal-id"
        v-model="quotationData.quotation.dealId"
        :items="dealOptions"
        label="Deal"
        placeholder="Select deal"
        clearable
        class="mt-4"
      />

      <AppSelect
        id="approval-mode"
        v-model="quotationData.approvalMode"
        :items="approvalModes"
        label="Approval"
        class="mt-4"
      />

      <AppSelect
        v-if="quotationData.approvalMode === 'Request Approval'"
        id="approver-employee"
        v-model="quotationData.approverEmployeeId"
        :items="employeeOptions"
        label="Approver"
        placeholder="Select employee"
        :error-messages="approvalError ? [approvalError] : []"
        class="mt-4"
      />
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
