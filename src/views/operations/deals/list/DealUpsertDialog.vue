<script setup lang="ts">
import { computed, nextTick, ref, toRaw, watch } from 'vue'
import type { VForm } from 'vuetify/components/VForm'
import { requiredValidator } from '@/@core/utils/validators'
import DialogActionBar from '@/components/DialogActionBar.vue'
import type {
  DealCustomFieldDefinition,
  DealCustomFieldType,
} from '@/plugins/fake-api/handlers/config/types'
import type {
  DealFieldValue,
  DealProperties,
} from '@/plugins/fake-api/handlers/operations/deals/types'
import { useConfigStore } from '@/stores/config'
import { useContactsStore } from '@/stores/contacts'
import { useEmployeesStore } from '@/stores/employees'

interface Props {
  deal?: DealProperties | null
  error?: string | null
  isDialogVisible: boolean
  loading?: boolean
}

interface Emit {
  (e: 'submit', value: Partial<DealProperties>): void
  (e: 'update:isDialogVisible', value: boolean): void
}

const props = withDefaults(defineProps<Props>(), {
  deal: null,
  error: null,
  loading: false,
})

const emit = defineEmits<Emit>()

const refForm = ref<VForm>()
const isFormValid = ref(false)

const configStore = useConfigStore()
const contactsStore = useContactsStore()
const employeesStore = useEmployeesStore()

configStore.init()
contactsStore.init()
employeesStore.init()

const stageOptions = computed(() => configStore.configurations?.deals?.dealStages || [])
const typeOptions = computed(() => configStore.configurations?.deals?.salesType || [])

const defaultLocation = computed(() => {
  const city = String(configStore.configurations?.legal?.city ?? '').trim()
  const country = String(configStore.configurations?.legal?.country ?? '').trim()

  return [city, country].filter(Boolean).join(', ')
})

const customFieldDefinitions = computed<DealCustomFieldDefinition[]>(() => {
  const configured = configStore.configurations?.deals?.customFields
  if (Array.isArray(configured) && configured.length)
    return configured

  const labels = configStore.configurations?.deals?.fieldLabels || {}

  return Object.entries(labels).map(([key, label]) => ({
    key,
    label,
    type: 'text',
  }))
})

const contactOptions = computed(() =>
  contactsStore.all.map(contact => ({
    title: contact.fullName,
    value: contact.id,
    avatar: contact.picture || null,
  })),
)

const collaboratorOptions = computed(() =>
  employeesStore.all.map(employee => ({
    title: employee.fullName,
    value: employee.id,
    avatar: employee.picture || null,
  })),
)

const avatarText = (name?: string | null) => {
  const safe = (name || '').trim()
  if (!safe)
    return '??'

  return safe
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

const getDefaultFieldValue = (field: DealCustomFieldDefinition): DealFieldValue => {
  if (field.defaultValue !== undefined)
    return field.defaultValue

  if (field.type === 'boolean')
    return false

  if (field.type === 'number')
    return null

  return ''
}

const buildDefaultCustomFieldValues = (
  current?: Record<string, DealFieldValue> | null,
) => {
  const nextValues: Record<string, DealFieldValue> = {}

  customFieldDefinitions.value.forEach(field => {
    nextValues[field.key] = current?.[field.key] ?? getDefaultFieldValue(field)
  })

  return nextValues
}

const buildEmptyDeal = (): Partial<DealProperties> => ({
  name: '',
  code: null,
  relatedTo: null,
  type: typeOptions.value[0] || null,
  estimatedDeliveryDate: null,
  stage: stageOptions.value[0] || null,
  important: false,
  location: defaultLocation.value || null,
  collaborators: [],
  note: '',
  customFieldValues: buildDefaultCustomFieldValues(),
})

const sanitiseDeal = (deal: DealProperties | null): Partial<DealProperties> => {
  if (!deal)
    return buildEmptyDeal()

  const raw = toRaw(deal) as DealProperties

  return {
    ...raw,
    collaborators: Array.isArray(raw.collaborators) ? [...raw.collaborators] : [],
    location: raw.location || defaultLocation.value || null,
    customFieldValues: buildDefaultCustomFieldValues(raw.customFieldValues),
  }
}

const localDeal = ref<Partial<DealProperties>>(buildEmptyDeal())

watch(
  () => [props.isDialogVisible, props.deal, customFieldDefinitions.value] as const,
  ([visible]) => {
    if (!visible)
      return

    localDeal.value = sanitiseDeal(props.deal ?? null)

    nextTick(() => {
      refForm.value?.resetValidation()
    })
  },
  { deep: true },
)

const dialogTitle = computed(() => props.deal ? 'Edit Deal' : 'Add New Deal')

const dialogDescription = computed(() =>
  props.deal
    ? 'Update the deal information and save your changes.'
    : 'Capture the key information for a new deal record.',
)

const dialogModelValueUpdate = (value: boolean) => {
  emit('update:isDialogVisible', value)
}

const setCustomFieldValue = (key: string, value: DealFieldValue) => {
  localDeal.value = {
    ...localDeal.value,
    customFieldValues: {
      ...(localDeal.value.customFieldValues || {}),
      [key]: value,
    },
  }
}

const getCustomFieldValue = (key: string) =>
  localDeal.value.customFieldValues?.[key] ?? null

const customFieldCols = (type: DealCustomFieldType) =>
  type === 'textarea' ? 12 : 6

const onCancel = () => {
  localDeal.value = sanitiseDeal(props.deal ?? null)
  emit('update:isDialogVisible', false)
}

const onSubmit = async () => {
  const { valid } = (await refForm.value?.validate()) ?? { valid: true }
  if (!valid)
    return

  emit('submit', {
    ...localDeal.value,
    customFieldValues: buildDefaultCustomFieldValues(localDeal.value.customFieldValues),
  })
}
</script>

<template>
  <VDialog
    :width="$vuetify.display.smAndDown ? 'auto' : 760"
    :model-value="isDialogVisible"
    @update:model-value="dialogModelValueUpdate"
  >
    <DialogCloseBtn @click="dialogModelValueUpdate(false)" />

    <VCard class="pa-sm-8 pa-4">
      <VCardText>
        <h4 class="text-h5 text-center mb-2">
          {{ dialogTitle }}
        </h4>
        <p class="text-body-2 text-center mb-6">
          {{ dialogDescription }}
        </p>

        <VAlert
          v-if="error"
          type="error"
          variant="tonal"
          class="mb-4"
          density="comfortable"
        >
          {{ error }}
        </VAlert>

        <VForm
          ref="refForm"
          v-model="isFormValid"
          @submit.prevent="onSubmit"
        >
          <VRow>
            <VCol
              cols="12"
              md="6"
            >
              <AppSelect
                v-model="localDeal.relatedTo"
                label="Linked to"
                placeholder="Select Contact"
                :items="contactOptions"
                item-title="title"
                item-value="value"
                :rules="[requiredValidator]"
                clearable
                clear-icon="tabler-x"
              >
                <template #item="{ item, props: itemProps }">
                  <VListItem v-bind="itemProps">
                    <template #prepend>
                      <VAvatar
                        size="28"
                        :color="item.raw.avatar ? undefined : 'primary'"
                        :class="item.raw.avatar ? null : 'text-white font-weight-medium'"
                      >
                        <VImg
                          v-if="item.raw.avatar"
                          :src="item.raw.avatar"
                        />
                        <span
                          v-else
                          class="text-caption font-weight-bold"
                        >
                          {{ avatarText(item.raw.title) }}
                        </span>
                      </VAvatar>
                    </template>
                  </VListItem>
                </template>
              </AppSelect>
            </VCol>

            <VCol
              cols="12"
              md="6"
            >
              <AppSelect
                v-model="localDeal.type"
                label="Type"
                placeholder="Select Type"
                :items="typeOptions"
                :rules="[requiredValidator]"
              />
            </VCol>

            <VCol
              cols="12"
              md="6"
            >
              <AppDateTimePicker
                v-model="localDeal.estimatedDeliveryDate"
                label="Estimated Delivery Date"
                placeholder="YYYY-MM-DD"
                clearable
              />
            </VCol>

            <VCol
              cols="12"
              md="6"
            >
              <AppSelect
                v-model="localDeal.stage"
                label="Stage"
                placeholder="Select Stage"
                :items="stageOptions"
                :rules="[requiredValidator]"
              />
            </VCol>

            <VCol
              cols="12"
              md="6"
            >
              <AppTextField
                v-model="localDeal.location"
                label="Location"
                placeholder="City, Country"
              />
            </VCol>

            <VCol
              cols="12"
              md="6"
            >
              <div class="d-flex align-center justify-space-between rounded border px-4 py-3">
                <div class="text-body-1 font-weight-medium">
                  Important
                </div>

                <VBtn
                  :color="localDeal.important ? 'warning' : 'secondary'"
                  variant="text"
                  icon
                  @click="localDeal.important = !localDeal.important"
                >
                  <VIcon :icon="localDeal.important ? 'tabler-star-filled' : 'tabler-star'" />
                </VBtn>
              </div>
            </VCol>

            <VCol cols="12">
              <AppSelect
                v-model="localDeal.collaborators"
                label="Collaborators"
                placeholder="Select collaborators"
                :items="collaboratorOptions"
                item-title="title"
                item-value="value"
                multiple
                chips
                clearable
                clear-icon="tabler-x"
              >
                <template #selection="{ item, index }">
                  <VChip
                    v-if="index < 4"
                    class="me-1 mb-1"
                    size="small"
                    variant="elevated"
                  >
                    <VAvatar
                      size="20"
                      start
                      class="me-2"
                      :color="item.raw.avatar ? undefined : 'primary'"
                      :class="item.raw.avatar ? null : 'text-white font-weight-medium'"
                    >
                      <VImg
                        v-if="item.raw.avatar"
                        :src="item.raw.avatar"
                      />
                      <span
                        v-else
                        class="text-xxs font-weight-bold"
                      >
                        {{ avatarText(item.raw.title) }}
                      </span>
                    </VAvatar>
                    <span class="text-truncate">{{ item.raw.title }}</span>
                  </VChip>

                  <span
                    v-else-if="index === 4"
                    class="text-caption text-medium-emphasis"
                  >
                    +{{ (localDeal.collaborators?.length || 0) - index }}
                  </span>
                </template>
              </AppSelect>
            </VCol>

            <template
              v-for="field in customFieldDefinitions"
              :key="field.key"
            >
              <VCol
                cols="12"
                :md="customFieldCols(field.type)"
              >
                <AppTextField
                  v-if="field.type === 'text'"
                  :model-value="String(getCustomFieldValue(field.key) ?? '')"
                  :label="field.label"
                  @update:model-value="setCustomFieldValue(field.key, String($event ?? ''))"
                />

                <AppTextField
                  v-else-if="field.type === 'number'"
                  :model-value="getCustomFieldValue(field.key)"
                  :label="field.label"
                  type="number"
                  @update:model-value="setCustomFieldValue(field.key, $event === '' ? null : Number($event))"
                />

                <AppDateTimePicker
                  v-else-if="field.type === 'date'"
                  :model-value="String(getCustomFieldValue(field.key) ?? '')"
                  :label="field.label"
                  clearable
                  @update:model-value="setCustomFieldValue(field.key, $event ? String($event) : null)"
                />

                <AppSelect
                  v-else-if="field.type === 'select'"
                  :model-value="getCustomFieldValue(field.key)"
                  :label="field.label"
                  :items="field.options || []"
                  clearable
                  clear-icon="tabler-x"
                  @update:model-value="setCustomFieldValue(field.key, $event ? String($event) : null)"
                />

                <div
                  v-else-if="field.type === 'boolean'"
                  class="d-flex align-center justify-space-between rounded border pa-3"
                >
                  <div class="text-body-1 font-weight-medium">
                    {{ field.label }}
                  </div>

                  <VSwitch
                    :model-value="Boolean(getCustomFieldValue(field.key))"
                    inset
                    hide-details
                    density="compact"
                    class="ma-0"
                    @update:model-value="setCustomFieldValue(field.key, Boolean($event))"
                  />
                </div>

                <AppTextarea
                  v-else
                  :model-value="String(getCustomFieldValue(field.key) ?? '')"
                  :label="field.label"
                  auto-grow
                  rows="2"
                  @update:model-value="setCustomFieldValue(field.key, String($event ?? ''))"
                />
              </VCol>
            </template>

            <VCol cols="12">
              <AppTextarea
                v-model="localDeal.note"
                label="Notes"
                placeholder="Short note"
                auto-grow
                rows="1"
              />
            </VCol>

            <VCol
              cols="12"
              class="mt-4"
            >
              <DialogActionBar
                save-type="submit"
                :save-loading="loading"
                @save="() => undefined"
                @cancel="onCancel"
              />
            </VCol>
          </VRow>
        </VForm>
      </VCardText>
    </VCard>
  </VDialog>
</template>
