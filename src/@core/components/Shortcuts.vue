<script setup lang="ts">
interface Shortcut {
  icon: string
  title: string
  subtitle: string
  to: object | string
}

interface Props {
  togglerIcon?: string
  shortcuts: Shortcut[]
}

const props = withDefaults(defineProps<Props>(), {
  togglerIcon: 'tabler-layout-grid-add',
})

const router = useRouter()
</script>

<template>
  <IconBtn>
    <VIcon :icon="props.togglerIcon" />

    <VMenu
      activator="parent"
      offset="12px"
      location="bottom end"
    >
      <VCard
        :width="$vuetify.display.smAndDown ? 330 : 380"
        max-height="560"
        class="d-flex flex-column"
      >
        <VCardItem class="py-3">
          <h6 class="text-base font-weight-medium">
            Shortcuts
          </h6>

          <template #append>
            <IconBtn
              size="small"
              color="high-emphasis"
            >
              <VIcon
                size="20"
                icon="tabler-plus"
              />
            </IconBtn>
          </template>
        </VCardItem>

        <VDivider />

        <div class="shortcuts-scroll">
          <VRow class="ma-0 mt-n1">
            <VCol
              v-for="(shortcut, index) in props.shortcuts"
              :key="shortcut.title"
              cols="6"
              class="text-center border-t cursor-pointer pa-6 shortcut-icon"
              :class="(index + 1) % 2 ? 'border-e' : ''"
              @click="router.push(shortcut.to)"
            >
              <VAvatar
                variant="tonal"
                size="50"
              >
                <VIcon
                  size="26"
                  color="high-emphasis"
                  :icon="shortcut.icon"
                />
              </VAvatar>

              <h6 class="text-base font-weight-medium mt-3 mb-0">
                {{ shortcut.title }}
              </h6>
              <p class="text-sm mb-0">
                {{ shortcut.subtitle }}
              </p>
            </VCol>
          </VRow>
        </div>
      </VCard>
    </VMenu>
  </IconBtn>
</template>

<style lang="scss">
.shortcuts-scroll {
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgb(var(--v-theme-perfect-scrollbar-thumb)) transparent;
}

.shortcuts-scroll::-webkit-scrollbar {
  width: 0.5rem;
}

.shortcuts-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.shortcuts-scroll::-webkit-scrollbar-thumb {
  border: 2px solid transparent;
  border-radius: 999px;
  background-clip: padding-box;
  background-color: rgb(var(--v-theme-perfect-scrollbar-thumb));
}

.shortcut-icon:hover {
  background-color: rgba(var(--v-theme-on-surface), var(--v-hover-opacity));
}
</style>
