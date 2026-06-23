export interface LegalConfig {
  logo?: string // url to company picture
  companyName?: string
  crn?: string // company registration number
  address?: string
  country?: string
  city?: string
  number?: string // primary phone
  email?: string
  website?: string
  socialLinks?: string[] // array of urls
  ownership?: { contactId: number; contactName?: string }[] // references to Contact
}

export interface VatSettings {
  enabled: boolean
  registrationNumber?: string // VAT Reg No / TRN No
  attachDocument?: boolean // whether to attach VAT/TRN document
}

export interface BankDetailsItem {
  enabled: boolean
  bankName?: string
  accountName?: string
  iban?: string
  accountNumber?: string
  branch?: string
  swiftCode?: string
}

export interface InvoicingSettings {
  showNotes: boolean
  notesOnInvoice?: string
  noteOnQuotation?: string
  noteOnProforma?: string
}

export type DocumentSourceMode = 'internal' | 'external'

export interface DocumentSourceModeSettings {
  quotation: DocumentSourceMode
  proforma: DocumentSourceMode
  invoice: DocumentSourceMode
}

export interface FinancialConfig {
  currency?: string
  vat?: VatSettings
  bankDetails?: BankDetailsItem[]
  invoicing?: InvoicingSettings
  documentSourceModes?: Partial<DocumentSourceModeSettings>
  expenseCategories?: string[]
  documentTypes?: string[]
  invoiceSequence?: string // pattern or prefix
  referenceFormat?: string
  skipDeleted?: boolean
  paymentReminders?: {
    enabled: boolean
    invoiceDaysBefore?: number
    purchaseDaysBefore?: number
  }
  accounts?: { id: string; name: string }[]
}

export interface HrLeavesConfig {
  types?: string[]
  policy?: string
  countBasis?: string
  includeNonWorkingDays?: boolean
}

export interface HrConfig {
  deductions?: string[]
  additions?: string[]
  advances?: string[]
  leaves?: HrLeavesConfig
  departments?: string[]
  requestApproval?: 'required' | 'one_level' | 'two_level' | 'none'
  reimbursables?: string[]
}

export type CrmContactRequirement = 'none' | 'phone' | 'email' | 'both' | 'either'

export interface CrmEntitySettings {
  category?: string
  requirePhone?: boolean
  requireEmail?: boolean
  contactRequirement?: CrmContactRequirement
  inactiveAfterMonths?: number | null // months after which contact becomes inactive
}

export interface CrmConfig {
  DefaultContactType?: string
  organization?: any
  individual?: any
  individualCategories?: string[]
  organizationCategories?: string[]
  channels?: string[]
  locations?: string[]
  documentCategories?: string[]
  documentTypes?: string[]
  documentRenewable?: string | null
  callPurposes?: string[]
  sentiment?: string[]
  showContactRecord?: boolean
  notes?: string[]
  meetings?: string[]
  jobStages?: string[]
  jobStatuses?: string[]
  jobAlert?: { enabled: boolean; days: number }
}

export interface DealsConfig {
  leadLostIn?: number // days
  quotationLostIn?: number // days
  dealPrefix?: string // prefix used for generated deal codes
  quotationStartsSeq?: string // prefix or sequence
  proformaStartSeq?: string
  salesType?: string[]
  fieldLabels?: Record<string, string>
  customFields?: DealCustomFieldDefinition[]
  dealStages?: string[]
  dealAlert?: { enabled: boolean; days?: number }
}

export type DealCustomFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'select'
  | 'boolean'
  | 'textarea'

export interface DealCustomFieldDefinition {
  key: string
  label: string
  type: DealCustomFieldType
  options?: string[]
  defaultValue?: string | number | boolean | null
}

export interface CatalogueConfig {
  itemTypes?: string[]
  activeStates?: string[]
  hideArchivedByDefault?: boolean
  categories?: CatalogueCategory[]
}

export interface CatalogueCategory {
  id: string
  name: string
  children?: CatalogueCategory[]
}

interface AppConfigurations {
  legal?: LegalConfig
  financial?: FinancialConfig
  hr?: HrConfig
  crm?: CrmConfig
  deals?: DealsConfig
  catalogue?: CatalogueConfig
}

export default AppConfigurations
