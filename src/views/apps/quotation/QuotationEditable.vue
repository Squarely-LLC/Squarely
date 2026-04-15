<script setup lang="ts">
import type { ContactProperties } from "@/plugins/fake-api/handlers/apps/contact/types";
import { useContactsStore } from "@/stores/contacts";
import { useQuotationsStore } from "@/stores/quotations";
import type { Client } from "@db/apps/quotation/types";
import { VNodeRenderer } from "@layouts/components/VNodeRenderer";
import { themeConfig } from "@themeConfig";

import QuotationProductEdit from "./QuotationProductEdit.vue";
import type { PurchasedProduct, QuotationData } from "./types";

interface Props {
  data: QuotationData;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "push", value: PurchasedProduct): void;
  (e: "remove", id: number): void;
}>();

const quotationsStore = useQuotationsStore();
quotationsStore.init();

const contactsStore = useContactsStore();
contactsStore.init();

const quotation = toRef(props.data, "quotation");
const salesperson = toRef(props.data, "salesperson");
const thanksNote = toRef(props.data, "thanksNote");
const note = toRef(props.data, "note");

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
    title: "New line item",
    cost: 0,
    hours: 1,
    description: "",
  });
};

const removeProduct = (id: number) => {
  emit("remove", id);
};

const subtotal = computed(() =>
  props.data.purchasedProducts.reduce(
    (sum, product) =>
      sum + Number(product.cost || 0) * Number(product.hours || 0),
    0,
  ),
);

const total = computed(() => Number(quotation.value.total || 0));
</script>

<template>
  <VCard class="pa-6 pa-sm-12">
    <div
      class="d-flex flex-wrap justify-space-between flex-column rounded bg-var-theme-background flex-sm-row gap-6 pa-6 mb-6"
    >
      <div>
        <div class="d-flex align-center app-logo mb-6">
          <VNodeRenderer :nodes="themeConfig.app.logo" />
          <h6 class="app-logo-title">
            {{ themeConfig.app.title }}
          </h6>
        </div>

        <p class="text-high-emphasis mb-0">
          Office 149, 450 South Brand Brooklyn
        </p>
        <p class="text-high-emphasis mb-0">San Diego County, CA 91905, USA</p>
        <p class="text-high-emphasis mb-0">
          +1 (123) 456 7891, +44 (876) 543 2198
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
            Quotation:
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
            Due Date:
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

    <VRow>
      <VCol class="text-no-wrap">
        <h6 class="text-h6 mb-4">Quotation To:</h6>

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
        />
        <p class="mb-0">{{ quotation.client.name }}</p>
        <p class="mb-0">{{ quotation.client.company }}</p>
        <p v-if="quotation.client.address" class="mb-0">
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
              <td>{{ props.data.paymentDetails.totalDue }}</td>
            </tr>
            <tr>
              <td class="pe-4">Bank Name:</td>
              <td>{{ props.data.paymentDetails.bankName }}</td>
            </tr>
            <tr>
              <td class="pe-4">Country:</td>
              <td>{{ props.data.paymentDetails.country }}</td>
            </tr>
            <tr>
              <td class="pe-4">IBAN:</td>
              <td>
                <p class="text-wrap me-4">
                  {{ props.data.paymentDetails.iban }}
                </p>
              </td>
            </tr>
            <tr>
              <td class="pe-4">SWIFT Code:</td>
              <td>{{ props.data.paymentDetails.swiftCode }}</td>
            </tr>
          </tbody>
        </table>
      </VCol>
    </VRow>

    <VDivider class="my-6 border-dashed" />

    <div class="add-products-form">
      <div
        v-for="(product, index) in props.data.purchasedProducts"
        :key="`${product.title}-${index}`"
        class="mb-4"
      >
        <QuotationProductEdit
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
      <div class="mb-6 mb-sm-0">
        <div class="d-flex align-center mb-4">
          <h6 class="text-h6 me-2">Salesperson:</h6>
          <AppTextField
            id="salesperson"
            v-model="salesperson"
            style="inline-size: 8rem"
            placeholder="John Doe"
          />
        </div>

        <AppTextField
          id="thanks-note"
          v-model="thanksNote"
          placeholder="Thanks for your business"
        />
      </div>

      <div>
        <table class="w-100">
          <tbody>
            <tr>
              <td class="pe-16">Subtotal:</td>
              <td :class="$vuetify.locale.isRtl ? 'text-start' : 'text-end'">
                <h6 class="text-h6">${{ subtotal.toLocaleString() }}</h6>
              </td>
            </tr>
            <tr>
              <td class="pe-16">Discount:</td>
              <td :class="$vuetify.locale.isRtl ? 'text-start' : 'text-end'">
                <h6 class="text-h6">$0</h6>
              </td>
            </tr>
            <tr>
              <td class="pe-16">Tax:</td>
              <td :class="$vuetify.locale.isRtl ? 'text-start' : 'text-end'">
                <h6 class="text-h6">Included</h6>
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
                <h6 class="text-h6">${{ total.toLocaleString() }}</h6>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <VDivider class="my-6 border-dashed" />

    <div>
      <h6 class="text-h6 mb-2">Note:</h6>
      <VTextarea
        id="note"
        v-model="note"
        placeholder="Write note here..."
        :rows="2"
      />
    </div>
  </VCard>
</template>
