<!-- eslint-disable vue/no-mutating-props -->
<script setup lang="ts">
import { useCataloguesStore } from "@/stores/catalogues";
import { useConfigStore } from "@/stores/config";
import { formatCurrencyAmount, getVatSummary } from "@/utils/quotationConfig";
import { getLineDiscountAmount, getLineTotal } from "@/utils/quotationPricing";

interface Emit {
  (e: "removeProduct", value: number): void;
}

interface Props {
  id: number;
  data: {
    catalogueItemId?: string | null;
    lineConstraints?: {
      quantity?: boolean;
      price?: boolean;
      discount?: boolean;
    } | null;
    title: string;
    cost: number;
    hours: number;
    discountType?: "none" | "percent" | "currency";
    discountValue?: number;
    taxApplicable?: boolean | null;
    description: string;
  };
}

type CatalogueOption = {
  id: string;
  title: string;
  price: number;
  description: string;
};

const props = withDefaults(defineProps<Props>(), {
  data: () => ({
    catalogueItemId: null,
    title: "",
    cost: 0,
    hours: 1,
    discountType: "none",
    discountValue: 0,
    taxApplicable: true,
    description: "",
  }),
});

const emit = defineEmits<Emit>();

const cataloguesStore = useCataloguesStore();
cataloguesStore.init();

const configStore = useConfigStore();
configStore.init();

const catalogueOptions = computed<CatalogueOption[]>(() =>
  cataloguesStore.all
    .filter((item) => item.name.trim())
    .map((item) => ({
      id: item.id,
      title: item.name,
      price: Number(item.bestPrice) || 0,
      description: item.description?.trim() || "",
    }))
    .sort((a, b) => a.title.localeCompare(b.title)),
);

const itemOptions = computed(() =>
  catalogueOptions.value.map((item) => item.title),
);

const selectedItem = computed({
  get: () => props.data.title,
  set: (value: string | null) => {
    const title = String(value ?? "").trim();
    const matchedItem =
      catalogueOptions.value.find(
        (item) => item.title.toLowerCase() === title.toLowerCase(),
      ) || null;

    if (matchedItem) {
      props.data.catalogueItemId = matchedItem.id;
      props.data.title = matchedItem.title;
      props.data.cost = matchedItem.price;
      props.data.discountType = "none";
      props.data.discountValue = 0;
      props.data.description = matchedItem.description;
      return;
    }

    props.data.catalogueItemId = null;
    props.data.title = title;
    props.data.cost = 0;
    props.data.discountType = "none";
    props.data.discountValue = 0;
    props.data.description = "";
  },
});

const discountOptions = [
  { title: "No", value: "none" },
  { title: "%", value: "percent" },
  { title: "Currency", value: "currency" },
] as const;

const canEditPrice = computed(
  () => props.data.lineConstraints?.price !== false,
);
const canEditQuantity = computed(
  () => props.data.lineConstraints?.quantity !== false,
);
const canEditDiscount = computed(
  () => props.data.lineConstraints?.discount !== false,
);
const lineBaseTotal = computed(
  () => Number(props.data.cost || 0) * Number(props.data.hours || 0),
);
const discountValueMax = computed(() =>
  props.data.discountType === "percent" ? 100 : lineBaseTotal.value,
);

watch(
  () => props.data.discountType,
  (discountType) => {
    if (discountType !== "percent" && discountType !== "currency") {
      props.data.discountValue = 0;
      return;
    }

    props.data.discountValue = Math.min(
      Math.max(0, Number(props.data.discountValue || 0)),
      discountValueMax.value,
    );
  },
  { immediate: true },
);

watch(
  [canEditPrice, canEditQuantity, canEditDiscount],
  () => {
    if (!canEditPrice.value) props.data.cost = 0;
    if (!canEditQuantity.value) props.data.hours = 1;
    if (!canEditDiscount.value) {
      props.data.discountType = "none";
      props.data.discountValue = 0;
    }
  },
  { immediate: true },
);

watch(
  () => [
    props.data.discountValue,
    props.data.discountType,
    props.data.cost,
    props.data.hours,
  ],
  () => {
    if (
      props.data.discountType !== "percent" &&
      props.data.discountType !== "currency"
    ) {
      return;
    }

    props.data.discountValue = Math.min(
      Math.max(0, Number(props.data.discountValue || 0)),
      discountValueMax.value,
    );
  },
);

const removeProduct = () => {
  emit("removeProduct", props.id);
};

const totalPrice = computed(() => getLineTotal(props.data));
const discountAmount = computed(() => getLineDiscountAmount(props.data));
const formattedDiscountAmount = computed(() =>
  formatCurrencyAmount(discountAmount.value, configStore.financial),
);
const formattedTotalPrice = computed(() =>
  formatCurrencyAmount(totalPrice.value, configStore.financial),
);
const lineTaxApplicable = computed({
  get: () => props.data.taxApplicable !== false,
  set: (value: boolean) => {
    props.data.taxApplicable = Boolean(value);
  },
});
const taxSummaryLabel = computed(() =>
  lineTaxApplicable.value
    ? getVatSummary(configStore.financial).value
    : "Not Applied",
);
</script>

<template>
  <div class="add-products-header mb-2 d-none d-md-flex mb-4">
    <VRow class="me-10">
      <VCol cols="12" md="6">
        <h6 class="text-h6">Item</h6>
      </VCol>
      <VCol v-if="canEditPrice" cols="12" md="2">
        <h6 class="text-h6 ps-2">Price</h6>
      </VCol>
      <VCol v-if="canEditQuantity" cols="12" md="2">
        <h6 class="text-h6 ps-2">Quantity</h6>
      </VCol>
      <VCol cols="12" md="2">
        <h6 class="text-h6 ps-2">Amount</h6>
      </VCol>
    </VRow>
  </div>

  <VCard
    flat
    border
    class="d-flex flex-sm-row flex-column-reverse product-edit-card"
  >
    <div class="pa-6 flex-grow-1">
      <VRow>
        <VCol cols="12" md="6">
          <AppCombobox
            id="item"
            v-model="selectedItem"
            :items="itemOptions"
            placeholder="Search item"
            class="mb-6"
          />

          <div class="product-description-row">
            <AppTextarea
              id="item-description"
              v-model="props.data.description"
              auto-grow
              rows="2"
              placeholder="Item description"
              persistent-placeholder
              class="product-description-field"
            />

            <div
              class="line-adjustment-summary text-caption text-medium-emphasis"
            >
              <div>Discount: {{ formattedDiscountAmount }}</div>
              <div>Tax: {{ taxSummaryLabel }}</div>
            </div>
          </div>
        </VCol>

        <VCol v-if="canEditPrice" cols="12" md="2" sm="4">
          <AppTextField
            id="item-cost"
            v-model="props.data.cost"
            type="number"
            placeholder="Price"
          />
        </VCol>

        <VCol v-if="canEditQuantity" cols="12" md="2" sm="4">
          <AppTextField
            id="item-hours"
            v-model="props.data.hours"
            type="number"
            placeholder="1"
          />
        </VCol>

        <VCol cols="12" md="2" sm="4">
          <div class="line-amount-summary">
            <p class="mb-1 text-high-emphasis font-weight-medium">
              <span class="d-inline d-md-none">Line total: </span>
              {{ formattedTotalPrice }}
            </p>
          </div>
        </VCol>
      </VRow>
    </div>

    <div
      class="d-flex flex-column align-end item-actions"
      :class="$vuetify.display.smAndUp ? 'border-s' : 'border-b'"
    >
      <IconBtn size="36" @click="removeProduct">
        <VIcon :size="24" icon="tabler-x" />
      </IconBtn>

      <VMenu
        v-if="canEditDiscount"
        location="bottom end"
        :close-on-content-click="false"
      >
        <template #activator="{ props: menuProps }">
          <IconBtn
            v-bind="menuProps"
            size="32"
            class="mt-auto product-settings-btn"
          >
            <VIcon :size="20" icon="tabler-settings" />
          </IconBtn>
        </template>

        <VCard class="product-settings-menu pa-4" elevation="8">
          <div class="d-flex gap-3 mb-4">
            <AppSelect
              id="item-discount-type"
              v-model="props.data.discountType"
              :items="discountOptions"
              item-title="title"
              item-value="value"
              label="Discount Type"
              density="compact"
            />

            <AppTextField
              id="item-discount-value"
              v-model="props.data.discountValue"
              type="number"
              label="Amount"
              min="0"
              :max="discountValueMax"
              density="compact"
              :disabled="props.data.discountType === 'none'"
            />
          </div>

          <VSwitch
            v-model="lineTaxApplicable"
            label="Taxable"
            density="compact"
            color="primary"
            hide-details
          />
        </VCard>
      </VMenu>
    </div>
  </VCard>
</template>

<style scoped>
.product-edit-card {
  position: relative;
}

.item-actions {
  min-inline-size: 42px;
  padding-block: 0.25rem;
}

.product-settings-menu {
  inline-size: 320px;
}

.line-amount-summary {
  min-inline-size: 0;
}

.product-description-row {
  display: grid;
  align-items: start;
  gap: 0.75rem;
  grid-template-columns: minmax(0, 1fr);
  inline-size: 100%;
}

.line-adjustment-summary {
  padding-block-start: 0.25rem;
}

@media (min-width: 960px) {
  .product-description-field {
    max-inline-size: none;
  }
}

@media (max-width: 959.98px) {
  .product-description-row {
    grid-template-columns: 1fr;
  }
}
</style>
