<script setup lang="ts">
import DialogActionBar from "@/components/DialogActionBar.vue";
import { useEmployeesStore } from "@/stores/employees";
import { useJobsStore } from "@/stores/jobs";
import { computed, nextTick, ref, watch } from "vue";
import { PerfectScrollbar } from "vue3-perfect-scrollbar";
import type { VForm } from "vuetify/components/VForm";

export type ContactRef = {
  id: number | string;
  name: string;
  email?: string;
  avatarUrl?: string | null;
  type?: "contact" | "employee" | "employee_contact";
  roles?: ("contact" | "employee")[];
  contactId?: number | string;
  employeeId?: number | string;
  // internal value used by the autocomplete to disambiguate same ids across sources
  value?: string;
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
  relatedTo?: { id: string | number; name: string; type: string } | null;
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
    // 'contacts' (default) or 'employees' - determines which data is being linked
    source?: "contacts" | "employees";
    lockRelatedTo?: boolean;
  }>(),
  {
    initialDurationMins: 60,
    contacts: () => [],
    source: "contacts",
    lockRelatedTo: false,
  }
);

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  (e: "cancel"): void;
  (e: "save", payload: NewMeetingPayload): void;
}>();

const jobsStore = useJobsStore();
jobsStore.init();

const employeesStore = useEmployeesStore();
employeesStore.init();

const refForm = ref<VForm>();
const isFormValid = ref(false);

const subject = ref("");
const startAt = ref<string>("");
const durationMins = ref(props.initialDurationMins);
const meetingType = ref("Sales");
const linkedSearch = ref("");
const selectedLinkedIds = ref<string[]>([]);
const locationPreset = ref("");
const locationDetails = ref("");
const notes = ref("");
const attachmentFile = ref<File | null>(null);
const selectedRelatedKey = ref<string | null>(null);

// build stable keys so contact/employee ids don't collide
const contactKey = (id: string | number) => `contact-${id}`;
const employeeKey = (id: string | number) => `employee-${id}`;
const combinedKey = (
  contactId?: string | number,
  employeeId?: string | number,
  name?: string
) =>
  `both-${contactId ?? "none"}-${employeeId ?? "none"}-${(
    name || ""
  ).toString()}`
    .toLowerCase()
    .trim();

// Options for the Related to dropdown (jobs only)
const relatedOptions = computed(() =>
  jobsStore.all.map((job) => ({
    title: job.name,
    value: `job-${job.id}`,
    type: "job" as const,
    rawId: job.id,
  }))
);

// Normalized options for the Linked to dropdown (contacts + employees + both)
const linkedItems = computed<ContactRef[]>(() => {
  const contacts = props.contacts.map((contact) => ({
    ...contact,
    contactId: contact.id,
    group: "Contacts",
    type: "contact" as const,
    roles: ["contact"] as const,
    value: contactKey(contact.id),
  }));

  const employees = employeesStore.all.map((employee) => ({
    id: employee.id,
    employeeId: employee.id,
    name: employee.fullName,
    avatarUrl: employee.picture || null,
    group: "Employees",
    type: "employee" as const,
    roles: ["employee"] as const,
    value: employeeKey(employee.id),
  }));

  const nameKey = (name?: string | null) =>
    (name || "").toString().trim().toLowerCase();

  const merged: ContactRef[] = [];
  const usedContacts = new Set<string | number>();
  const usedEmployees = new Set<string | number>();

  const contactMap = new Map<string, ContactRef>();
  contacts.forEach((c) => {
    contactMap.set(nameKey(c.name) || String(c.contactId), c);
  });

  employees.forEach((e) => {
    const key = nameKey(e.name) || String(e.employeeId);
    const matchingContact = contactMap.get(key);
    if (matchingContact) {
      merged.push({
        id: matchingContact.contactId ?? e.employeeId,
        contactId: matchingContact.contactId,
        employeeId: e.employeeId,
        name: matchingContact.name || e.name,
        avatarUrl: matchingContact.avatarUrl || e.avatarUrl || null,
        type: "employee_contact",
        roles: ["contact", "employee"],
        group: "Employees & Contacts",
        value: combinedKey(matchingContact.contactId, e.employeeId, e.name),
      });
      usedContacts.add(matchingContact.contactId!);
      usedEmployees.add(e.employeeId!);
    }
  });

  merged.push(
    ...contacts.filter((c) => !usedContacts.has(c.contactId!)),
    ...employees.filter((e) => !usedEmployees.has(e.employeeId!))
  );

  return [...merged].sort((a, b) =>
    (a.name || "").toString().localeCompare((b.name || "").toString(), undefined, {
      sensitivity: "base",
    })
  );
});

// Categorised items for the Linked to dropdown (contacts + employees + both)
const groupedLinkedItems = computed(() => linkedItems.value);

// Helper: find matching linked item by supplied hints
function matchLinkedItem(criteria: {
  type?: ContactRef["type"];
  roles?: ("contact" | "employee")[];
  contactId?: string | number;
  employeeId?: string | number;
  id?: string | number;
  name?: string;
}) {
  const normalizedName = (criteria.name || "").toString().trim().toLowerCase();
  return linkedItems.value.find((item) => {
    if (criteria.type && item.type !== criteria.type) return false;
    if (
      criteria.roles &&
      !criteria.roles.every((r) => (item.roles || []).includes(r))
    )
      return false;
    if (
      criteria.contactId !== undefined &&
      String(item.contactId) !== String(criteria.contactId)
    )
      return false;
    if (
      criteria.employeeId !== undefined &&
      String(item.employeeId) !== String(criteria.employeeId)
    )
      return false;
    if (
      criteria.id !== undefined &&
      ![
        String(item.id),
        String(item.contactId ?? ""),
        String(item.employeeId ?? ""),
      ].includes(String(criteria.id))
    )
      return false;
    if (
      normalizedName &&
      item.name?.toString().trim().toLowerCase() !== normalizedName
    )
      return false;
    return true;
  });
}

function resolveLinkedValue(link: any): string | null {
  const id = link?.id ?? link;
  const type = link?.type as ContactRef["type"] | undefined;
  const roles = Array.isArray(link?.roles) ? (link.roles as any[]) : [];
  const name = link?.name;
  const contactId =
    link?.contactId ?? (type === "contact" ? id : undefined) ?? undefined;
  const employeeId =
    link?.employeeId ?? (type === "employee" ? id : undefined) ?? undefined;

  const bothRoles =
    roles.includes("contact") && roles.includes("employee")
      ? ["contact", "employee"]
      : undefined;

  const tryMatch = (criteria: Parameters<typeof matchLinkedItem>[0]) =>
    matchLinkedItem(criteria)?.value ?? null;

  if (type === "employee_contact" || bothRoles) {
    const val = tryMatch({
      type: "employee_contact",
      contactId,
      employeeId,
      id,
      name,
    });
    if (val) return val;
  }

  if (type === "contact" || roles.includes("contact")) {
    const val = tryMatch({
      type: "contact",
      contactId: contactId ?? id,
      id,
      name,
    });
    if (val) return val;
  }

  if (type === "employee" || roles.includes("employee")) {
    const val = tryMatch({
      type: "employee",
      employeeId: employeeId ?? id,
      id,
      name,
    });
    if (val) return val;
  }

  // fallbacks: try any combined, then contact, then employee by id/name
  const combinedVal = tryMatch({
    type: "employee_contact",
    contactId,
    employeeId,
    id,
    name,
  });
  if (combinedVal) return combinedVal;

  const contactVal = tryMatch({ type: "contact", contactId: id, id, name });
  if (contactVal) return contactVal;
  const employeeVal = tryMatch({
    type: "employee",
    employeeId: id,
    id,
    name,
  });
  if (employeeVal) return employeeVal;

  return null;
}

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
      selectedLinkedIds.value = initial.linkedTo
        .map((l: any) => resolveLinkedValue(l))
        .filter((v): v is string => !!v);
    }
    if (initial.relatedTo && initial.relatedTo.type === "job") {
      selectedRelatedKey.value = `job-${initial.relatedTo.id}`;
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

const idToContact = computed(() => {
  const map = new Map<string | number, ContactRef>();
  const addEntry = (key: string | number, value: ContactRef) => {
    if (!map.has(key)) map.set(key, value);
  };

  linkedItems.value.forEach((item) => {
    const entry = { ...item };
    if (entry.value) addEntry(entry.value, entry);
    if (entry.contactId !== undefined)
      addEntry(contactKey(entry.contactId), entry);
    if (entry.employeeId !== undefined)
      addEntry(employeeKey(entry.employeeId), entry);
    addEntry(String(entry.id), entry);
  });

  return map;
});

const linkedContacts = computed<ContactRef[]>(() => {
  const seen = new Set<string>();
  return selectedLinkedIds.value
    .map((id) => idToContact.value.get(id))
    .filter(Boolean)
    .filter((contact) => {
      const seenKey =
        contact?.value || `${contact?.type || "contact"}-${contact?.id}`;
      if (!contact || !seenKey) return false;
      if (seen.has(seenKey)) return false;
      seen.add(seenKey);
      return true;
    }) as ContactRef[];
});

// Data shape to persist (strip UI-only value key)
const linkedContactsPayload = computed<ContactRef[]>(() =>
  linkedContacts.value.map((entry) => {
    const { value, roles, type, contactId, employeeId, ...rest } = entry;
    const normalizedRoles =
      roles && roles.length
        ? roles
        : type === "employee_contact"
        ? (["contact", "employee"] as ("contact" | "employee")[])
        : type === "employee"
        ? (["employee"] as ("contact" | "employee")[])
        : (["contact"] as ("contact" | "employee")[]);

    const normalizedId =
      type === "employee"
        ? employeeId ?? rest.id
        : type === "contact"
        ? contactId ?? rest.id
        : contactId ?? employeeId ?? rest.id;

    return {
      ...rest,
      id: normalizedId,
      type,
      contactId: contactId ?? (type !== "employee" ? normalizedId : undefined),
      employeeId: employeeId ?? (type !== "contact" ? normalizedId : undefined),
      roles: normalizedRoles,
    };
  })
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
  [() => props.contacts, () => employeesStore.all],
  () => {
    const validKeys = new Set(
      linkedItems.value
        .map((item) => item.value)
        .filter((v): v is string => !!v)
    );

    const normalized = selectedLinkedIds.value
      .map((id) => {
        if (typeof id === "string" && validKeys.has(id)) return id;
        return resolveLinkedValue({ id });
      })
      .filter((v): v is string => !!v && validKeys.has(v));

    selectedLinkedIds.value = Array.from(new Set(normalized));
  },
  { deep: true }
);

watch(
  () => relatedOptions.value,
  (opts) => {
    if (
      selectedRelatedKey.value &&
      !opts.some((opt) => opt.value === selectedRelatedKey.value)
    ) {
      selectedRelatedKey.value = null;
    }
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
  selectedRelatedKey.value = null;
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

  const relatedOption = relatedOptions.value.find(
    (opt) => opt.value === selectedRelatedKey.value
  );

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
    linkedTo: linkedContactsPayload.value,
    attachmentFile: attachmentFile.value,
    relatedTo: relatedOption
      ? {
          id: relatedOption.rawId,
          name: relatedOption.title,
          type: relatedOption.type,
        }
      : null,
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
                  :items="groupedLinkedItems"
                  item-title="name"
                  item-value="value"
                  group-by="group"
                  label="Linked to"
                  multiple
                  chips
                  closable-chips
                  clearable
                  placeholder="Select contacts or employees"
                  @update:model-value="linkedSearch = ''"
                >
                  <template #prepend-item />
                  <template #group="{ props: groupProps, item }">
                    <VListSubheader
                      v-bind="groupProps"
                      class="text-uppercase text-caption text-medium-emphasis"
                    >
                      {{ item.title }}
                    </VListSubheader>
                  </template>
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

                      <VListItemSubtitle class="text-capitalize">
                        {{
                          (item.raw.roles && item.raw.roles.length
                            ? item.raw.roles
                            : [
                                item.raw.type === "employee_contact"
                                  ? "contact"
                                  : item.raw.type || "contact",
                              ]
                          )
                            .map((r: string) =>
                              r === "employee_contact"
                                ? "Employee & Contact"
                                : r === "employee"
                                ? "Employee"
                                : "Contact"
                            )
                            .join(" & ")
                        }}
                      </VListItemSubtitle>
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

              <!-- Related to job selection -->
              <VCol cols="12">
                <AppSelect
                  v-model="selectedRelatedKey"
                  label="Related to"
                  placeholder="Select a job"
                  item-title="title"
                  item-value="value"
                  :items="relatedOptions"
                  clearable
                  :disabled="props.lockRelatedTo"
                >
                  <template #prepend-inner>
                    <VIcon icon="tabler-briefcase" size="20" class="me-2" />
                  </template>
                </AppSelect>
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
                <DialogActionBar
                  save-type="submit"
                  @save="() => undefined"
                  @cancel="closeDrawer"
                />
              </VCol>
            </VRow>
          </VForm>
        </VCardText>
      </VCard>
    </PerfectScrollbar>
  </VNavigationDrawer>
</template>
