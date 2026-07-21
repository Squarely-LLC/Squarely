<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import type { Notification } from '@/stores/notifications'
import { useNotificationsStore } from '@/stores/notifications'

const DEAL_ALERT_GAP_MS = 500
const DEAL_ALERT_TRANSITION_MS = 200

const route = useRoute()
const store = useNotificationsStore()

const notes = computed(() => store.items)
const isDealRoute = computed(() => route.path.startsWith('/operations/deals'))
const activeDealNote = ref<Notification | null>(null)
const dealAlertVisible = ref(false)
const noteVisible: Record<number, boolean> = reactive({})

let dealDisplayTimer: ReturnType<typeof setTimeout> | null = null
let dealRemovalTimer: ReturnType<typeof setTimeout> | null = null
let dealGapTimer: ReturnType<typeof setTimeout> | null = null
let dealAlertDismissing = false

const snackbarDisplayTimers = new Map<
  number,
  ReturnType<typeof setTimeout>
>()

const snackbarRemovalTimers = new Map<
  number,
  ReturnType<typeof setTimeout>
>()

const dealAlertType = (
  color?: string,
): 'success' | 'info' | 'warning' | 'error' => {
  const normalized = String(color || 'info').toLowerCase()

  if (
    normalized === 'success'
    || normalized === 'warning'
    || normalized === 'error'
  )
    return normalized

  return 'info'
}

const clearTimer = (
  timer: ReturnType<typeof setTimeout> | null,
): null => {
  if (timer !== null)
    clearTimeout(timer)

  return null
}

const clearDealTimers = () => {
  dealDisplayTimer = clearTimer(dealDisplayTimer)
  dealRemovalTimer = clearTimer(dealRemovalTimer)
  dealGapTimer = clearTimer(dealGapTimer)
}

const clearSnackbarTimers = () => {
  snackbarDisplayTimers.forEach(timer => clearTimeout(timer))
  snackbarRemovalTimers.forEach(timer => clearTimeout(timer))
  snackbarDisplayTimers.clear()
  snackbarRemovalTimers.clear()

  Object.keys(noteVisible).forEach(id => {
    noteVisible[Number(id)] = false
  })
}

function showNextDealAlert() {
  if (
    !isDealRoute.value
    || activeDealNote.value
    || dealGapTimer
    || !store.items.length
  )
    return

  const nextNote = store.items[0]

  activeDealNote.value = nextNote
  dealAlertVisible.value = true
  dealAlertDismissing = false

  const timeout = Number(nextNote.timeout ?? 3000)
  if (timeout > 0) {
    dealDisplayTimer = setTimeout(
      () => dismissDealAlert(nextNote.id),
      timeout,
    )
  }
}

function scheduleNextDealAlert() {
  dealGapTimer = setTimeout(() => {
    dealGapTimer = null
    showNextDealAlert()
  }, DEAL_ALERT_GAP_MS)
}

function dismissDealAlert(id: number) {
  if (activeDealNote.value?.id !== id || dealAlertDismissing)
    return

  dealAlertDismissing = true
  dealDisplayTimer = clearTimer(dealDisplayTimer)
  dealAlertVisible.value = false
  dealRemovalTimer = setTimeout(() => {
    activeDealNote.value = null
    dealAlertDismissing = false
    dealRemovalTimer = null
    store.remove(id)
    scheduleNextDealAlert()
  }, DEAL_ALERT_TRANSITION_MS)
}

const scheduleSnackbar = (note: Notification) => {
  if (snackbarDisplayTimers.has(note.id))
    return

  noteVisible[note.id] = true

  const timeout = Number(note.timeout ?? 3000)
  if (timeout <= 0)
    return

  snackbarDisplayTimers.set(
    note.id,
    setTimeout(() => {
      snackbarDisplayTimers.delete(note.id)
      noteVisible[note.id] = false
      snackbarRemovalTimers.set(
        note.id,
        setTimeout(() => {
          snackbarRemovalTimers.delete(note.id)
          store.remove(note.id)
        }, 250),
      )
    }, timeout),
  )
}

watch(
  [isDealRoute, () => store.items.map(note => note.id)],
  ([dealRoute]) => {
    if (dealRoute) {
      clearSnackbarTimers()

      if (
        activeDealNote.value
        && !store.items.some(note => note.id === activeDealNote.value?.id)
      ) {
        clearDealTimers()
        activeDealNote.value = null
        dealAlertVisible.value = false
        dealAlertDismissing = false
        scheduleNextDealAlert()

        return
      }

      showNextDealAlert()

      return
    }

    clearDealTimers()
    activeDealNote.value = null
    dealAlertVisible.value = false
    dealAlertDismissing = false
    store.items.forEach(scheduleSnackbar)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  clearDealTimers()
  clearSnackbarTimers()
})
</script>

<template>
  <div
    v-if="isDealRoute"
    class="app-deal-alert-region"
    aria-live="polite"
    aria-atomic="true"
  >
    <Transition name="deal-alert">
      <VAlert
        v-if="activeDealNote && dealAlertVisible"
        :key="activeDealNote.id"
        :color="activeDealNote.color || 'info'"
        :type="dealAlertType(activeDealNote.color)"
        variant="tonal"
        closable
        close-label="Close alert"
        class="app-deal-alert"
        @click:close="dismissDealAlert(activeDealNote.id)"
      >
        {{ activeDealNote.message }}
      </VAlert>
    </Transition>
  </div>

  <div v-else>
    <TransitionGroup
      name="list"
      tag="div"
    >
      <div
        v-for="note in notes"
        :key="note.id"
        class="app-snackbar-wrapper"
      >
        <VSnackbar
          v-model:model-value="noteVisible[note.id]"
          :color="note.color"
          :timeout="note.timeout"
          variant="tonal"
          location="bottom"
        >
          {{ note.message }}
        </VSnackbar>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.app-deal-alert-region {
  position: fixed;
  z-index: 2400;
  inline-size: min(24rem, calc(100vw - 2rem));
  inset-block-start: 5rem;
  inset-inline-end: 1.5rem;
  pointer-events: none;
}

.app-deal-alert {
  box-shadow: 0 8px 24px rgba(var(--v-shadow-key-umbra-color), 0.18);
  pointer-events: auto;
}

.deal-alert-enter-active,
.deal-alert-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.deal-alert-enter-from,
.deal-alert-leave-to {
  opacity: 0;
  transform: translateX(1rem);
}

.app-snackbar-wrapper {
  margin-block-end: 6px;
}

@media (max-width: 600px) {
  .app-deal-alert-region {
    inline-size: calc(100vw - 2rem);
    inset-block-start: 4.75rem;
    inset-inline-end: 1rem;
  }
}
</style>
