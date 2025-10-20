<script setup lang="ts">
import { ref, toRaw, watch } from "vue";

import type { ContactProperties } from "@/plugins/fake-api/handlers/apps/contact/types";

interface Props {
  contact?: ContactProperties | null;
  isDialogVisible: boolean;
  loading?: boolean;
  error?: string | null;
}

interface Emit {
  (e: "submit", value: ContactProperties): void;
  (e: "update:isDialogVisible", value: boolean): void;
}

const props = withDefaults(defineProps<Props>(), {
  contact: null,
  loading: false,
  error: null,
});

const emit = defineEmits<Emit>();

const sanitizeContact = (contact: ContactProperties | null) => {
  if (!contact) return null;

  const raw = toRaw(contact) as ContactProperties;

  return {
    ...raw,
    connections: Array.isArray(raw.connections)
      ? raw.connections.map((connection) => ({ ...toRaw(connection) }))
      : [],
    accounting: {
      taxId: raw.accounting?.taxId ?? "",
      crn: raw.accounting?.crn ?? "",
      vatNumber: raw.accounting?.vatNumber ?? "",
    },
  } as ContactProperties;
};

const localContact = ref<ContactProperties | null>(
  sanitizeContact(props.contact)
);

watch(
  () => props.contact,
  (value) => {
    localContact.value = sanitizeContact(value);
  }
);

// Reset localContact when the dialog is closed so edits are not preserved between openings
watch(
  () => props.isDialogVisible,
  (open) => {
    if (!open) {
      localContact.value = sanitizeContact(props.contact);
      // ensure the stepper resets to the first tab when dialog is closed
      currentStep.value = 0;
    }
  }
);

// Stepper state
const currentStep = ref(0);
const numberedSteps = [
  { title: "Contact Details", icon: "tabler-user" },
  { title: "Additional Info", icon: "tabler-user-plus" },
  { title: "Legal", icon: "tabler-file-description" },
];

const classOptions = ["Lead", "Client", "Supplier", "Contact", "Owner"];
const categoryOptions = ["General", "VIP", "Real Estate"];
const statusOptions = ["Active", "Dormant", "Potential", "Lost"];
const typeOptions = ["Entity", "Individual"];
const channelOptions = [
  "Social Media",
  "Referral",
  "Direct Sales",
  "Website",
  "Email Campaigns",
];

// simple validators
const requiredValidator = (v: any) =>
  (v !== null && v !== undefined && String(v).trim() !== "") || "Required";
const emailValidator = (v: any) =>
  !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v)) || "Invalid email";

const dialogModelValueUpdate = (value: boolean) => {
  emit("update:isDialogVisible", value);
};

/**
 * Save the contact. If `closeAfter` is true the dialog will be closed after saving.
 * When saving mid-step we keep the dialog open so the user can continue editing.
 */
const saveContact = (closeAfter = false) => {
  if (!localContact.value) return;
  emit("submit", localContact.value);
  if (closeAfter) emit("update:isDialogVisible", false);
};

const onReset = () => {
  localContact.value = sanitizeContact(props.contact);
  emit("update:isDialogVisible", false);
};
</script>

<template>
  <VDialog
    :width="$vuetify.display.smAndDown ? 'auto' : 820"
    :model-value="isDialogVisible"
    @update:model-value="dialogModelValueUpdate"
  >
    <DialogCloseBtn @click="dialogModelValueUpdate(false)" />

    <VCard>
      <VCardText>
        <!-- 👉 Stepper: compact on small screens, full on larger -->
        <div
          v-if="$vuetify.display.smAndDown"
          class="d-flex align-center justify-space-between px-2"
        >
          <VBtn
            icon
            variant="text"
            :disabled="currentStep === 0"
            @click="currentStep = Math.max(0, currentStep - 1)"
          >
            <VIcon icon="tabler-arrow-left" />
          </VBtn>

          <div class="text-subtitle-1 text-center">
            {{ numberedSteps[currentStep]?.title }}
          </div>

          <VBtn
            icon
            variant="text"
            :disabled="currentStep === numberedSteps.length - 1"
            @click="
              currentStep = Math.min(numberedSteps.length - 1, currentStep + 1)
            "
          >
            <VIcon icon="tabler-arrow-right" />
          </VBtn>
        </div>

        <div v-else>
          <AppStepper
            v-model:current-step="currentStep"
            :items="numberedSteps"
            icon-size="24"
            class="stepper-icon-step-bg"
          />
        </div>
      </VCardText>

      <VDivider />

      <VCardText>
        <!-- 👉 stepper content -->
        <VForm v-if="localContact" @submit.prevent="() => saveContact(true)">
          <VWindow v-model="currentStep" class="disable-tab-transition">
            <!-- Account Details -->
            <VWindowItem>
              <VRow>
                <VCol cols="12">
                  <h6 class="text-h6 font-weight-medium">Contact Details</h6>
                  <p class="mb-0">Enter the contact account details</p>
                </VCol>

                <VCol cols="12" md="6">
                  <AppTextField
                    v-model="localContact.fullName"
                    label="Full Name"
                    placeholder="John Doe"
                    :rules="[requiredValidator]"
                  />
                </VCol>

                <VCol cols="12" md="6">
                  <AppTextField
                    v-model="localContact.email"
                    label="Email"
                    placeholder="john@example.com"
                    :rules="[requiredValidator, emailValidator]"
                  />
                </VCol>

                <VCol cols="12" md="6">
                  <AppTextField
                    v-model="localContact.number"
                    label="Phone Number"
                    placeholder="+1 555 555 5555"
                    :rules="[requiredValidator]"
                  />
                </VCol>

                <VCol cols="12" md="6">
                  <AppSelect
                    v-model="localContact.class"
                    label="Class"
                    placeholder="Select class"
                    :items="classOptions"
                    :rules="[requiredValidator]"
                  />
                </VCol>

                <VCol cols="12" md="6">
                  <AppSelect
                    v-model="localContact.type"
                    label="Type"
                    placeholder="Select type"
                    :items="typeOptions"
                    :rules="[requiredValidator]"
                  />
                </VCol>

                <VCol cols="12" md="6">
                  <AppSelect
                    v-model="localContact.category"
                    label="Category"
                    placeholder="Select category"
                    :items="categoryOptions"
                  />
                </VCol>

                <VCol cols="12" md="6">
                  <AppSelect
                    v-model="localContact.status"
                    label="Status"
                    placeholder="Select status"
                    :items="statusOptions"
                  />
                </VCol>

                <VCol cols="12" md="6">
                  <VSwitch
                    class="mt-5"
                    v-model="localContact.worksInSales"
                    label="Works in sales?"
                    color="primary"
                  />
                </VCol>
              </VRow>
            </VWindowItem>

            <!-- Additional Info -->
            <VWindowItem>
              <VRow>
                <VCol cols="12">
                  <h6 class="text-h6 font-weight-medium">Additional Info</h6>
                  <p class="mb-0">Setup additional contact information</p>
                </VCol>

                <VCol cols="12" md="6">
                  <AppTextField
                    v-model="localContact.country"
                    label="Country"
                    placeholder="Country"
                  />
                </VCol>

                <VCol cols="12" md="6">
                  <AppTextField
                    v-model="localContact.city"
                    label="City"
                    placeholder="City"
                  />
                </VCol>

                <VCol cols="12">
                  <AppTextField
                    v-model="localContact.address"
                    label="Address"
                    placeholder="Street, building, floor"
                  />
                </VCol>

                <VCol cols="12" md="6">
                  <AppTextField
                    v-model="localContact.language"
                    label="Language"
                    placeholder="English"
                  />
                </VCol>

                <VCol cols="12" md="6">
                  <AppDateTimePicker
                    v-model="localContact.birthdate"
                    label="Birthdate"
                    placeholder="Select date"
                    clearable
                    :max="new Date().toISOString().split('T')[0]"
                  />
                </VCol>

                <VCol cols="12" md="6">
                  <AppSelect
                    v-model="localContact.channel"
                    label="Channel"
                    placeholder="Select channel"
                    :items="channelOptions"
                  />
                </VCol>
              </VRow>
            </VWindowItem>

            <!-- Legal -->
            <VWindowItem>
              <VRow>
                <VCol cols="12">
                  <h6 class="text-h6 font-weight-medium">Legal</h6>
                  <p class="mb-0">Legal and tax information</p>
                </VCol>

                <VCol cols="12" md="6">
                  <AppTextField
                    v-model="localContact.accounting.taxId"
                    label="Tax ID"
                    placeholder="TAX-123456"
                  />
                </VCol>

                <VCol cols="12" md="6">
                  <AppTextField
                    v-model="localContact.accounting.vatNumber"
                    label="VAT Number"
                    placeholder="VAT-112233"
                  />
                </VCol>

                <VCol cols="12" md="6">
                  <AppTextField
                    v-model="localContact.accounting.crn"
                    label="CRN"
                    placeholder="CRN-9981"
                  />
                </VCol>
              </VRow>
            </VWindowItem>
          </VWindow>

          <div class="d-flex flex-wrap align-center mt-8">
            <VBtn
              color="secondary"
              variant="tonal"
              :disabled="currentStep === 0"
              @click="currentStep--"
            >
              <VIcon icon="tabler-arrow-left" start class="flip-in-rtl" />
              Previous
            </VBtn>

            <VSpacer />

            <!-- right grouped buttons: Save and Next stick together -->
            <div class="d-flex align-center gap-2">
              <VBtn
                color="primary"
                @click.prevent="
                  () => saveContact(numberedSteps.length - 1 === currentStep)
                "
              >
                Save
              </VBtn>

              <VBtn
                variant="tonal"
                v-if="numberedSteps.length - 1 !== currentStep"
                @click="currentStep++"
              >
                Next
                <VIcon icon="tabler-arrow-right" end class="flip-in-rtl" />
              </VBtn>
            </div>
          </div>
        </VForm>

        <VAlert v-else type="warning" variant="tonal">
          Unable to load contact details.
        </VAlert>
      </VCardText>
    </VCard>
  </VDialog>
</template>
