import { defineStore } from 'pinia'
import { toRaw } from 'vue'

import { db } from '@/plugins/fake-api/handlers/operations/deals/db'
import type {
  DealFinancialEntry,
  DealFieldValue,
  DealItem,
  DealProperties,
} from '@/plugins/fake-api/handlers/operations/deals/types'

const STORAGE_KEY = 'app.deals.v2'

function cloneDeal(deal: DealProperties): DealProperties {
  const raw = toRaw(deal) as DealProperties

  try {
    return JSON.parse(JSON.stringify(raw)) as DealProperties
  }
  catch (error) {
    return {
      ...raw,
      collaborators: Array.isArray(raw.collaborators) ? [...raw.collaborators] : [],
      customFieldValues: { ...(raw.customFieldValues || {}) },
      items: Array.isArray(raw.items) ? raw.items.map(item => ({ ...item })) : [],
      documents: Array.isArray(raw.documents) ? raw.documents.map(document => ({ ...document })) : [],
      financials: Array.isArray(raw.financials) ? raw.financials.map(entry => ({ ...entry })) : [],
    }
  }
}

function cloneDealsArray(deals: DealProperties[]) {
  return deals.map(deal => cloneDeal(deal))
}

function loadFromStorage(): DealProperties[] | null {
  if (typeof window === 'undefined')
    return null

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw)
      return null

    const parsed = JSON.parse(raw)

    return Array.isArray(parsed) ? parsed as DealProperties[] : null
  }
  catch (error) {
    console.warn('Failed to load deals from storage:', error)

    return null
  }
}

function saveToStorage(deals: DealProperties[]) {
  if (typeof window === 'undefined')
    return

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(deals))
  }
  catch (error) {
    console.warn('Failed to save deals to storage:', error)
  }
}

function nextDealId(items: DealProperties[]) {
  const ids = items
    .map(deal => Number(deal.id))
    .filter(value => Number.isFinite(value) && value > 0)

  return ids.length ? Math.max(...ids) + 1 : 1
}

function nextDealCode(items: DealProperties[]) {
  const nextSequence = items.reduce((maxValue, deal) => {
    const match = String(deal.code ?? '').match(/DL-(\d+)/i)
    if (!match)
      return maxValue

    const numeric = Number(match[1])

    return Number.isFinite(numeric) ? Math.max(maxValue, numeric) : maxValue
  }, 1000) + 1

  return `DL-${nextSequence}`
}

function normalizeCustomFieldValues(
  values: Record<string, DealFieldValue> | undefined | null,
): Record<string, DealFieldValue> {
  if (!values || typeof values !== 'object')
    return {}

  return Object.fromEntries(Object.entries(values))
}

function normalizeItems(items: DealItem[] | undefined | null): DealItem[] {
  if (!Array.isArray(items))
    return []

  return items.map(item => ({ ...item }))
}

function normalizeDocuments(documents: DealProperties['documents'] | undefined | null) {
  if (!Array.isArray(documents))
    return []

  return documents.map(document => ({ ...document }))
}

function normalizeFinancials(financials: DealFinancialEntry[] | undefined | null): DealFinancialEntry[] {
  if (!Array.isArray(financials))
    return []

  return financials.map(entry => ({ ...entry }))
}

function normaliseDeal(
  payload: Partial<DealProperties>,
  assignedId: number,
  generatedCode: string,
): DealProperties {
  const now = new Date().toISOString()
  const code = payload.code?.trim() || generatedCode

  return {
    id: assignedId,
    name: code,
    code,
    relatedTo: payload.relatedTo ?? null,
    type: payload.type?.trim() || null,
    estimatedDeliveryDate: payload.estimatedDeliveryDate || null,
    stage: payload.stage?.trim() || null,
    important: Boolean(payload.important),
    location: payload.location?.trim() || null,
    collaborators: Array.isArray(payload.collaborators)
      ? payload.collaborators.map(value => Number(value)).filter(Number.isFinite)
      : [],
    note: payload.note?.trim() || null,
    customFieldValues: normalizeCustomFieldValues(payload.customFieldValues),
    items: normalizeItems(payload.items),
    documents: normalizeDocuments(payload.documents),
    financials: normalizeFinancials(payload.financials),
    createdAt: payload.createdAt || now,
  }
}

function mergeDeal(
  original: DealProperties,
  patch: Partial<DealProperties>,
): DealProperties {
  return cloneDeal({
    ...original,
    ...patch,
    code: patch.code === undefined ? original.code : patch.code?.trim() || null,
    type: patch.type === undefined ? original.type : patch.type?.trim() || null,
    stage: patch.stage === undefined ? original.stage : patch.stage?.trim() || null,
    location: patch.location === undefined ? original.location : patch.location?.trim() || null,
    note: patch.note === undefined ? original.note : patch.note?.trim() || null,
    collaborators: Array.isArray(patch.collaborators)
      ? patch.collaborators.map(value => Number(value)).filter(Number.isFinite)
      : original.collaborators,
    customFieldValues: patch.customFieldValues === undefined
      ? { ...(original.customFieldValues || {}) }
      : normalizeCustomFieldValues(patch.customFieldValues),
    items: patch.items === undefined
      ? normalizeItems(original.items)
      : normalizeItems(patch.items),
    documents: patch.documents === undefined
      ? normalizeDocuments(original.documents)
      : normalizeDocuments(patch.documents),
    financials: patch.financials === undefined
      ? normalizeFinancials(original.financials)
      : normalizeFinancials(patch.financials),
  })
}

const seedDeals = () => cloneDealsArray(db.deals)

export const useDealsStore = defineStore('deals', {
  state: () => ({
    items: [] as DealProperties[],
    initialized: false,
  }),
  getters: {
    all: state => state.items,
    byId: state => (id: number | string) =>
      state.items.find(deal => String(deal.id) === String(id)) ?? null,
  },
  actions: {
    init(force = false) {
      if (this.initialized && !force)
        return

      const stored = loadFromStorage()

      if (stored && stored.length) {
        this.items = cloneDealsArray(stored)
      }
      else {
        this.items = seedDeals()
        saveToStorage(this.items)
      }

      this.initialized = true

      if (typeof window !== 'undefined') {
        this.$subscribe((_mutation, state) => {
          saveToStorage(cloneDealsArray(state.items))
        }, { detached: true })
      }
    },

    addDeal(payload: Partial<DealProperties>) {
      const incomingId = payload.id && Number(payload.id) > 0 ? Number(payload.id) : undefined
      const id = incomingId ?? nextDealId(this.items)
      const normalised = normaliseDeal(payload, id, nextDealCode(this.items))

      this.items.unshift(normalised)

      return normalised
    },

    updateDeal(id: number | string, patch: Partial<DealProperties>) {
      const index = this.items.findIndex(deal => String(deal.id) === String(id))
      if (index === -1)
        return null

      const updated = mergeDeal(this.items[index], patch)

      this.items.splice(index, 1, updated)

      return updated
    },

    removeDeal(id: number | string) {
      const index = this.items.findIndex(deal => String(deal.id) === String(id))
      if (index === -1)
        return

      this.items.splice(index, 1)
    },

    replaceAll(deals: DealProperties[]) {
      this.items = cloneDealsArray(deals)
    },
  },
})
