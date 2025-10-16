<script setup lang="ts">
import americanExpress from "@images/icons/payments/american-express.png";
import mastercard from "@images/icons/payments/mastercard.png";
import visa from "@images/icons/payments/visa.png";

interface CardDetail {
  name: string;
  number: string;
  expiry: string;
  isPrimary: boolean;
  isExpired?: boolean;
  type: string;
  cvv: string;
  image: string;
}

import avatar1 from "@images/avatars/avatar-1.png";
import avatar2 from "@images/avatars/avatar-2.png";
import avatar3 from "@images/avatars/avatar-3.png";
import pdf from "@images/icons/project-icons/pdf.png";

const isUpgradePlanDialogVisible = ref(false);

const currentCardDetails = ref();
const isCardEditDialogVisible = ref(false);
const isCardAddDialogVisible = ref(false);
const isEditAddressDialogVisible = ref(false);

const openEditCardDialog = (cardDetails: CardDetail) => {
  currentCardDetails.value = cardDetails;

  isCardEditDialogVisible.value = true;
};

const creditCards: CardDetail[] = [
  {
    name: "Tom McBride",
    number: "4851234567899865",
    expiry: "12/24",
    isPrimary: true,
    isExpired: false,
    type: "mastercard",
    cvv: "123",
    image: mastercard,
  },
  {
    name: "Mildred Wagner",
    number: "5531234567895678",
    expiry: "02/24",
    isPrimary: false,
    isExpired: false,
    type: "visa",
    cvv: "456",
    image: visa,
  },
  {
    name: "Lester Jennings",
    number: "5531234567890002",
    expiry: "08/20",
    isPrimary: false,
    isExpired: true,
    type: "visa",
    cvv: "456",
    image: americanExpress,
  },
];

const currentAddress = {
  companyName: "Pixinvent",
  billingEmail: "gertrude@gmail.com",
  taxID: "TAX-875623",
  vatNumber: "SDF754K77",
  address: "100 Water Plant Avenue, Building 1303 Wake Island",
  contact: "+1(609) 933-44-22",
  country: "USA",
  state: "Queensland",
  zipCode: 403114,
};

const currentBillingAddress = {
  firstName: "Shamus",
  lastName: "Tuttle",
  selectedCountry: "USA",
  addressLine1: "45 Rocker Terrace",
  addressLine2: "Latheronwheel",
  landmark: "KW5 8NW, London",
  contact: "+1 (609) 972-22-22",
  country: "USA",
  city: "London",
  state: "London",
  zipCode: 110001,
};
</script>

<template>
  <VRow>
    <VCol cols="12">
      <!-- 👉 User Activity timeline -->
      <VCard title="User Activity Timeline">
        <VCardText>
          <VTimeline
            side="end"
            align="start"
            line-inset="8"
            truncate-line="start"
            density="compact"
          >
            <!-- SECTION Timeline Item: Flight -->
            <VTimelineItem dot-color="primary" size="x-small">
              <!-- 👉 Header -->
              <div
                class="d-flex justify-space-between align-center gap-2 flex-wrap mb-2"
              >
                <span class="app-timeline-title">
                  12 Invoices have been paid
                </span>
                <span class="app-timeline-meta">12 min ago</span>
              </div>

              <!-- 👉 Content -->
              <div class="app-timeline-text mt-1">
                Invoices have been paid to the company
              </div>

              <div class="d-inline-flex align-center timeline-chip mt-2">
                <img :src="pdf" height="20" class="me-2" alt="img" />
                <span class="app-timeline-text font-weight-medium">
                  invoice.pdf
                </span>
              </div>
            </VTimelineItem>
            <!-- !SECTION -->

            <!-- SECTION Timeline Item: Interview Schedule -->
            <VTimelineItem size="x-small" dot-color="success">
              <!-- 👉 Header -->
              <div
                class="d-flex justify-space-between align-center flex-wrap mb-2"
              >
                <div class="app-timeline-title">Client Meeting</div>
                <span class="app-timeline-meta">45 min ago</span>
              </div>

              <div class="app-timeline-text mt-1">
                Project meeting with john @10:15am
              </div>

              <!-- 👉 Person -->
              <div class="d-flex justify-space-between align-center flex-wrap">
                <!-- 👉 Avatar & Personal Info -->
                <div class="d-flex align-center mt-2">
                  <VAvatar size="32" class="me-2" :image="avatar1" />
                  <div class="d-flex flex-column">
                    <p
                      class="text-sm font-weight-medium text-medium-emphasis mb-0"
                    >
                      Lester McCarthy (Client)
                    </p>
                    <span class="text-sm">CEO of Pixinvent</span>
                  </div>
                </div>
              </div>
            </VTimelineItem>
            <!-- !SECTION -->

            <!-- SECTION Design Review -->
            <VTimelineItem size="x-small" dot-color="info">
              <!-- 👉 Header -->
              <div
                class="d-flex justify-space-between align-center flex-wrap mb-2"
              >
                <span class="app-timeline-title">
                  Create a new project for client
                </span>
                <span class="app-timeline-meta">2 Day Ago</span>
              </div>

              <!-- 👉 Content -->
              <p class="app-timeline-text mt-1 mb-2">
                6 team members in a project
              </p>

              <div class="v-avatar-group demo-avatar-group">
                <VAvatar :size="40">
                  <VImg :src="avatar1" />
                  <VTooltip activator="parent" location="top">
                    John Doe
                  </VTooltip>
                </VAvatar>

                <VAvatar :size="40">
                  <VImg :src="avatar2" />
                  <VTooltip activator="parent" location="top">
                    Jennie Obrien
                  </VTooltip>
                </VAvatar>

                <VAvatar :size="40">
                  <VImg :src="avatar3" />
                  <VTooltip activator="parent" location="top">
                    Peter Harper
                  </VTooltip>
                </VAvatar>

                <VAvatar
                  :size="40"
                  :color="$vuetify.theme.current.dark ? '#373b50' : '#eeedf0'"
                >
                  +3
                </VAvatar>
              </div>
            </VTimelineItem>
            <!-- !SECTION -->
            <!-- SECTION Timeline Item: Flight -->
            <VTimelineItem dot-color="primary" size="x-small">
              <!-- 👉 Header -->
              <div
                class="d-flex justify-space-between align-center gap-2 flex-wrap mb-2"
              >
                <span class="app-timeline-title">
                  12 Invoices have been paid
                </span>
                <span class="app-timeline-meta">12 min ago</span>
              </div>

              <!-- 👉 Content -->
              <div class="app-timeline-text mt-1">
                Invoices have been paid to the company
              </div>

              <div class="d-inline-flex align-center timeline-chip mt-2">
                <img :src="pdf" height="20" class="me-2" alt="img" />
                <span class="app-timeline-text font-weight-medium">
                  invoice.pdf
                </span>
              </div>
            </VTimelineItem>
            <!-- !SECTION -->

            <!-- SECTION Timeline Item: Interview Schedule -->
            <VTimelineItem size="x-small" dot-color="success">
              <!-- 👉 Header -->
              <div
                class="d-flex justify-space-between align-center flex-wrap mb-2"
              >
                <div class="app-timeline-title">Client Meeting</div>
                <span class="app-timeline-meta">45 min ago</span>
              </div>

              <div class="app-timeline-text mt-1">
                Project meeting with john @10:15am
              </div>

              <!-- 👉 Person -->
              <div class="d-flex justify-space-between align-center flex-wrap">
                <!-- 👉 Avatar & Personal Info -->
                <div class="d-flex align-center mt-2">
                  <VAvatar size="32" class="me-2" :image="avatar1" />
                  <div class="d-flex flex-column">
                    <p
                      class="text-sm font-weight-medium text-medium-emphasis mb-0"
                    >
                      Lester McCarthy (Client)
                    </p>
                    <span class="text-sm">CEO of Pixinvent</span>
                  </div>
                </div>
              </div>
            </VTimelineItem>
            <!-- !SECTION -->

            <!-- SECTION Design Review -->
            <VTimelineItem size="x-small" dot-color="info">
              <!-- 👉 Header -->
              <div
                class="d-flex justify-space-between align-center flex-wrap mb-2"
              >
                <span class="app-timeline-title">
                  Create a new project for client
                </span>
                <span class="app-timeline-meta">2 Day Ago</span>
              </div>

              <!-- 👉 Content -->
              <p class="app-timeline-text mt-1 mb-2">
                6 team members in a project
              </p>

              <div class="v-avatar-group demo-avatar-group">
                <VAvatar :size="40">
                  <VImg :src="avatar1" />
                  <VTooltip activator="parent" location="top">
                    John Doe
                  </VTooltip>
                </VAvatar>

                <VAvatar :size="40">
                  <VImg :src="avatar2" />
                  <VTooltip activator="parent" location="top">
                    Jennie Obrien
                  </VTooltip>
                </VAvatar>

                <VAvatar :size="40">
                  <VImg :src="avatar3" />
                  <VTooltip activator="parent" location="top">
                    Peter Harper
                  </VTooltip>
                </VAvatar>

                <VAvatar
                  :size="40"
                  :color="$vuetify.theme.current.dark ? '#373b50' : '#eeedf0'"
                >
                  +3
                </VAvatar>
              </div>
            </VTimelineItem>
            <!-- !SECTION -->
          </VTimeline>
        </VCardText>
      </VCard>
    </VCol>
  </VRow>

  <!-- 👉 Edit Card Dialog -->
  <CardAddEditDialog
    v-model:is-dialog-visible="isCardEditDialogVisible"
    :card-details="currentCardDetails"
  />

  <!-- 👉 Add Card Dialog -->
  <CardAddEditDialog v-model:is-dialog-visible="isCardAddDialogVisible" />

  <!-- 👉 Edit Address dialog -->
  <AddEditAddressDialog
    v-model:is-dialog-visible="isEditAddressDialogVisible"
    :billing-address="currentBillingAddress"
  />

  <!-- 👉 Upgrade plan dialog -->
  <UserUpgradePlanDialog
    v-model:is-dialog-visible="isUpgradePlanDialogVisible"
  />
</template>

<style lang="scss">
.billing-address-table {
  tr {
    td:first-child {
      inline-size: 148px;
    }
  }
}
</style>
