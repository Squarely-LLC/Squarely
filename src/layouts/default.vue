<script lang="ts" setup>
import { useConfigStore } from '@core/stores/config'
import { AppContentLayoutNav } from '@layouts/enums'
import { switchToVerticalNavOnLtOverlayNavBreakpoint } from '@layouts/utils'
import DefaultLayoutWithHorizontalNav from './components/DefaultLayoutWithHorizontalNav.vue'
import DefaultLayoutWithVerticalNav from './components/DefaultLayoutWithVerticalNav.vue'

const configStore = useConfigStore()

// ℹ️ This will switch to vertical nav when define breakpoint is reached when in horizontal nav layout
// Remove below composable usage if you are not using horizontal nav layout in your app
switchToVerticalNavOnLtOverlayNavBreakpoint()

const { layoutAttrs, injectSkinClasses } = useSkins()

injectSkinClasses()

// SECTION: Loading Indicator
const refLoadingIndicator = ref<any>(null)
const isSuspensePending = ref(false)

const router = useRouter()

// Start the loading bar immediately when any navigation begins
const removeBeforeEach = router.beforeEach(() => {
  isSuspensePending.value = false
  refLoadingIndicator.value?.fallbackHandle()
})

// For fast / cached routes where Suspense resolves instantly,
// stop the bar once the render cycle completes
const removeAfterEach = router.afterEach(() => {
  nextTick(() => {
    if (!isSuspensePending.value)
      refLoadingIndicator.value?.resolveHandle()
  })
})

// Stop the bar if navigation fails (e.g. chunk load error)
const removeOnError = router.onError(() => {
  isSuspensePending.value = false
  refLoadingIndicator.value?.resolveHandle()
})

onBeforeUnmount(() => {
  removeBeforeEach()
  removeAfterEach()
  removeOnError()
})

// Suspense events handle the async-chunk loading window
const onSuspenseFallback = () => {
  isSuspensePending.value = true
}

const onSuspenseResolve = () => {
  isSuspensePending.value = false
  refLoadingIndicator.value?.resolveHandle()
}
// !SECTION
</script>

<template>
  <Component
    v-bind="layoutAttrs"
    :is="configStore.appContentLayoutNav === AppContentLayoutNav.Vertical ? DefaultLayoutWithVerticalNav : DefaultLayoutWithHorizontalNav"
  >
    <AppLoadingIndicator ref="refLoadingIndicator" />

    <RouterView v-slot="{ Component }">
      <Suspense
        :timeout="0"
        @fallback="onSuspenseFallback"
        @resolve="onSuspenseResolve"
      >
        <Component :is="Component" />
      </Suspense>
    </RouterView>
  </Component>
</template>

<style lang="scss">
// As we are using `layouts` plugin we need its styles to be imported
@use "@layouts/styles/default-layout";
</style>
