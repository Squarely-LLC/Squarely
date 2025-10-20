<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { PerfectScrollbar } from "vue3-perfect-scrollbar";
import type { VForm } from "vuetify/components/VForm";

export type ContactRef = {
  id: number | string;
  name: string;
  avatarUrl?: string | null;
};

export interface NewMeetingPayload {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  attendees: ContactRef[];
  location?: string;
  link?: string;
  notes?: string;
  color?: string;
  durationMins: number;
  meetingType: string;
  linkedTo: ContactRef[];
  attachmentFile?: File | null;
  // compatibility aliases for other consumers (todos store expects these)
  subject?: string;
  startAt?: string;
  duration?: number;
  type?: string;
  note?: string;
  attachments?: any[];
  requestedBy?: any;
}

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    initialStart?: string | Date;
    initialDurationMins?: number;
    contacts?: ContactRef[];
  }>(),
  {
    initialDurationMins: 60,
    contacts: () => [],
  }
);

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  (e: "cancel"): void;
  (e: "save", payload: NewMeetingPayload): void;
}>();

const refForm = ref<VForm>();
const isFormValid = ref(false);

const subject = ref("");
const startAt = ref<string>("");
const durationMins = ref(props.initialDurationMins);
const meetingType = ref("Sales");
const linkedSearch = ref("");
const selectedLinkedIds = ref<(number | string)[]>([]);
const locationPreset = ref("");
const locationDetails = ref("");
const notes = ref("");
const attachmentFile = ref<File | null>(null);

// pending initial payload applied when the drawer opens
const pendingInitial = ref<any | null>(null);

function applyInitial(initial?: any) {
  if (!initial) return;
  try {
    if (initial.title) subject.value = String(initial.title);
    if (initial.initialStart || initial.start)
      startAt.value = toDateTimeLocalString(
        initial.initialStart || initial.start
      );
    if (initial.durationMins) durationMins.value = Number(initial.durationMins);
    if (initial.meetingType) meetingType.value = String(initial.meetingType);
    if (initial.notes) notes.value = String(initial.notes);
    if (initial.location) {
      const loc = String(initial.location);
      if (loc.includes(" - ")) {
        const parts = loc.split(" - ");
        locationPreset.value = parts[0] || "";
        locationDetails.value = parts.slice(1).join(" - ") || "";
      } else {
        // put full value into details when no preset match
        locationDetails.value = loc;
      }
    }
    if (Array.isArray(initial.linkedTo)) {
      selectedLinkedIds.value = initial.linkedTo.map((l: any) => l.id);
    }
    if (initial.attachmentFile)
      attachmentFile.value = initial.attachmentFile as File;
  } catch (e) {
    // best-effort only
    console.error("applyInitial failed:", e);
  }
}

function openWith(initial?: any) {
  // store pending initial then open drawer — watcher will apply it
  pendingInitial.value = initial ?? null;
  emit("update:modelValue", true);
}

defineExpose({ openWith });

const meetingTypeItems = [
  { title: "Sales", value: "Sales" },
  { title: "Operation", value: "Operation" },
  { title: "Brief", value: "Brief" },
  { title: "Site Visit", value: "Site Visit" },
];

const presetLocations = ["Office", "Zoom", "Google Meet", "Client HQ", "Phone"];

const idToContact = computed(
  () => new Map(props.contacts.map((contact) => [contact.id, contact] as const))
);

const linkedContacts = computed<ContactRef[]>(
  () =>
    selectedLinkedIds.value
      .map((id) => idToContact.value.get(id))
      .filter(Boolean) as ContactRef[]
);

const required = (value: unknown) =>
  (value !== null &&
    value !== undefined &&
    value !== "" &&
    (!Array.isArray(value) || value.length > 0)) ||
  "Required";

const positiveInteger = (value: unknown) => {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
      ? Number(value)
      : Number.NaN;

  return Number.isFinite(numericValue) && numericValue > 0
    ? true
    : "Must be greater than 0";
};

const isValidStart = computed(() => {
  if (!startAt.value) return false;
  return !Number.isNaN(new Date(startAt.value).getTime());
});

watch(
  () => props.contacts,
  (contacts) => {
    const validIds = new Set(contacts.map((contact) => contact.id));
    selectedLinkedIds.value = selectedLinkedIds.value.filter((id) =>
      validIds.has(id)
    );
  },
  { deep: true }
);

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      initialiseForm();
      // if there is a pending initial payload, apply it after initialisation
      if (pendingInitial.value) {
        applyInitial(pendingInitial.value);
        pendingInitial.value = null;
      }
      nextTick(() => {
        refForm.value?.resetValidation();
      });
    } else {
      nextTick(() => resetForm());
    }
  },
  { immediate: true }
);

function initialiseForm() {
  subject.value = "";
  startAt.value = toDateTimeLocalString(props.initialStart);
  durationMins.value = props.initialDurationMins ?? 60;
  meetingType.value = "Sales";
  selectedLinkedIds.value = [];
  locationPreset.value = "";
  locationDetails.value = "";
  notes.value = "";
  attachmentFile.value = null;
  linkedSearch.value = "";
}

function resetForm() {
  refForm.value?.reset();
  refForm.value?.resetValidation();
  initialiseForm();
}

function handleDrawerModelValueUpdate(value: boolean) {
  emit("update:modelValue", value);
  if (!value) {
    nextTick(() => resetForm());
  }
}

function closeDrawer() {
  emit("update:modelValue", false);
  emit("cancel");
  nextTick(() => resetForm());
}

async function onSubmit() {
  const formResult = await refForm.value?.validate();
  if (!formResult?.valid || !isValidStart.value) return;

  const startDate = new Date(startAt.value);
  const endDate = new Date(
    startDate.getTime() + Number(durationMins.value) * 60_000
  );

  const location = buildLocation();

  const payload: NewMeetingPayload = {
    id: `${Date.now()}`,
    // primary fields used by this drawer
    title: subject.value.trim(),
    start: startDate.toISOString(),
    end: endDate.toISOString(),
    allDay: false,
    attendees: [],
    location: location || undefined,
    link: undefined,
    notes: notes.value.trim() || undefined,
    color: undefined,
    durationMins: Number(durationMins.value),
    meetingType: meetingType.value,
    linkedTo: linkedContacts.value,
    attachmentFile: attachmentFile.value,
    // compatibility fields expected by todos store and other consumers
    subject: subject.value.trim(),
    startAt: startDate.toISOString(),
    duration: Number(durationMins.value),
    type: meetingType.value,
    note: notes.value.trim() || undefined,
    attachments: attachmentFile.value ? [attachmentFile.value] : [],
    requestedBy: null,
  };

  emit("save", payload);
  emit("update:modelValue", false);
  nextTick(() => resetForm());
}

function buildLocation(): string {
  const preset = locationPreset.value.trim();
  const detail = locationDetails.value.trim();
  if (preset && detail) return `${preset} - ${detail}`;
  return preset || detail;
}

function toDateTimeLocalString(input?: string | Date) {
  const date = input ? new Date(input) : new Date();
  if (Number.isNaN(date.getTime())) return "";

  date.setSeconds(0, 0);
  const minutes = date.getMinutes();
  const roundedMinutes = Math.floor(minutes / 5) * 5;
  date.setMinutes(roundedMinutes);

  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
</script>

<template>
  <VNavigationDrawer
    data-allow-mismatch
    temporary
    location="end"
    :width="400"
    class="scrollable-content"
    :model-value="props.modelValue"
    @update:model-value="handleDrawerModelValueUpdate"
  >
    <AppDrawerHeaderSection title="New Meeting" @cancel="closeDrawer" />

    <VDivider />

    <PerfectScrollbar :options="{ wheelPropagation: false }">
      <VCard flat>
        <VCardText>
          <VForm ref="refForm" v-model="isFormValid" @submit.prevent="onSubmit">
            <VRow>
              <VCol cols="12">
                <AppTextField
                  v-model="subject"
                  :rules="[required]"
                  label="Subject"
                  placeholder="Enter meeting subject"
                />
              </VCol>

              <VCol cols="12">
                <AppDateTimePicker
                  v-model="startAt"
                  :rules="[required]"
                  label="Start"
                  placeholder="Select start date"
                  :config="{ enableTime: true, dateFormat: 'Y-m-d H:i' }"
                />
              </VCol>

              <VCol cols="6">
                <AppTextField
                  v-model="durationMins"
                  type="number"
                  :rules="[required, positiveInteger]"
                  min="1"
                  step="5"
                  label="Duration (minutes)"
                />
              </VCol>

              <VCol cols="6">
                <AppSelect
                  v-model="meetingType"
                  :rules="[required]"
                  label="Meeting type"
                  placeholder="Select meeting type"
                  :items="meetingTypeItems"
                />
              </VCol>

              <VCol cols="12">
                <AppAutocomplete
                  v-model="selectedLinkedIds"
                  v-model:search="linkedSearch"
                  :items="props.contacts"
                  item-title="name"
                  item-value="id"
                  label="Linked to"
                  multiple
                  chips
                  closable-chips
                  clearable
                  placeholder="Select contacts"
                  @update:model-value="linkedSearch = ''"
                >
                  <template #prepend-item />
                  <template #item="{ props: itemProps, item }">
                    <VListItem v-bind="itemProps">
                      <template #prepend>
                        <VAvatar size="28" color="primary">
                          <template v-if="item.raw.avatarUrl">
                            <VImg :src="item.raw.avatarUrl" />
                          </template>
                          <template v-else>
                            <span class="text-caption font-weight-bold">
                              {{
                                (item.raw.name?.match(/\b\w/g) || [])
                                  .slice(0, 2)
                                  .join("")
                                  .toUpperCase()
                              }}
                            </span>
                          </template>
                        </VAvatar>
                      </template>
                      <VListItemTitle>{{ item.raw.name }}</VListItemTitle>
                    </VListItem>
                  </template>
                  <template #selection="{ item, index }">
                    <VChip
                      v-if="index < 3"
                      size="small"
                      class="me-1 mb-1"
                      variant="elevated"
                    >
                      <VAvatar start size="20" color="primary">
                        <template v-if="item.raw.avatarUrl">
                          <VImg :src="item.raw.avatarUrl" />
                        </template>
                        <template v-else>
                          <span class="text-xxs font-weight-bold">
                            {{
                              (item.raw.name?.match(/\b\w/g) || [])
                                .slice(0, 2)
                                .join("")
                                .toUpperCase()
                            }}
                          </span>
                        </template>
                      </VAvatar>
                      {{ item.raw.name }}
                    </VChip>
                    <span v-else-if="index === 3" class="text-caption">
                      +{{ selectedLinkedIds.length - 3 }}
                    </span>
                  </template>
                </AppAutocomplete>
              </VCol>

              <VCol cols="12">
                <VRow>
                  <VCol cols="12" sm="4">
                    <AppSelect
                      v-model="locationPreset"
                      label="Location"
                      placeholder="Select"
                      :items="presetLocations"
                    />
                  </VCol>
                  <VCol cols="12" sm="8">
                    <AppTextField
                      v-model="locationDetails"
                      label="Location details"
                      placeholder="Room, link or address"
                    />
                  </VCol>
                </VRow>
              </VCol>

              <VCol cols="12">
                <AppTextarea
                  v-model="notes"
                  label="Notes"
                  placeholder="Add any notes"
                  auto-grow
                  rows="4"
                />
              </VCol>

              <VCol cols="12">
                <VFileInput
                  v-model="attachmentFile"
                  label="Attachment"
                  prepend-icon="tabler-paperclip"
                  hide-details="auto"
                />
              </VCol>

              <VCol cols="12">
                <VBtn type="submit" class="me-3">Save</VBtn>
                <VBtn
                  type="button"
                  variant="tonal"
                  color="error"
                  @click="closeDrawer"
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
