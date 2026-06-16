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
  hidden?: boolean;
  paid: number | null;
  proformaAmount?: number | null;
  proformaCount?: number | null;
  unpaid: number | null;
  toBeInvoiced: number | null;
}>();

const vuetifyTheme = useTheme();

const finiteNumber = (value: unknown) => {
  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : 0;
};

const total = computed(
  () =>
    finiteNumber(props.paid) +
    finiteNumber(props.unpaid) +
    finiteNumber(props.toBeInvoiced),
);

const metrics = computed<BillingMetric[]>(() => [
  {
    label: "Paid",
    value: finiteNumber(props.paid),
    icon: "tabler-cash-banknote",
    color: "success",
  },
  {
    label: "Unpaid",
    value: finiteNumber(props.unpaid),
    icon: "tabler-clock-dollar",
    color: "warning",
  },
  {
    label: "To Be Invoiced",
    value: finiteNumber(props.toBeInvoiced),
    icon: "tabler-file-invoice",
    color: "primary",
  },
]);

const shortLabel = (label: string) => {
  if (label === "To Be Invoiced") return "TBI";

  return label;
};

const paidPercent = computed(() => {
  if (total.value <= 0) return 0;

  return Math.round((finiteNumber(props.paid) / total.value) * 100);
});

const proformaHint = computed(() => {
  if (props.hidden) return "";

  const amount = finiteNumber(props.proformaAmount);
  const count = finiteNumber(props.proformaCount);
  if (amount <= 0 && count <= 0) return "";

  const documentLabel = count === 1 ? "document" : "documents";

  return `Proformas: ${formatAmount(amount)} across ${count} ${documentLabel}.`;
});

const chartSeries = computed(() => [
  {
    data: metrics.value.map((metric) => metricPercent(metric.value)),
  },
]);

const canRenderChart = computed(
  () =>
    total.value > 0 &&
    !props.hidden &&
    chartSeries.value.every((series) =>
      series.data.every((value) => Number.isFinite(value)),
    ),
);

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
  finiteNumber(value).toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });

const hiddenAmountLabel = "Hidden";

const metricPercent = (value: number) => {
  if (total.value <= 0) return 0;

  return Math.min(Math.max((finiteNumber(value) / total.value) * 100, 0), 100);
};
</script>

<template>
  <VCard>
    <VCardItem class="pb-sm-0">
      <VCardTitle>Billing Summary</VCardTitle>
      <VCardSubtitle>Invoices only</VCardSubtitle>

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
              {{ hidden ? hiddenAmountLabel : formatAmount(total) }}
            </h2>
            <VChip v-if="!hidden" label size="small" color="success">
              {{ paidPercent }}% paid
            </VChip>
          </div>

          <span class="text-sm text-medium-emphasis">
            Billing progress from invoices only
          </span>

          <div
            v-if="proformaHint"
            class="text-xs text-info mt-1"
          >
            {{ proformaHint }}
          </div>
        </VCol>

        <VCol cols="12" sm="7" lg="6">
          <VueApexCharts
            v-if="canRenderChart"
            :options="chartOptions"
            :series="chartSeries"
            :height="161"
            :width="'100%'"
          />
          <div
            v-else
            class="billing-chart-placeholder d-flex align-center justify-center text-medium-emphasis"
          >
            {{ hidden ? "Financials hidden" : "No billing chart available" }}
          </div>
        </VCol>
      </VRow>

      <div class="billing-metrics border rounded mt-5 pa-5">
        <VRow class="billing-metrics__row">
          <VCol
            v-for="metric in metrics"
            :key="metric.label"
            cols="12"
            sm="4"
            class="billing-metric-col"
          >
            <div class="d-flex align-center billing-metric-title">
              <VAvatar
                rounded
                size="26"
                :color="metric.color"
                variant="tonal"
                class="me-2"
              >
                <VIcon size="18" :icon="metric.icon" />
              </VAvatar>

              <VTooltip :text="metric.label" location="top">
                <template #activator="{ props: tooltipProps }">
                  <h6
                    v-bind="tooltipProps"
                    class="text-base font-weight-regular billing-metric-label"
                  >
                    {{ shortLabel(metric.label) }}
                  </h6>
                </template>
              </VTooltip>
            </div>

            <h6 class="text-h4 my-2">
              <span :class="{ 'financial-hidden-text': hidden }">
                {{ hidden ? hiddenAmountLabel : formatAmount(metric.value) }}
              </span>
            </h6>

            <VProgressLinear
              v-if="!hidden"
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

.billing-metric-title {
  min-inline-size: 0;
}

.billing-metric-label {
  overflow: hidden;
  font-size: 0.78rem !important;
  max-inline-size: 100%;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.billing-chart-placeholder {
  block-size: 161px;
  min-inline-size: 100%;
}

.financial-hidden-text {
  display: inline-block;
  filter: blur(3px);
  user-select: none;
}

@media (max-width: 1280px) {
  .billing-total {
    font-size: 2rem !important;
  }

  .billing-metrics {
    padding: 0.9rem !important;
  }

  .billing-metric-col {
    flex: 0 0 33.3333%;
    max-inline-size: 33.3333%;
    padding-inline: 0.45rem;
  }

  .billing-metric-label {
    font-size: 0.72rem !important;
  }

  .billing-metric-col .text-h4 {
    font-size: 1.15rem !important;
  }
}
</style>
