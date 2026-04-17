<script setup lang="ts">
import { useConfigStore } from "@/stores/config";
import type { QuotationRecord } from "@db/apps/quotation/types";
import { PerfectScrollbar } from "vue3-perfect-scrollbar";

interface SubmitData {
  emailFrom: string;
  emailTo: string;
  quotationSubject: string;
  paymentMessage: string;
  attachmentName: string | null;
}

interface Emit {
  (e: "update:isDrawerOpen", value: boolean): void;
  (e: "submit", value: SubmitData): void;
}

interface Props {
  isDrawerOpen: boolean;
  quotationRecord?: QuotationRecord | null;
}

const props = defineProps<Props>();
const emit = defineEmits<Emit>();

const configStore = useConfigStore();
configStore.init();

const emailFrom = ref("");
const emailTo = ref("");
const quotationSubject = ref("");
const paymentMessage = ref("");

const attachmentName = computed(() =>
  props.quotationRecord?.quotation.quoteNumber
    ? `${props.quotationRecord.quotation.quoteNumber}.pdf`
    : "Quotation Attached",
);

const resetForm = () => {
  const quotation = props.quotationRecord?.quotation;
  const companyName = configStore.legal?.companyName?.trim() || "Squarely";
  const fromEmail = configStore.legal?.email?.trim() || "";
  const toEmail = quotation?.client.companyEmail?.trim() || "";
  const clientName = quotation?.client.name?.trim() || "there";
  const quoteNumber = quotation?.quoteNumber?.trim() || "quotation";
  const total = Number(quotation?.total || 0).toLocaleString();
  const expiryDate = quotation?.dueDate?.trim() || "";

  emailFrom.value = fromEmail;
  emailTo.value = toEmail;
  quotationSubject.value = `Quotation ${quoteNumber} from ${companyName}`;
  paymentMessage.value = `Dear ${clientName},

Please find ${quoteNumber} attached.

Quotation amount: $${total}
${expiryDate ? `Expiry date: ${expiryDate}` : ""}

Thank you,
${companyName}`.trim();
};

watch(
  () => [props.isDrawerOpen, props.quotationRecord?.quotation.id] as const,
  ([isDrawerOpen]) => {
    if (isDrawerOpen) resetForm();
  },
  { immediate: true },
);

const onSubmit = () => {
  emit("update:isDrawerOpen", false);
  emit("submit", {
    emailFrom: emailFrom.value,
    emailTo: emailTo.value,
    quotationSubject: quotationSubject.value,
    paymentMessage: paymentMessage.value,
    attachmentName: attachmentName.value,
  });
};

const handleDrawerModelValueUpdate = (value: boolean) => {
  emit("update:isDrawerOpen", value);
};
</script>

<template>
  <VNavigationDrawer
    data-allow-mismatch
    temporary
    location="end"
    :width="400"
    :model-value="props.isDrawerOpen"
    class="scrollable-content"
    @update:model-value="handleDrawerModelValueUpdate"
  >
    <AppDrawerHeaderSection
      title="Send Quotation"
      @cancel="$emit('update:isDrawerOpen', false)"
    />
    <VDivider />

    <PerfectScrollbar :options="{ wheelPropagation: false }">
      <VCard flat>
        <VCardText>
          <VForm @submit.prevent="onSubmit">
            <VRow>
              <VCol cols="12">
                <AppTextField
                  id="sender-email"
                  v-model="emailFrom"
                  label="From"
                  placeholder="sender@email.com"
                />
              </VCol>

              <VCol cols="12">
                <AppTextField
                  id="receiver-email"
                  v-model="emailTo"
                  label="To"
                  placeholder="receiver@email.com"
                />
              </VCol>

              <VCol cols="12">
                <AppTextField
                  id="quotation-subject"
                  v-model="quotationSubject"
                  label="Subject"
                  placeholder="Quotation subject"
                />
              </VCol>

              <VCol cols="12">
                <AppTextarea
                  id="payment-message"
                  v-model="paymentMessage"
                  rows="10"
                  label="Message"
                  placeholder="Quotation message"
                />
              </VCol>

              <VCol cols="12">
                <div class="mb-6">
                  <VChip label color="primary" size="small">
                    <VIcon start icon="tabler-link" />
                    {{ attachmentName }}
                  </VChip>
                </div>

                <VBtn type="submit" class="me-3">Send</VBtn>

                <VBtn
                  color="secondary"
                  variant="tonal"
                  @click="$emit('update:isDrawerOpen', false)"
                >
                  Cancel
                </VBtn>
              </VCol>
            </VRow>
          </VForm>
        </VCardText>
      </VCard>
    </PerfectScrollbar>
  </VNavigationDrawer>
</template>
