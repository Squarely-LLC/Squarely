<script setup lang="ts">
import { computed, ref, toRaw, watch } from 'vue'

import type { DealCustomFieldDefinition } from '@/plugins/fake-api/handlers/config/types'
import type { DealProperties } from '@/plugins/fake-api/handlers/operations/deals/types'
import { useConfigStore } from '@/stores/config'
import { useContactsStore } from '@/stores/contacts'
import { useDealsStore } from '@/stores/deals'
import { useNotificationsStore } from '@/stores/notifications'
import DealUpsertDialog from '@/views/operations/deals/list/DealUpsertDialog.vue'

type SortKey = 'name' | 'createdAt' | 'estimatedDeliveryDate' | 'stage' | 'type'
type SortOrder = 'asc' | 'desc'

const dealsStore = useDealsStore()
const contactsStore = useContactsStore()
const configStore = useConfigStore()
const notifications = useNotificationsStore()

dealsStore.init()
contactsStore.init()
configStore.init()

const searchQuery = ref('')
const selectedStage = ref<string | undefined>()
const selectedType = ref<string | undefined>()
const selectedImportance = ref<string | undefined>()

const sortOptions: {
  title: string
  value: { key: SortKey; order: SortOrder }
}[] = [
  { title: 'Name (A-Z)', value: { key: 'name', order: 'asc' } },
  { title: 'Name (Z-A)', value: { key: 'name', order: 'desc' } },
  { title: 'Recently Added', value: { key: 'createdAt', order: 'desc' } },
  {
    title: 'Delivery Date (Soonest)',
    value: { key: 'estimatedDeliveryDate', order: 'asc' },
  },
]

const selectedSort = ref(sortOptions[2].value)
const itemsPerPage = ref(15)
const page = ref(1)
const sortBy = ref<SortKey | undefined>(selectedSort.value.key)
const orderBy = ref<SortOrder | undefined>(selectedSort.value.order)
const selectedRows = ref<number[]>([])

const headers = [
  { title: 'Deal', key: 'deal' },
  { title: 'Contact', key: 'contact' },
  { title: 'Stage', key: 'stage' },
  { title: 'Type', key: 'type' },
  { title: 'Delivery', key: 'delivery' },
  { title: 'Collaborators', key: 'collaborators', sortable: false },
  { title: 'Actions', key: 'actions', sortable: false },
]

const stageOptions = computed(() =>
  (configStore.configurations?.deals?.dealStages || []).map(stage => ({
    title: stage,
    value: stage,
  })),
)

const typeOptions = computed(() =>
  (configStore.configurations?.deals?.salesType || []).map(type => ({
    title: type,
    value: type,
  })),
)

const importanceOptions = [
  { title: 'Important', value: 'important' },
  { title: 'Not Important', value: 'normal' },
]

const customFieldDefinitions = computed<DealCustomFieldDefinition[]>(() => {
  const configured = configStore.configurations?.deals?.customFields
  if (Array.isArray(configured) && configured.length)
    return configured

  const labels = configStore.configurations?.deals?.fieldLabels || {}

  return Object.entries(labels).map(([key, label]) => ({ key, label, type: 'text' }))
})

watch(selectedSort, value => {
  sortBy.value = value?.key
  orderBy.value = value?.order
  page.value = 1
})

watch([selectedStage, selectedType, selectedImportance, searchQuery], () => {
  page.value = 1
})

const cloneDeal = (deal: DealProperties) => {
  const raw = toRaw(deal) as DealProperties

  try {
    return JSON.parse(JSON.stringify(raw)) as DealProperties
  }
  catch (error) {
    return {
      ...raw,
      collaborators: Array.isArray(raw.collaborators) ? [...raw.collaborators] : [],
      customFieldValues: { ...(raw.customFieldValues || {}) },
    }
  }
}

const avatarText = (name?: string | null) => {
  const safe = (name ?? '').trim()
  if (!safe)
    return '??'

  return safe
    .split(/\s+/)
    .filter(Boolean)
    .map(word => word[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

const contactDirectory = computed(() => {
  const map = new Map<number, { name: string; picture: string | null }>()

  contactsStore.all.forEach(contact => {
    if (contact?.id === null || contact?.id === undefined)
      return

    map.set(Number(contact.id), {
      name: contact.fullName,
      picture: contact.picture || null,
    })
  })

  return map
})

const getContactEntry = (id: number | string | null | undefined) => {
  if (id === null || id === undefined)
    return null

  const numericId = Number(id)
  if (!Number.isFinite(numericId))
    return null

  return contactDirectory.value.get(numericId) ?? null
}

const relatedContactName = (deal: DealProperties) =>
  getContactEntry(deal.relatedTo)?.name ?? '--'

const normalizedSearch = computed(() => searchQuery.value.trim().toLowerCase())

const matchesFilters = (deal: DealProperties) => {
  const query = normalizedSearch.value
  if (query) {
    const customFieldValues = customFieldDefinitions.value
      .map(field => deal.customFieldValues?.[field.key])
      .filter(value => value !== null && value !== undefined)
      .map(value => String(value).toLowerCase())

    const haystack = [
      deal.name,
      deal.code,
      deal.location,
      relatedContactName(deal),
      ...customFieldValues,
    ]
      .filter(Boolean)
      .map(value => String(value).toLowerCase())

    if (!haystack.some(value => value.includes(query)))
      return false
  }

  if (selectedStage.value && deal.stage !== selectedStage.value)
    return false

  if (selectedType.value && deal.type !== selectedType.value)
    return false

  if (selectedImportance.value)
    return selectedImportance.value === 'important' ? deal.important : !deal.important

  return true
}

const normalizeSortValue = (deal: DealProperties, key?: SortKey) => {
  if (key === 'name')
    return deal.name?.toLowerCase() ?? ''

  if (key === 'stage')
    return deal.stage ?? ''

  if (key === 'type')
    return deal.type ?? ''

  if (key === 'estimatedDeliveryDate')
    return deal.estimatedDeliveryDate ?? ''

  return deal.createdAt ?? ''
}

const compareDeals = (a: DealProperties, b: DealProperties) => {
  const key = sortBy.value ?? 'createdAt'
  const order = orderBy.value ?? 'desc'

  const aValue = normalizeSortValue(a, key)
  const bValue = normalizeSortValue(b, key)

  if (key === 'createdAt' || key === 'estimatedDeliveryDate') {
    const aDate = aValue ? new Date(aValue).getTime() : 0
    const bDate = bValue ? new Date(bValue).getTime() : 0

    return order === 'asc' ? aDate - bDate : bDate - aDate
  }

  const diff = String(aValue).localeCompare(String(bValue))

  return order === 'asc' ? diff : -diff
}

const filteredDeals = computed<DealProperties[]>(() =>
  dealsStore.all
    .map(deal => cloneDeal(deal))
    .filter(deal => matchesFilters(deal)),
)

const sortedDeals = computed<DealProperties[]>(() => {
  const items = [...filteredDeals.value]
  if (items.length > 1)
    items.sort(compareDeals)

  return items
})

const displayedDeals = computed<DealProperties[]>(() => {
  const results = sortedDeals.value
  const start = (page.value - 1) * itemsPerPage.value
  const end = itemsPerPage.value === -1 ? results.length : start + itemsPerPage.value

  return results.slice(start, end)
})

const totalDeals = computed(() => sortedDeals.value.length)

const decoratedCollaborators = (deal: DealProperties) =>
  (deal.collaborators || [])
    .map(id => getContactEntry(id))
    .filter(Boolean) as Array<{ name: string; picture: string | null }>

const formatDate = (value?: string | null) => {
  if (!value)
    return '--'

  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(value))
  }
  catch (error) {
    return value
  }
}

const resolveCustomFieldPreview = (deal: DealProperties) => {
  const previews = customFieldDefinitions.value
    .slice(0, 2)
    .map(field => {
      const value = deal.customFieldValues?.[field.key]
      if (value === null || value === undefined || value === '')
        return null

      return `${field.label}: ${String(value)}`
    })
    .filter(Boolean)

  return previews.join(' - ')
}

const isDealDialogVisible = ref(false)
const selectedDeal = ref<DealProperties | null>(null)
const dialogLoading = ref(false)
const dialogError = ref<string | null>(null)

const openAddDialog = () => {
  selectedDeal.value = null
  dialogError.value = null
  isDealDialogVisible.value = true
}

const openEditDialog = (deal: DealProperties) => {
  selectedDeal.value = cloneDeal(deal)
  dialogError.value = null
  isDealDialogVisible.value = true
}

const saveDeal = (payload: Partial<DealProperties>) => {
  dialogLoading.value = true
  dialogError.value = null

  try {
    if (selectedDeal.value?.id) {
      const updated = dealsStore.updateDeal(selectedDeal.value.id, payload)
      if (!updated) {
        dialogError.value = 'Failed to update deal'
        notifications.push('Unable to update deal', 'error', 4000)

        return
      }

      notifications.push('Deal updated', 'success', 3000)
    }
    else {
      dealsStore.addDeal(payload)
      notifications.push('Deal created', 'success', 3000)
    }

    isDealDialogVisible.value = false
    selectedDeal.value = null
  }
  catch (error) {
    console.error('Failed to save deal', error)
    dialogError.value = 'An unexpected error occurred'
    notifications.push('Failed to save deal', 'error', 4000)
  }
  finally {
    dialogLoading.value = false
  }
}

const isConfirmDeleteVisible = ref(false)
const deleteCandidateId = ref<number | null>(null)

const confirmDelete = (id: number) => {
  deleteCandidateId.value = id
  isConfirmDeleteVisible.value = true
}

const cancelDelete = () => {
  deleteCandidateId.value = null
  isConfirmDeleteVisible.value = false
}

const performDelete = () => {
  if (deleteCandidateId.value === null)
    return

  dealsStore.removeDeal(deleteCandidateId.value)

  const index = selectedRows.value.findIndex(row => row === deleteCandidateId.value)
  if (index !== -1)
    selectedRows.value.splice(index, 1)

  notifications.push('Deal deleted', 'success', 3000)
  cancelDelete()
}

const toggleImportant = (deal: DealProperties) => {
  dealsStore.updateDeal(deal.id, { important: !deal.important })
  notifications.push(
    deal.important ? 'Removed from important deals' : 'Marked as important',
    'success',
    2500,
  )
}

const deleteCandidateName = computed(() => {
  if (deleteCandidateId.value === null)
    return ''

  const deal = dealsStore.byId(deleteCandidateId.value)

  return deal?.name ?? String(deleteCandidateId.value)
})

const updateOptions = (options: {
  sortBy?: Array<{ key: SortKey; order: SortOrder }>
}) => {
  const [sort] = options.sortBy ?? []
  if (sort) {
    sortBy.value = sort.key
    orderBy.value = sort.order
  }

  const matched = sortOptions.find(option =>
    option.value.key === sortBy.value && option.value.order === orderBy.value,
  )

  if (matched)
    selectedSort.value = matched.value
}

const updateItemsPerPage = (value: number | string) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric))
    return

  itemsPerPage.value = numeric
  page.value = 1
}
</script>

<template>
  <section>
    <VCard class="mb-6">
      <VCardItem class="pb-4">
        <VCardTitle>Deals</VCardTitle>
      </VCardItem>

      <VCardText>
        <VRow>
          <VCol
            cols="12"
            md="3"
          >
            <AppSelect
              v-model="selectedStage"
              placeholder="Select Stage"
              :items="stageOptions"
              clearable
              clear-icon="tabler-x"
            />
          </VCol>

          <VCol
            cols="12"
            md="3"
          >
            <AppSelect
              v-model="selectedType"
              placeholder="Select Type"
              :items="typeOptions"
              clearable
              clear-icon="tabler-x"
            />
          </VCol>

          <VCol
            cols="12"
            md="3"
          >
            <AppSelect
              v-model="selectedImportance"
              placeholder="Importance"
              :items="importanceOptions"
              clearable
              clear-icon="tabler-x"
            />
          </VCol>

          <VCol
            cols="12"
            md="3"
          >
            <AppSelect
              v-model="selectedSort"
              placeholder="Sort By"
              :items="sortOptions"
              item-title="title"
              item-value="value"
            />
          </VCol>
        </VRow>
      </VCardText>

      <VDivider />

      <VCardText class="d-flex flex-wrap gap-4">
        <div class="me-3 d-flex gap-3">
          <AppSelect
            :model-value="itemsPerPage"
            :items="[
              { value: 15, title: '15' },
              { value: 25, title: '25' },
              { value: 50, title: '50' },
              { value: 100, title: '100' },
              { value: -1, title: 'All' },
            ]"
            style="inline-size: 6.25rem"
            @update:model-value="updateItemsPerPage"
          />
        </div>

        <VSpacer />

        <div class="d-flex align-center flex-wrap gap-4">
          <div style="inline-size: 15.625rem">
            <AppTextField
              v-model="searchQuery"
              placeholder="Search Deals"
            />
          </div>

          <VBtn
            variant="tonal"
            color="secondary"
            prepend-icon="tabler-upload"
          >
            Export
          </VBtn>

          <VBtn
            prepend-icon="tabler-plus"
            @click="openAddDialog"
          >
            Add New Deal
          </VBtn>
        </div>
      </VCardText>

      <VDivider />

      <VDataTableServer
        v-model:items-per-page="itemsPerPage"
        v-model:model-value="selectedRows"
        v-model:page="page"
        :items="displayedDeals"
        item-value="id"
        :items-length="totalDeals"
        :headers="headers"
        class="text-no-wrap"
        @update:options="updateOptions"
      >
        <template #item.deal="{ item }">
          <div class="d-flex align-center gap-x-4 py-2">
            <VBtn
              icon
              variant="text"
              :color="item.important ? 'warning' : 'secondary'"
              @click.stop="toggleImportant(item)"
            >
              <VIcon :icon="item.important ? 'tabler-star-filled' : 'tabler-star'" />
            </VBtn>

            <div class="d-flex flex-column gap-1">
              <div class="text-base font-weight-medium">
                {{ item.name }}
              </div>

              <div class="text-sm text-medium-emphasis">
                <span v-if="item.code">{{ item.code }}</span>
                <span v-if="item.code && item.location"> - </span>
                <span v-if="item.location">{{ item.location }}</span>
              </div>

              <div
                v-if="resolveCustomFieldPreview(item)"
                class="text-sm text-medium-emphasis"
              >
                {{ resolveCustomFieldPreview(item) }}
              </div>
            </div>
          </div>
        </template>

        <template #item.contact="{ item }">
          <div class="d-flex align-center gap-3">
            <VAvatar
              size="34"
              :color="getContactEntry(item.relatedTo)?.picture ? undefined : 'primary'"
              :class="getContactEntry(item.relatedTo)?.picture ? null : 'text-white font-weight-medium'"
            >
              <VImg
                v-if="getContactEntry(item.relatedTo)?.picture"
                :src="getContactEntry(item.relatedTo)?.picture || undefined"
              />
              <span v-else>{{ avatarText(relatedContactName(item)) }}</span>
            </VAvatar>

            <span class="text-high-emphasis">{{ relatedContactName(item) }}</span>
          </div>
        </template>

        <template #item.stage="{ item }">
          <VChip
            color="info"
            label
            size="small"
          >
            {{ item.stage || '--' }}
          </VChip>
        </template>

        <template #item.type="{ item }">
          <span class="text-high-emphasis text-body-1">{{ item.type || "--" }}</span>
        </template>

        <template #item.delivery="{ item }">
          <span class="text-high-emphasis text-body-1">
            {{ formatDate(item.estimatedDeliveryDate) }}
          </span>
        </template>

        <template #item.collaborators="{ item }">
          <div class="d-flex align-center gap-2">
            <div
              v-if="decoratedCollaborators(item).length"
              class="v-avatar-group demo-avatar-group"
            >
              <VAvatar
                v-for="(collaborator, index) in decoratedCollaborators(item).slice(0, 3)"
                :key="`${item.id}-${index}`"
                :size="36"
                :color="collaborator.picture ? undefined : 'primary'"
                :class="collaborator.picture ? null : 'text-white font-weight-medium'"
              >
                <VImg
                  v-if="collaborator.picture"
                  :src="collaborator.picture"
                />
                <span v-else>{{ avatarText(collaborator.name) }}</span>

                <VTooltip
                  activator="parent"
                  location="top"
                >
                  {{ collaborator.name }}
                </VTooltip>
              </VAvatar>

              <VAvatar
                v-if="decoratedCollaborators(item).length > 3"
                color="secondary"
                :size="36"
                class="font-weight-medium text-white"
              >
                +{{ decoratedCollaborators(item).length - 3 }}
                <VTooltip
                  activator="parent"
                  location="top"
                >
                  {{
                    decoratedCollaborators(item)
                      .slice(3)
                      .map(entry => entry.name)
                      .join(", ")
                  }}
                </VTooltip>
              </VAvatar>
            </div>

            <span
              v-else
              class="text-medium-emphasis"
            >No collaborators</span>
          </div>
        </template>

        <template #item.actions="{ item }">
          <VBtn
            icon
            variant="text"
            color="medium-emphasis"
          >
            <VIcon icon="tabler-dots-vertical" />

            <VMenu activator="parent">
              <VList>
                <VListItem @click="openEditDialog(item)">
                  <template #prepend>
                    <VIcon icon="tabler-pencil" />
                  </template>
                  <VListItemTitle>Edit</VListItemTitle>
                </VListItem>

                <VListItem @click="toggleImportant(item)">
                  <template #prepend>
                    <VIcon :icon="item.important ? 'tabler-star-off' : 'tabler-star'" />
                  </template>
                  <VListItemTitle>
                    {{ item.important ? "Remove Important" : "Mark Important" }}
                  </VListItemTitle>
                </VListItem>

                <VDivider />

                <VListItem @click="confirmDelete(item.id)">
                  <template #prepend>
                    <VIcon
                      color="error"
                      icon="tabler-trash"
                    />
                  </template>
                  <VListItemTitle class="text-error">
                    Delete
                  </VListItemTitle>
                </VListItem>
              </VList>
            </VMenu>
          </VBtn>
        </template>
      </VDataTableServer>
    </VCard>

    <DealUpsertDialog
      v-model:is-dialog-visible="isDealDialogVisible"
      :deal="selectedDeal"
      :loading="dialogLoading"
      :error="dialogError"
      @submit="saveDeal"
    />

    <VDialog
      v-model="isConfirmDeleteVisible"
      max-width="540"
    >
      <VCard class="pa-sm-8 pa-4">
        <VCardTitle>Delete Deal</VCardTitle>
        <VCardText>
          Are you sure you want to permanently delete
          <strong>{{ deleteCandidateName }}</strong>?
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            variant="text"
            color="secondary"
            @click="cancelDelete"
          >
            Cancel
          </VBtn>
          <VBtn
            color="error"
            variant="tonal"
            @click="performDelete"
          >
            Delete
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </section>
</template>
