<script setup lang="ts">
import { defineEmits, defineProps, nextTick, ref, watch } from "vue";
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
  }
);

watch(drawerOpen, (v) => {
  // propagate local changes (including scrim close) to parent
  emit("update:isDrawerOpen", v);
});

// category-first flow
const category = ref<string | null>(null);
const categories = ["Event Management", "Sales", "Legal", "Support", "General"];

// generic fields (fallback)
const type = ref<string>("note");
const title = ref<string>("");
const body = ref<string>("");
const authorId = ref<number | string | null>(null);
const createdAt = ref<string>(new Date().toISOString());

// Event Management specific fields
const eventType = ref<string | null>(null);
const eventTypes = ["Conference", "Meeting", "Workshop", "Webinar"];
const eventDate = ref<string | null>(null);
const eventGuests = ref<number | null>(null);
const eventCity = ref<string | null>(null);
const cityOptions = ["Beirut", "Dubai", "London", "Doha"];
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
  // keep local ref in sync when v-navigation-drawer emits update:model-value
  drawerOpen.value = val;
  if (!val) nextTick(() => resetForm());
  if (val && props.initial) {
    // simple hydrate
    category.value = props.initial.category || category.value;
    type.value = props.initial.type || type.value;
    title.value = props.initial.title || title.value;
    body.value = props.initial.body || body.value;
    authorId.value = props.initial.authorId ?? authorId.value;
    createdAt.value = props.initial.createdAt || createdAt.value;

    // event hydrate
    eventType.value = props.initial.eventType ?? eventType.value;
    eventDate.value = props.initial.eventDate ?? eventDate.value;
    eventGuests.value = props.initial.eventGuests ?? eventGuests.value;
    eventCity.value = props.initial.eventCity ?? eventCity.value;
    brief.value = props.initial.brief || brief.value;
    recordId.value = props.initial.id ?? recordId.value;
  }
}

async function onSubmit() {
  const { valid } = await (refForm.value?.validate() ??
    Promise.resolve({ valid: true }));
  if (!valid) return;

  emit("save", {
    id: recordId.value ?? Date.now(),
    category: category.value ?? "General",
    // if Event Management selected, include structured payload
    ...(category.value === "Event Management"
      ? {
          meta: {
            eventType: eventType.value,
            date: eventDate.value,
            guests: eventGuests.value,
            city: eventCity.value,
            brief: brief.value.trim(),
          },
        }
      : {
          type: type.value,
          title: title.value.trim(),
          body: body.value.trim(),
        }),
    authorId: authorId.value,
    createdAt: createdAt.value,
  });

  emit("update:isDrawerOpen", false);
  nextTick(() => resetForm());
}

// expose openWith helper like other drawers
function openWith(initial?: any) {
  if (initial) {
    type.value = initial.type || type.value;
    title.value = initial.title || title.value;
    body.value = initial.body || body.value;
    authorId.value = initial.authorId ?? authorId.value;
    createdAt.value = initial.createdAt || createdAt.value;
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
    <AppDrawerHeaderSection title="Add Record" @cancel="closeDrawer" />

    <VDivider />

    <PerfectScrollbar :options="{ wheelPropagation: false }">
      <VCard flat>
        <VCardText>
          <VForm ref="refForm" v-model="isFormValid" @submit.prevent="onSubmit">
            <VRow>
              <VCol cols="12">
                <VAutocomplete
                  v-model="category"
                  :items="categories"
                  label="Select category"
                  clearable
                  hide-no-data
                  solo
                />
              </VCol>

              <!-- only show the rest when a category is chosen -->
              <template v-if="category">
                <template v-if="category === 'Event Management'">
                  <VCol cols="12">
                    <VAutocomplete
                      v-model="eventType"
                      :items="eventTypes"
                      label="Event type"
                      clearable
                      solo
                    />
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
                    <VAutocomplete
                      v-model="eventCity"
                      :items="cityOptions"
                      label="City"
                      clearable
                      solo
                    />
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

                  <VCol cols="12">
                    <AppTextField v-model="createdAt" label="Created At" />
                  </VCol>
                </template>

                <VCol cols="12" class="d-flex justify-end" v-if="category">
                  <VBtn type="submit" class="me-3">Save</VBtn>
                  <VBtn variant="tonal" @click="closeDrawer">Cancel</VBtn>
                </VCol>
              </template>
            </VRow>
          </VForm>
        </VCardText>
      </VCard>
    </PerfectScrollbar>
  </VNavigationDrawer>
</template>
