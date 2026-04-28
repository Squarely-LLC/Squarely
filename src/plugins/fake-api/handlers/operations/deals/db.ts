import type { DealProperties } from './types'

interface DB {
  deals: DealProperties[]
}

export const db: DB = {
  deals: [
    {
      id: 1,
      name: 'Boutique Fit-out',
      code: 'DL-1001',
      relatedTo: 1,
      type: 'Retail',
      estimatedDeliveryDate: '2026-05-20',
      stage: 'Negotiation',
      important: true,
      location: 'Dubai',
      collaborators: [1, 3, 6],
      note: 'Client wants phased delivery around store launch.',
      customFieldValues: {
        additional_field_1: 180000,
        additional_field_2: 'Ted',
      },
      createdAt: '2026-04-10T09:30:00Z',
    },
    {
      id: 2,
      name: 'Showroom Refresh',
      code: 'DL-1002',
      relatedTo: 5,
      type: 'Wholesale',
      estimatedDeliveryDate: '2026-06-05',
      stage: 'Under Review',
      important: false,
      location: 'Riyadh',
      collaborators: [2, 5],
      note: 'Pending final material palette approval.',
      customFieldValues: {
        additional_field_1: 92000,
        additional_field_2: 'Nora',
      },
      createdAt: '2026-04-14T13:15:00Z',
    },
    {
      id: 3,
      name: 'Corporate Event Package',
      code: 'DL-1003',
      relatedTo: 3,
      type: 'Retail',
      estimatedDeliveryDate: '2026-05-12',
      stage: 'In Progress',
      important: true,
      location: 'Online',
      collaborators: [3, 7, 9],
      note: 'Fast turnaround requested for June activation.',
      customFieldValues: {
        additional_field_1: 45000,
        additional_field_2: 'Maya',
      },
      createdAt: '2026-04-18T08:00:00Z',
    },
  ],
}
