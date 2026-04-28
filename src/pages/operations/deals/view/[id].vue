<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import type { ToDo } from '@/data/schema'
import type { CatalogueTaskStartTrigger } from '@/plugins/fake-api/handlers/catalogues/types'
import type { DealProperties } from '@/plugins/fake-api/handlers/operations/deals/types'
import { useContactsStore } from '@/stores/contacts'
import { useDealsStore } from '@/stores/deals'
import { useEmployeesStore } from '@/stores/employees'
import { useNotificationsStore } from '@/stores/notifications'
import { useTodos } from '@/stores/todos'
import CatalogueTaskTemplateDrawer from '@/components/catalogues/CatalogueTaskTemplateDrawer.vue'
import EmailDialog from '@/views/apps/email/EmailDialog.vue'
import AddMeetingDrawer from '@/views/apps/todo/list/AddMeetingDrawer.vue'
import DealUpsertDialog from '@/views/operations/deals/list/DealUpsertDialog.vue'
import DealCommunicationTab from '@/views/operations/deals/view/DealCommunicationTab.vue'
import DealDocumentsTab from '@/views/operations/deals/view/DealDocumentsTab.vue'
import DealFinancialsTab from '@/views/operations/deals/view/DealFinancialsTab.vue'
import DealItemsTab from '@/views/operations/deals/view/DealItemsTab.vue'
import DealSummaryCard from '@/views/operations/deals/view/DealSummaryCard.vue'
import DealTimelineTab from '@/views/operations/deals/view/DealTimelineTab.vue'

const route = useRoute('operations-deals-view-id')
const router = useRouter()

const dealsStore = useDealsStore()
const contactsStore = useContactsStore()
const employeesStore = useEmployeesStore()
const notifications = useNotificationsStore()
const todosStore = useTodos()

dealsStore.init()
contactsStore.init()
employeesStore.init()
todosStore.init()

const loading = ref(true)
const error = ref<string | null>(null)
const deal = ref<DealProperties | null>(null)
const dealTab = ref<number | null>(null)
const isDealEditDialogVisible = ref(false)
const dialogLoading = ref(false)
const dialogError = ref<string | null>(null)
const addMeetingRef = ref<InstanceType<typeof AddMeetingDrawer> | null>(null)
const isAddMeetingOpen = ref(false)
const composeDialogRef = ref<any | null>(null)
const isComposeDialogVisible = ref(false)
const taskTemplateDrawerRef = ref<InstanceType<typeof CatalogueTaskTemplateDrawer> | null>(null)
const isTaskTemplateDrawerOpen = ref(false)
const taskTemplateMode = ref<'create' | 'edit'>('create')
const taskTemplateTodoId = ref<number | string | null>(null)

const tabKeys = ['items', 'communication', 'documents', 'financials', 'timeline'] as const
const tabs = [
  { icon: 'tabler-package', title: 'Items' },
  { icon: 'tabler-message', title: 'Communication' },
  { icon: 'tabler-folder', title: 'Documents' },
  { icon: 'tabler-credit-card', title: 'Financials' },
  { icon: 'tabler-timeline', title: 'Timeline' },
] as const

const cloneDeal = (value: DealProperties | null) => {
  if (!value)
    return null

  return JSON.parse(JSON.stringify(value)) as DealProperties
}

const resolveDeal = () => {
  loading.value = true
  const found = dealsStore.byId(route.params.id)

  if (found) {
    deal.value = cloneDeal(found)
    error.value = null
  }
  else {
    deal.value = null
    error.value = 'Deal not found.'
  }

  loading.value = false
}

const setTabFromQuery = () => {
  const queryTab = String(route.query.tab || tabKeys[0])
  const index = (tabKeys as readonly string[]).indexOf(queryTab)
  dealTab.value = index === -1 ? 0 : index
}

const linkedToName = computed(() => {
  const relatedId = deal.value?.relatedTo
  if (relatedId === null || relatedId === undefined)
    return '--'

  return contactsStore.byId(Number(relatedId))?.fullName || '--'
})

const collaboratorNames = computed(() =>
  (deal.value?.collaborators || []).map((id) => {
    const employee = employeesStore.byId(Number(id))

    return employee?.fullName || `Employee ${id}`
  }),
)

const meetingContacts = computed(() =>
  contactsStore.all.map(contact => ({
    id: contact.id,
    name: contact.fullName,
    avatarUrl: contact.picture || null,
  })),
)

const goalTriggerOptions = computed(() => [] as Array<{ title: string; value: string }>)

const openEditDialog = () => {
  dialogError.value = null
  isDealEditDialogVisible.value = true
}

const saveDeal = (payload: Partial<DealProperties>) => {
  if (!deal.value)
    return

  dialogLoading.value = true
  dialogError.value = null

  try {
    const updated = dealsStore.updateDeal(deal.value.id, payload)
    if (!updated) {
      dialogError.value = 'Failed to update deal'
      notifications.push('Unable to update deal', 'error', 4000)

      return
    }

    deal.value = cloneDeal(updated)
    isDealEditDialogVisible.value = false
    notifications.push('Deal updated', 'success', 3000)
  }
  catch (updateError) {
    console.error('Failed to update deal', updateError)
    dialogError.value = 'An unexpected error occurred'
    notifications.push('Failed to update deal', 'error', 4000)
  }
  finally {
    dialogLoading.value = false
  }
}

const openAddMeeting = () => {
  if (!deal.value)
    return

  nextTick(() => {
    try {
      const linkedTo = deal.value?.relatedTo !== null && deal.value?.relatedTo !== undefined
        ? [{
            id: deal.value.relatedTo,
            contactId: deal.value.relatedTo,
            name: linkedToName.value,
            avatarUrl: contactsStore.byId(Number(deal.value?.relatedTo))?.picture || null,
            type: 'contact' as const,
            roles: ['contact'] as ['contact'],
          }]
        : []

      addMeetingRef.value?.openWith?.({
        title: `Meeting: ${deal.value?.code || `Deal #${deal.value?.id}`}`,
        initialStart: new Date(),
        durationMins: 60,
        linkedTo,
        relatedTo: {
          id: deal.value?.id,
          name: deal.value?.code || `Deal #${deal.value?.id}`,
          type: 'deal',
        },
        attendees: [],
        notes: `Meeting regarding ${deal.value?.code || `deal #${deal.value?.id}`}`,
      })
    }
    catch {}
    isAddMeetingOpen.value = true
  })
}

const onMeetingCreated = (payload: any) => {
  try {
    todosStore.addMeeting && todosStore.addMeeting(payload)
    notifications.push('Meeting created', 'success', 3500)
  }
  catch (meetingError) {
    console.error('onMeetingCreated failed:', meetingError)
    notifications.push('Meeting created', 'success', 3500)
  }
  finally {
    isAddMeetingOpen.value = false
  }
}

const openEmail = () => {
  if (!deal.value)
    return

  isComposeDialogVisible.value = true
  nextTick(() => {
    try {
      const relatedContact = contactsStore.byId(Number(deal.value?.relatedTo))
      composeDialogRef.value?.openWith?.({
        to: relatedContact?.email ? [relatedContact.email] : [],
        subject: `Regarding ${deal.value?.code || `Deal #${deal.value?.id}`}`,
        message: `Hello,\n\nI'd like to discuss ${deal.value?.code || `deal #${deal.value?.id}`}.\n\nThanks,`,
      })
    }
    catch {}
  })
}

const openAddTask = (payload: { initial: Partial<ToDo> }) => {
  taskTemplateMode.value = 'create'
  taskTemplateTodoId.value = null

  nextTick(() => {
    try {
      taskTemplateDrawerRef.value?.openWith?.({
        ...payload.initial,
        afterWhen: (payload.initial as ToDo).afterWhen ?? '+1 day',
        startTrigger: (payload.initial as ToDo).startTrigger ?? {
          type: 'time',
          goalId: null,
          taskId: null,
        },
      })
    }
    catch {}
  })
  isTaskTemplateDrawerOpen.value = true
}

const openEditTask = (todoId: number | string) => {
  const todo = todosStore.byId(todoId)
  if (!todo)
    return

  taskTemplateMode.value = 'edit'
  taskTemplateTodoId.value = todoId
  nextTick(() => {
    try {
      taskTemplateDrawerRef.value?.openWith?.({
        title: todo.title,
        collaborators: todo.collaborators,
        afterWhen: todo.afterWhen ?? todo.dueAt ?? '+1 day',
        startTrigger: (todo.startTrigger as CatalogueTaskStartTrigger | null | undefined) ?? {
          type: 'time',
          goalId: null,
          taskId: null,
        },
        notes: todo.notes ?? '',
        important: todo.important,
        status: todo.status,
        attachment: todo.attachment ?? null,
        relatedTo: todo.relatedTo ?? null,
        goalId: todo.goalId ?? null,
        milestoneId: todo.milestoneId ?? null,
        steps: Array.isArray(todo.steps) ? todo.steps.map(step => ({ ...step })) : [],
      })
    }
    catch {}
  })
  isTaskTemplateDrawerOpen.value = true
}

const deleteTask = (todoId: number | string) => {
  todosStore.removeTodo(todoId)
  notifications.push('Task deleted', 'success', 3000)
}

const onTaskTemplateSaved = (payload: Partial<ToDo> & {
  afterWhen?: string | null
  startTrigger?: CatalogueTaskStartTrigger | null
}) => {
  if (!deal.value)
    return
  const relatedTo = {
    id: deal.value.id,
    name: deal.value.code || `Deal #${deal.value.id}`,
    type: 'deal',
  }
  const normalized: Partial<ToDo> = {
    title: String(payload.title ?? '').trim(),
    collaborators: Array.isArray(payload.collaborators)
      ? payload.collaborators.map(collaborator => ({ ...collaborator }))
      : [],
    dueAt: String(payload.afterWhen ?? payload.dueAt ?? '+1 day'),
    afterWhen: payload.afterWhen ?? payload.dueAt ?? null,
    startTrigger:
      payload.startTrigger?.type === 'goal' || payload.startTrigger?.type === 'task'
        ? {
            type: payload.startTrigger.type,
            goalId: payload.startTrigger.goalId ?? null,
            taskId: payload.startTrigger.taskId ?? null,
          }
        : {
            type: 'time' as const,
            goalId: null,
            taskId: null,
          },
    status:
      payload.status === 'in_progress' ||
      payload.status === 'for_review' ||
      payload.status === 'completed'
        ? payload.status
        : 'pending',
    notes: String(payload.notes ?? '').trim(),
    important: Boolean(payload.important),
    attachment: payload.attachment ?? null,
    relatedTo,
    goalId: payload.goalId ?? null,
    milestoneId: payload.milestoneId ?? null,
    steps: Array.isArray(payload.steps)
      ? payload.steps.map((step, index) => ({
          ...step,
          id: step.id ?? index + 1,
        }))
      : [],
  }

  if (taskTemplateMode.value === 'edit' && taskTemplateTodoId.value !== null) {
    todosStore.updateTodo(taskTemplateTodoId.value, normalized)
    notifications.push('Task updated', 'success', 3000)
  }
  else {
    todosStore.addTodo(normalized)
    notifications.push('Task created', 'success', 3000)
  }

  isTaskTemplateDrawerOpen.value = false
  taskTemplateTodoId.value = null
  taskTemplateMode.value = 'create'
}

onMounted(() => {
  resolveDeal()
  setTabFromQuery()
})

watch(() => route.params.id, resolveDeal)
watch(() => dealsStore.byId(route.params.id), (value) => {
  if (!value) {
    deal.value = null
    error.value = 'Deal not found.'
    return
  }

  deal.value = cloneDeal(value)
  error.value = null
})

watch(() => route.query.tab, setTabFromQuery)
watch(() => dealTab.value, (value) => {
  if (value == null)
    return

  const key = (tabKeys as readonly string[])[value] || tabKeys[0]
  if (String(route.query.tab) === key)
    return

  try {
    router.replace({
      name: route.name as any,
      params: route.params,
      query: { ...(route.query || {}), tab: key },
    })
  }
  catch {}
})
</script>

<template>
  <div>
    <VProgressLinear
      v-if="loading"
      indeterminate
      color="primary"
      class="mb-4"
    />

    <VRow v-if="deal">
      <VCol
        cols="12"
        md="5"
        lg="4"
      >
        <DealSummaryCard
          :deal="deal"
          :linked-to-name="linkedToName"
          :collaborator-names="collaboratorNames"
          @edit="openEditDialog"
        />
      </VCol>

      <VCol
        cols="12"
        md="7"
        lg="8"
      >
        <VTabs
          v-model="dealTab"
          class="v-tabs-pill mb-4"
        >
          <VTab
            v-for="tab in tabs"
            :key="tab.icon"
          >
            <VIcon
              :size="18"
              :icon="tab.icon"
              class="me-1"
            />
            <span>{{ tab.title }}</span>
          </VTab>
        </VTabs>

        <VWindow
          v-model="dealTab"
          class="disable-tab-transition"
          :touch="false"
        >
          <VWindowItem>
            <DealItemsTab
              :deal="deal"
              @open-add-task="openAddTask"
              @open-edit-task="openEditTask"
              @delete-task="deleteTask"
            />
          </VWindowItem>

          <VWindowItem>
            <DealCommunicationTab
              :deal-id="deal.id"
              :deal-code="deal.code || `Deal #${deal.id}`"
              @open-add-meeting="openAddMeeting"
              @open-email="openEmail"
            />
          </VWindowItem>

          <VWindowItem>
            <DealDocumentsTab :deal="deal" />
          </VWindowItem>

          <VWindowItem>
            <DealFinancialsTab :deal="deal" />
          </VWindowItem>

          <VWindowItem>
            <DealTimelineTab :deal="deal" />
          </VWindowItem>
        </VWindow>
      </VCol>
    </VRow>

    <VAlert
      v-else-if="error"
      type="error"
      variant="tonal"
    >
      {{ error }}
    </VAlert>

    <AddMeetingDrawer
      ref="addMeetingRef"
      v-model:modelValue="isAddMeetingOpen"
      :contacts="meetingContacts"
      source="contacts"
      @cancel="isAddMeetingOpen = false"
      @save="onMeetingCreated"
    />

    <CatalogueTaskTemplateDrawer
      ref="taskTemplateDrawerRef"
      v-model:is-drawer-open="isTaskTemplateDrawerOpen"
      :goal-trigger-options="goalTriggerOptions"
      @save="onTaskTemplateSaved"
    />

    <EmailDialog
      ref="composeDialogRef"
      v-model:is-dialog-visible="isComposeDialogVisible"
      @send="
        (payload) => {
          try {
            const recipients = Array.isArray(payload?.to)
              ? payload.to
              : payload?.to
                ? [String(payload.to)]
                : [];
            notifications.push(
              `Email sent to ${recipients.length} recipient(s)`,
              'success',
              3500,
            );
          } catch (e) {
            notifications.push('Email sent', 'success', 3500);
          }
        }
      "
    />

    <DealUpsertDialog
      v-model:is-dialog-visible="isDealEditDialogVisible"
      :deal="deal"
      :loading="dialogLoading"
      :error="dialogError"
      @submit="saveDeal"
    />
  </div>
</template>
