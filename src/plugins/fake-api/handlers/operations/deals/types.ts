export type DealFieldValue = string | number | boolean | null

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
  createdAt: string
}
