<script setup lang="ts">
import { hexToRgb } from "@layouts/utils";
import { computed } from "vue";
import { useTheme } from "vuetify";

type BillingMetric = {
  label: string;
  value: number;
  icon: string;
  color: string;
};

const props = defineProps<{
  paid: number;
  unpaid: number;
  toBeInvoiced: number;
}>();

const vuetifyTheme = useTheme();

const total = computed(
  () =>
    Number(props.paid || 0) +
    Number(props.unpaid || 0) +
    Number(props.toBeInvoiced || 0),
);

const metrics = computed<BillingMetric[]>(() => [
  {
    label: "Paid",
    value: Number(props.paid || 0),
    icon: "tabler-cash-banknote",
    color: "success",
  },
  {
    label: "Unpaid",
    value: Number(props.unpaid || 0),
    icon: "tabler-clock-dollar",
    color: "warning",
  },
  {
    label: "To Be Invoiced",
    value: Number(props.toBeInvoiced || 0),
    icon: "tabler-file-invoice",
    color: "primary",
  },
]);

const paidPercent = computed(() => {
  if (total.value <= 0) return 0;

  return Math.round((Number(props.paid || 0) / total.value) * 100);
});

const chartSeries = computed(() => [
  {
    data: metrics.value.map((metric) => metricPercent(metric.value)),
  },
]);

const chartOptions = computed(() => {
  const currentTheme = vuetifyTheme.current.value.colors;
  const variableTheme = vuetifyTheme.current.value.variables;
  const onSurface = hexToRgb(currentTheme["on-surface"]);

  return {
    chart: {
      parentHeightOffset: 0,
      type: "bar",
      toolbar: { show: false },
    },
    plotOptions: {
      bar: {
        barHeight: "60%",
        columnWidth: "38%",
        startingShape: "rounded",
        endingShape: "rounded",
        borderRadius: 4,
        distributed: true,
      },
    },
    grid: {
      show: false,
      padding: {
        top: -30,
        bottom: 0,
        left: -10,
        right: -10,
      },
    },
    colors: [
      `rgba(${hexToRgb(currentTheme.success)}, 1)`,
      `rgba(${hexToRgb(currentTheme.warning)}, 1)`,
      `rgba(${hexToRgb(currentTheme.primary)},${variableTheme["dragged-opacity"]})`,
    ],
    dataLabels: { enabled: false },
    legend: { show: false },
    xaxis: {
      categories: ["Paid", "Unpaid", "TBI"],
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: {
          colors: `rgba(${onSurface},${variableTheme["disabled-opacity"]})`,
          fontSize: "11px",
          fontFamily: "Public Sans",
        },
      },
    },
    yaxis: {
      max: 100,
      labels: { show: false },
    },
    tooltip: { enabled: false },
  };
});

const formatAmount = (value: number) =>
  Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });

const metricPercent = (value: number) => {
  if (total.value <= 0) return 0;

  return Math.min(Math.max((Number(value || 0) / total.value) * 100, 0), 100);
};
</script>

<template>
  <VCard>
    <VCardItem class="pb-sm-0">
      <VCardTitle>Billing Summary</VCardTitle>
      <VCardSubtitle>Invoices & Proformas</VCardSubtitle>

      <template #append> </template>
    </VCardItem>

    <VCardText>
      <VRow>
        <VCol
          cols="12"
          sm="5"
          lg="6"
          class="d-flex flex-column align-self-center"
        >
          <div class="d-flex align-center gap-2 mb-3 flex-wrap">
            <h2 class="text-h2 billing-total">
              {{ formatAmount(total) }}
            </h2>
            <VChip label size="small" color="success">
              {{ paidPercent }}% paid
            </VChip>
          </div>

          <span class="text-sm text-medium-emphasis">
            Billing progress from invoices and proformas
          </span>
        </VCol>

        <VCol cols="12" sm="7" lg="6">
          <VueApexCharts
            :options="chartOptions"
            :series="chartSeries"
            height="161"
          />
        </VCol>
      </VRow>

      <div class="border rounded mt-5 pa-5">
        <VRow>
          <VCol v-for="metric in metrics" :key="metric.label" cols="12" sm="4">
            <div class="d-flex align-center">
              <VAvatar
                rounded
                size="26"
                :color="metric.color"
                variant="tonal"
                class="me-2"
              >
                <VIcon size="18" :icon="metric.icon" />
              </VAvatar>

              <h6 class="text-base font-weight-regular">
                {{ metric.label }}
              </h6>
            </div>

            <h6 class="text-h4 my-2">
              {{ formatAmount(metric.value) }}
            </h6>

            <VProgressLinear
              :model-value="metricPercent(metric.value)"
              :color="metric.color"
              height="4"
              rounded
              rounded-bar
            />
          </VCol>
        </VRow>
      </div>
    </VCardText>
  </VCard>
</template>

<style scoped>
.billing-total {
  line-height: 1;
}

@media (max-width: 1280px) {
  .billing-total {
    font-size: 2rem !important;
  }
}
</style>
