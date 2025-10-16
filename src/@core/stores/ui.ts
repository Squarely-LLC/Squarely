import { defineStore } from 'pinia'

export const useUiStore = defineStore('ui', {
  state: () => ({
    isCustomizerOpen: false,
  }),
  actions: {
    openCustomizer() { this.isCustomizerOpen = true },
    closeCustomizer() { this.isCustomizerOpen = false },
    toggleCustomizer() { this.isCustomizerOpen = !this.isCustomizerOpen },
  },
})
