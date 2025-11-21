<script setup lang="ts">
import EditableChipList from "@/components/EditableChipList.vue";
import { useConfigStore } from "@/stores/config";
import { useNotificationsStore } from "@/stores/notifications";
import { computed, onMounted, onUnmounted, ref } from "vue";

const store = useConfigStore();
store.init();
const notifications = useNotificationsStore();

const categoryLabel = computed(() => "Category");
const categoryPlaceholder = computed(
  () => `Add ${categoryLabel.value.toLowerCase()}s`
);
const indCategoryPlaceholder = computed(
  () => `Add ${categoryLabel.value.toLowerCase()}s`
);

const categories = ref<string[]>([]);
const indCategories = ref<string[]>([]);
const channels = ref<string[]>([]);
const docTypes = ref<string[]>([]);
const docCategories = ref<string[]>([]);
const callPurposes = ref<string[]>([]);
const sentiments = ref<string[]>([]);
const notes = ref<string[]>([]);
const meetings = ref<string[]>([]);

const isSavingCategories = ref(false);
const isSavingIndCategories = ref(false);
const isSavingChannels = ref(false);
const isSavingDocuments = ref(false);
const isSavingCallPurposes = ref(false);
const isSavingSentiments = ref(false);
const isSavingNotes = ref(false);
const isSavingMeetings = ref(false);
const isSavingFlags = ref(false);
const isSavingIndFlags = ref(false);
const isSavingDefaultContactType = ref(false);

const requirePhone = ref(false);
const requireEmail = ref(false);
const inactiveAfterMonths = ref(0);
const indRequirePhone = ref(false);
const indRequireEmail = ref(false);
const indInactiveAfterMonths = ref(0);
let inactiveSaveHandle: ReturnType<typeof setTimeout> | null = null;
let indInactiveSaveHandle: ReturnType<typeof setTimeout> | null = null;

const defaultContactType = ref<string>("Individual");
const documentRenewable = ref<boolean | null>(null);

const notifyWarn = (message: string) =>
  notifications.push(message, "warning", 2000);
const notifyError = (message: string) =>
  notifications.push(message, "error", 2000);

const formatEntry = (value?: string | null) => {
  const trimmed = (value ?? "").toString().trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

const cleanEntries = (values?: (string | null | undefined)[]) => {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => formatEntry(value ?? ""))
    .filter((value) => value.length);
};

const loadData = () => {
  const org = store.configurations.crm || {};
  defaultContactType.value = (org as any)?.DefaultContactType ?? "Individual";

  const orgSection = org.organization || {};
  requirePhone.value = !!orgSection.requirePhone;
  requireEmail.value = !!orgSection.requireEmail;
  inactiveAfterMonths.value = Number(orgSection.inactiveAfterMonths ?? 0);
  categories.value = cleanEntries((org as any)?.organizationCategories || []);

  const indSection = org.individual || {};
  indRequirePhone.value = !!indSection.requirePhone;
  indRequireEmail.value = !!indSection.requireEmail;
  indInactiveAfterMonths.value = Number(indSection.inactiveAfterMonths ?? 0);
  indCategories.value = cleanEntries((org as any)?.individualCategories || []);

  channels.value = cleanEntries((org as any)?.channels || []);
  callPurposes.value = cleanEntries((org as any)?.callPurposes || []);
  sentiments.value = cleanEntries((org as any)?.sentiment || []);
  notes.value = cleanEntries((org as any)?.notes || []);
  meetings.value = cleanEntries((org as any)?.meetings || []);

  const explicitTypes = (org as any)?.documentTypes;
  const explicitCats = (org as any)?.documentCategories;
  if (Array.isArray(explicitTypes) || Array.isArray(explicitCats)) {
    docTypes.value = cleanEntries(Array.isArray(explicitTypes) ? explicitTypes : []);
    docCategories.value = cleanEntries(
      Array.isArray(explicitCats) ? explicitCats : []
    );
    const dr = (org as any)?.documentRenewable;
    if (typeof dr === "string") {
      documentRenewable.value =
        dr === "yes" ? true : dr === "no" ? false : null;
    } else if (typeof dr === "boolean") {
      documentRenewable.value = dr;
    } else {
      documentRenewable.value = null;
    }
  } else {
    const docs = (org as any)?.documents || [];
    const docEntry = docs[0] || {};
    docTypes.value = cleanEntries((docEntry.type || "").toString().split(","));
    docCategories.value = cleanEntries(
      (docEntry.category || "").toString().split(",")
    );
    documentRenewable.value =
      typeof docEntry.renewable === "boolean" ? docEntry.renewable : null;
  }
};

onMounted(loadData);

type SavePayload = { values: string[]; action: "update" | "delete" };

const saveCategories = async (payload: SavePayload) => {
  const cleaned = cleanEntries(payload.values);
  isSavingCategories.value = true;
  const res = await store.saveRemote({
    crm: { organizationCategories: cleaned },
  } as any);
  isSavingCategories.value = false;
  if (res) {
    categories.value = cleaned;
    if (payload.action !== "delete") {
      notifications.push("Categories saved", "success", 2000);
    }
  } else {
    notifications.push("Failed to save categories", "error", 3000);
    loadData();
  }
};

const saveIndCategories = async (payload: SavePayload) => {
  const cleaned = cleanEntries(payload.values);
  isSavingIndCategories.value = true;
  const res = await store.saveRemote({
    crm: { individualCategories: cleaned },
  } as any);
  isSavingIndCategories.value = false;
  if (res) {
    indCategories.value = cleaned;
    if (payload.action !== "delete") {
      notifications.push("Categories saved", "success", 2000);
    }
  } else {
    notifications.push("Failed to save categories", "error", 3000);
    loadData();
  }
};

const saveChannels = async (payload: SavePayload) => {
  const cleaned = cleanEntries(payload.values);
  isSavingChannels.value = true;
  const res = await store.saveRemote({
    crm: { ...(store.configurations.crm || {}), channels: cleaned },
  } as any);
  isSavingChannels.value = false;
  if (res) {
    channels.value = cleaned;
    if (payload.action !== "delete") {
      notifications.push("Channels saved", "success", 2000);
    }
  } else {
    notifications.push("Failed to save channels", "error", 3000);
    loadData();
  }
};

const saveCallPurposes = async (payload: SavePayload) => {
  const cleaned = cleanEntries(payload.values);
  isSavingCallPurposes.value = true;
  const res = await store.saveRemote({
    crm: { ...(store.configurations.crm || {}), callPurposes: cleaned },
  } as any);
  isSavingCallPurposes.value = false;
  if (res) {
    callPurposes.value = cleaned;
    if (payload.action !== "delete") {
      notifications.push("Call purposes saved", "success", 2000);
    }
  } else {
    notifications.push("Failed to save call purposes", "error", 3000);
    loadData();
  }
};

const saveSentiments = async (payload: SavePayload) => {
  const cleaned = cleanEntries(payload.values);
  isSavingSentiments.value = true;
  const res = await store.saveRemote({
    crm: { ...(store.configurations.crm || {}), sentiment: cleaned },
  } as any);
  isSavingSentiments.value = false;
  if (res) {
    sentiments.value = cleaned;
    if (payload.action !== "delete") {
      notifications.push("Sentiments saved", "success", 2000);
    }
  } else {
    notifications.push("Failed to save sentiments", "error", 3000);
    loadData();
  }
};

const saveNotes = async (payload: SavePayload) => {
  const cleaned = cleanEntries(payload.values);
  isSavingNotes.value = true;
  const res = await store.saveRemote({
    crm: { ...(store.configurations.crm || {}), notes: cleaned },
  } as any);
  isSavingNotes.value = false;
  if (res) {
    notes.value = cleaned;
    if (payload.action !== "delete") {
      notifications.push("Notes saved", "success", 2000);
    }
  } else {
    notifications.push("Failed to save notes", "error", 3000);
    loadData();
  }
};

const saveMeetings = async (payload: SavePayload) => {
  const cleaned = cleanEntries(payload.values);
  isSavingMeetings.value = true;
  const res = await store.saveRemote({
    crm: { ...(store.configurations.crm || {}), meetings: cleaned },
  } as any);
  isSavingMeetings.value = false;
  if (res) {
    meetings.value = cleaned;
    if (payload.action !== "delete") {
      notifications.push("Meetings saved", "success", 2000);
    }
  } else {
    notifications.push("Failed to save meetings", "error", 3000);
    loadData();
  }
};

const saveDocuments = async (action: "update" | "delete" = "update") => {
  const types = cleanEntries(docTypes.value);
  const categories = cleanEntries(docCategories.value);
  isSavingDocuments.value = true;
  const payload: any = {
    ...(store.configurations.crm || {}),
    documentTypes: types,
    documentCategories: categories,
    documentRenewable:
      documentRenewable.value === true
        ? "yes"
        : documentRenewable.value === false
        ? "no"
        : null,
  };
  const res = await store.saveRemote({ crm: payload } as any);
  isSavingDocuments.value = false;
  if (res) {
    docTypes.value = types;
    docCategories.value = categories;
    if (action !== "delete") {
      notifications.push("Documents saved", "success", 2000);
    }
  } else {
    notifications.push("Failed to save documents", "error", 3000);
    loadData();
  }
};

const saveDocTypes = async (payload: SavePayload) => {
  docTypes.value = cleanEntries(payload.values);
  await saveDocuments(payload.action);
};

const saveDocCategories = async (payload: SavePayload) => {
  docCategories.value = cleanEntries(payload.values);
  await saveDocuments(payload.action);
};

const saveFlags = async () => {
  if (isSavingFlags.value) return;
  isSavingFlags.value = true;
  const res = await store.saveRemote({
    crm: {
      organization: {
        ...(store.configurations.crm?.organization || {}),
        requirePhone: requirePhone.value,
        requireEmail: requireEmail.value,
        inactiveAfterMonths: inactiveAfterMonths.value,
      },
    },
  } as any);
  isSavingFlags.value = false;
  if (res) {
    notifications.push("Organization settings saved", "success", 2000);
  } else {
    notifications.push("Failed to save organization settings", "error", 3000);
    loadData();
  }
};

const saveIndFlags = async () => {
  if (isSavingIndFlags.value) return;
  isSavingIndFlags.value = true;
  const res = await store.saveRemote({
    crm: {
      individual: {
        ...(store.configurations.crm?.individual || {}),
        requirePhone: indRequirePhone.value,
        requireEmail: indRequireEmail.value,
        inactiveAfterMonths: indInactiveAfterMonths.value,
      },
    },
  } as any);
  isSavingIndFlags.value = false;
  if (res) {
    notifications.push("Individual settings saved", "success", 2000);
  } else {
    notifications.push("Failed to save individual settings", "error", 3000);
    loadData();
  }
};

const saveDefaultContactType = async () => {
  if (isSavingDefaultContactType.value) return;
  isSavingDefaultContactType.value = true;
  const res = await store.saveRemote({
    crm: { ...(store.configurations.crm || {}), DefaultContactType: defaultContactType.value },
  } as any);
  isSavingDefaultContactType.value = false;
  if (res) {
    notifications.push("Default contact type saved", "success", 2000);
  } else {
    notifications.push("Failed to save default contact type", "error", 3000);
    loadData();
  }
};

const onInactiveInput = (event: Event) => {
  const val = parseFloat((event.target as HTMLInputElement).value);
  inactiveAfterMonths.value = isNaN(val) || val < 0 ? 0 : val;
  if (inactiveSaveHandle) clearTimeout(inactiveSaveHandle);
  inactiveSaveHandle = setTimeout(() => {
    inactiveSaveHandle = null;
    void saveFlags();
  }, 400);
};

const onIndInactiveInput = (event: Event) => {
  const val = parseFloat((event.target as HTMLInputElement).value);
  indInactiveAfterMonths.value = isNaN(val) || val < 0 ? 0 : val;
  if (indInactiveSaveHandle) clearTimeout(indInactiveSaveHandle);
  indInactiveSaveHandle = setTimeout(() => {
    indInactiveSaveHandle = null;
    void saveIndFlags();
  }, 400);
};

onUnmounted(() => {
  if (inactiveSaveHandle) {
    clearTimeout(inactiveSaveHandle);
    inactiveSaveHandle = null;
  }
  if (indInactiveSaveHandle) {
    clearTimeout(indInactiveSaveHandle);
    indInactiveSaveHandle = null;
  }
});
</script>

<template>
  <VCard class="mb-6" title="Contact Configuration">
    <VCardText>
      <VCard variant="flat" class="mb-4 testTed">
        <VCardItem>
          <VCardTitle>Organization</VCardTitle>
        </VCardItem>
        <VCardText>
          <EditableChipList
            label="Category"
            :items="categories"
            :loading="isSavingCategories"
            :placeholder="categoryPlaceholder"
            @save="saveCategories"
            @warn="notifyWarn"
            @error="notifyError"
          />

          <VRow>
            <VCol cols="12" md="4">
              <label class="text-subtitle-2 mb-2 d-block">
                Inactive After (Months)
              </label>
              <AppTextField
                v-model.number="inactiveAfterMonths"
                type="number"
                min="0"
                hide-details
                density="compact"
                :loading="isSavingFlags"
                :disabled="isSavingFlags"
                @keydown="
                  (e: KeyboardEvent) => {
                    if (e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+') e.preventDefault();
                  }
                "
                @input="onInactiveInput"
              />
            </VCol>
            <VCol cols="6" md="4">
              <VRadioGroup
                label="Require Phone?"
                v-model="requirePhone"
                inline
                :disabled="isSavingFlags"
                class="mb-0"
                @change="() => void saveFlags()"
              >
                <VRadio :value="true" label="Yes" />
                <VRadio :value="false" label="No" />
              </VRadioGroup>
            </VCol>
            <VCol cols="6" md="4">
              <VRadioGroup
                label="Require Email?"
                v-model="requireEmail"
                inline
                :disabled="isSavingFlags"
                class="mb-0"
                @change="() => void saveFlags()"
              >
                <VRadio :value="true" label="Yes" />
                <VRadio :value="false" label="No" />
              </VRadioGroup>
            </VCol>
          </VRow>
        </VCardText>
      </VCard>

      <VCard variant="flat" class="mb-4 testTed">
        <VCardItem>
          <VCardTitle>Individual</VCardTitle>
        </VCardItem>
        <VCardText>
          <EditableChipList
            label="Category"
            :items="indCategories"
            :loading="isSavingIndCategories"
            :placeholder="indCategoryPlaceholder"
            @save="saveIndCategories"
            @warn="notifyWarn"
            @error="notifyError"
          />

          <VRow>
            <VCol cols="12" md="4">
              <label class="text-subtitle-2 mb-2 d-block">
                Inactive After (Months)
              </label>
              <VTextField
                v-model.number="indInactiveAfterMonths"
                type="number"
                min="0"
                hide-details
                density="compact"
                :loading="isSavingIndFlags"
                :disabled="isSavingIndFlags"
                @keydown="
                  (e: KeyboardEvent) => {
                    if (e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+') e.preventDefault();
                  }
                "
                @input="onIndInactiveInput"
              />
            </VCol>
            <VCol cols="6" md="4">
              <VRadioGroup
                label="Require Phone?"
                v-model="indRequirePhone"
                inline
                :disabled="isSavingIndFlags"
                class="mb-0"
                @change="() => void saveIndFlags()"
              >
                <VRadio :value="true" label="Yes" />
                <VRadio :value="false" label="No" />
              </VRadioGroup>
            </VCol>
            <VCol cols="6" md="4">
              <VRadioGroup
                label="Require Email?"
                v-model="indRequireEmail"
                inline
                :disabled="isSavingIndFlags"
                class="mb-0"
                @change="() => void saveIndFlags()"
              >
                <VRadio :value="true" label="Yes" />
                <VRadio :value="false" label="No" />
              </VRadioGroup>
            </VCol>
          </VRow>
        </VCardText>
      </VCard>

      <VCard variant="flat" class="mb-4 testTed">
        <VCardItem>
          <VCardTitle>Default Contact Type</VCardTitle>
        </VCardItem>
        <VCardText>
          <VSelect
            v-model="defaultContactType"
            :items="['Organization', 'Individual', 'Ask Everytime']"
            hide-details
            density="compact"
            :loading="isSavingDefaultContactType"
            :disabled="isSavingDefaultContactType"
            @update:model-value="() => saveDefaultContactType()"
          />
        </VCardText>
      </VCard>

      <VCard variant="flat" class="mb-4 testTed">
        <VCardItem>
          <VCardTitle>Channels</VCardTitle>
        </VCardItem>
        <VCardText>
          <EditableChipList
            label="Channel"
            :items="channels"
            :loading="isSavingChannels"
            placeholder="Add channels"
            @save="saveChannels"
            @warn="notifyWarn"
            @error="notifyError"
          />
        </VCardText>
      </VCard>

      <VCard variant="flat" class="testTed">
        <VCardItem>
          <VCardTitle>Documents</VCardTitle>
        </VCardItem>
        <VCardText>
          <EditableChipList
            label="Document type"
            :items="docTypes"
            :loading="isSavingDocuments"
            placeholder="Add document types"
            @save="saveDocTypes"
            @warn="notifyWarn"
            @error="notifyError"
          />

          <EditableChipList
            label="Document category"
            :items="docCategories"
            :loading="isSavingDocuments"
            placeholder="Add document categories"
            @save="saveDocCategories"
            @warn="notifyWarn"
            @error="notifyError"
          />

          <div>
            <label class="text-subtitle-2 mb-2 d-block">Document Renewable?</label>
            <VRadioGroup
              v-model="documentRenewable"
              inline
              class="mb-0"
              @change="() => saveDocuments()"
            >
              <VRadio :value="true" label="Yes" />
              <VRadio :value="false" label="No" />
            </VRadioGroup>
          </div>
        </VCardText>
      </VCard>
    </VCardText>
  </VCard>

  <VCard class="mb-6" title="Activities & Jobs">
    <VCardText>
      <div class="mb-4">
        <h6 class="text-subtitle-1 mb-2">Call Purposes</h6>
        <EditableChipList
          label="Call purpose"
          :items="callPurposes"
          :loading="isSavingCallPurposes"
          placeholder="Add call purposes"
          @save="saveCallPurposes"
          @warn="notifyWarn"
          @error="notifyError"
        />
      </div>

      <div class="mb-4">
        <h6 class="text-subtitle-1 mb-2">Sentiments</h6>
        <EditableChipList
          label="Sentiment"
          :items="sentiments"
          :loading="isSavingSentiments"
          placeholder="Add sentiments"
          @save="saveSentiments"
          @warn="notifyWarn"
          @error="notifyError"
        />
      </div>

      <div class="mb-4">
        <h6 class="text-subtitle-1 mb-2">Notes</h6>
        <EditableChipList
          label="Note"
          :items="notes"
          :loading="isSavingNotes"
          placeholder="Add notes"
          @save="saveNotes"
          @warn="notifyWarn"
          @error="notifyError"
        />
      </div>

      <div>
        <h6 class="text-subtitle-1 mb-2">Meetings</h6>
        <EditableChipList
          label="Meeting"
          :items="meetings"
          :loading="isSavingMeetings"
          placeholder="Add meetings"
          @save="saveMeetings"
          @warn="notifyWarn"
          @error="notifyError"
        />
      </div>
    </VCardText>
  </VCard>
</template>

<style scoped>
.testTed {
  /* stylelint-disable-next-line @stylistic/indentation */
  background-color: rgba(var(--v-theme-background), 0.25);
}
</style>
