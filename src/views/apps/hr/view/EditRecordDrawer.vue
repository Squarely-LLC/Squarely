<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { PerfectScrollbar } from "vue3-perfect-scrollbar";
import type { VForm } from "vuetify/components/VForm";

interface Props {
  isDrawerOpen: boolean;
  initial?: any;
}

interface Emit {
  (e: "update:isDrawerOpen", value: boolean): void;
  (e: "save", value: any): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emit>();

const refForm = ref<VForm>();
const isFormValid = ref(false);

// local drawer model to ensure scrim/outside-click closes drawer reliably
const drawerOpen = ref<boolean>(props.isDrawerOpen ?? false);

watch(
  () => props.isDrawerOpen,
  (v) => {
    drawerOpen.value = !!v;
    if (!v) nextTick(() => resetForm());
    // hydrate when parent opens the drawer so initial is applied reliably
    if (v && props.initial) {
      hydrateFrom(props.initial as any);
    }
  }
);

watch(drawerOpen, (v) => {
  // propagate local changes (including scrim close) to parent
  emit("update:isDrawerOpen", v);
});

// form fields - mirror AddRecordDrawer but no category selector
const category = ref<string | null>(null);
const type = ref<string>("note");
const title = ref<string>("");
const body = ref<string>("");
const authorId = ref<number | string | null>(null);
const createdAt = ref<string>(new Date().toISOString());

// Event Management specific fields
const eventType = ref<string | null>(null);
const eventDate = ref<string | null>(null);
const eventGuests = ref<number | null>(null);
const eventCity = ref<string | null>(null);
const brief = ref<string>("");
const recordId = ref<number | string | null>(null);

function resetForm() {
  category.value = null;
  type.value = "note";
  title.value = "";
  body.value = "";
  authorId.value = null;
  createdAt.value = new Date().toISOString();

  eventType.value = null;
  eventDate.value = null;
  eventGuests.value = null;
  eventCity.value = null;
  brief.value = "";
  recordId.value = null;
  refForm.value?.reset();
  refForm.value?.resetValidation();
}

function closeDrawer() {
  emit("update:isDrawerOpen", false);
  nextTick(() => resetForm());
}

function handleModelUpdate(val: boolean) {
  drawerOpen.value = val;
  if (!val) nextTick(() => resetForm());
  if (val && props.initial) {
    hydrateFrom(props.initial as any);
  }
}

function hydrateFrom(r: any) {
  if (!r) return;
  category.value = r.category ?? null;
  type.value = r.type ?? type.value;
  title.value = r.title ?? title.value;
  body.value = r.body ?? body.value;
  authorId.value = r.author ?? authorId.value;
  createdAt.value = r.createdAt ?? createdAt.value;
  // event-specific
  eventType.value = r.meta?.eventType ?? r.eventType ?? eventType.value;
  eventDate.value = r.meta?.date ?? r.eventDate ?? eventDate.value;
  eventGuests.value = r.meta?.guests ?? r.eventGuests ?? eventGuests.value;
  eventCity.value = r.meta?.city ?? r.eventCity ?? eventCity.value;
  brief.value = r.meta?.brief ?? r.brief ?? brief.value;
  recordId.value = r.id ?? recordId.value;
}

async function onSubmit() {
  const { valid } = await (refForm.value?.validate() ??
    Promise.resolve({ valid: true }));
  if (!valid) return;

  // build payload according to category/event
  const payload: any = {
    id: recordId.value ?? Date.now(),
    author: authorId.value,
    createdAt: createdAt.value,
  };

  const safeTrim = (val: unknown) =>
    typeof val === "string" ? val.trim() : val == null ? "" : String(val).trim();

  if (category.value === "Event Management") {
    payload.category = "Event Management";
    payload.meta = {
      eventType: eventType.value,
      date: eventDate.value,
      guests: eventGuests.value,
      city: eventCity.value,
      brief: safeTrim(brief.value),
    };
  } else {
    payload.type = type.value;
    payload.title = safeTrim(title.value);
    payload.body = safeTrim(body.value);
  }

  emit("save", payload);
  emit("update:isDrawerOpen", false);
  nextTick(() => resetForm());
}

// expose openWith helper
function openWith(initial?: any) {
  if (initial) {
    const r = initial as any;
    category.value = r.category ?? null;
    type.value = r.type ?? type.value;
    title.value = r.title ?? title.value;
    body.value = r.body ?? body.value;
    authorId.value = r.author ?? authorId.value;
    createdAt.value = r.createdAt ?? createdAt.value;
    eventType.value = r.meta?.eventType ?? eventType.value;
    eventDate.value = r.meta?.date ?? eventDate.value;
    eventGuests.value = r.meta?.guests ?? eventGuests.value;
    eventCity.value = r.meta?.city ?? eventCity.value;
    brief.value = r.meta?.brief ?? brief.value;
    recordId.value = r.id ?? recordId.value;
  }
  emit("update:isDrawerOpen", true);
}

defineExpose({ openWith });
</script>

<template>
  <VNavigationDrawer
    data-allow-mismatch
    temporary
    :width="400"
    location="end"
    class="scrollable-content"
    v-model="drawerOpen"
    @update:model-value="handleModelUpdate"
  >
    <AppDrawerHeaderSection title="Edit Record" @cancel="closeDrawer" />

    <VDivider />

    <PerfectScrollbar :options="{ wheelPropagation: false }">
      <VCard flat>
        <VCardText>
          <VForm ref="refForm" v-model="isFormValid" @submit.prevent="onSubmit">
            <VRow>
              <!-- If the record is Event Management show event fields -->
              <template v-if="category === 'Event Management'">
                <VCol cols="12">
                  <AppTextField v-model="eventType" label="Event Type" />
                </VCol>

                <VCol cols="12">
                  <AppTextField v-model="eventDate" label="Date" />
                </VCol>

                <VCol cols="12">
                  <AppTextField
                    v-model="eventGuests"
                    label="Number of guests"
                  />
                </VCol>

                <VCol cols="12">
                  <AppTextField v-model="eventCity" label="City" />
                </VCol>

                <VCol cols="12">
                  <AppTextarea v-model="brief" label="Brief" auto-grow />
                </VCol>
              </template>

              <template v-else>
                <VCol cols="12">
                  <AppSelect
                    v-model="type"
                    label="Type"
                    :items="[
                      { title: 'Note', value: 'note' },
                      { title: 'Call', value: 'call' },
                      { title: 'Email', value: 'email' },
                      { title: 'Document', value: 'document' },
                    ]"
                  />
                </VCol>

                <VCol cols="12">
                  <AppTextField v-model="title" label="Title" />
                </VCol>

                <VCol cols="12">
                  <AppTextarea v-model="body" label="Body" auto-grow />
                </VCol>
              </template>

              <VCol cols="12" class="d-flex justify-end">
                <VBtn type="submit" class="me-3">Save</VBtn>
                <VBtn variant="tonal" @click="closeDrawer">Cancel</VBtn>
              </VCol>
            </VRow>
          </VForm>
        </VCardText>
      </VCard>
    </PerfectScrollbar>
  </VNavigationDrawer>
</template>
