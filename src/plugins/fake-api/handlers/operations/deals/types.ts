export type DealFieldValue = string | number | boolean | null

import type { JobDocument } from '@/plugins/fake-api/handlers/operations/jobs/types'

export interface DealItem {
  id: number
  name: string
  itemTypeLabel?: string | null
  category?: string | null
  catalogueItemId?: string | null
  catalogueType?: string | null
  parentItemId?: number | null
  sourceRelatedItemId?: number | null
  excludedRelatedItemIds?: number[] | null
  generatedTaskIds?: Array<number | string> | null
  quantity: number
  unitPrice?: number | null
  status?: string | null
  note?: string | null
}

export interface DealFinancialEntry {
  id: number
  title: string
  type: 'quotation' | 'invoice' | 'payment' | 'cost'
  amount: number
  status?: string | null
  dueDate?: string | null
  createdAt: string
}

export interface DealProperties {
  id: number
  name: string
  code?: string | null
  relatedTo?: number | null
  type?: string | null
  estimatedDeliveryDate?: string | null
  stage?: string | null
  important: boolean
  location?: string | null
  collaborators: number[]
  note?: string | null
  customFieldValues: Record<string, DealFieldValue>
  items: DealItem[]
  documents: JobDocument[]
  financials: DealFinancialEntry[]
  createdAt: string
}
