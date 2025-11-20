export interface LegalConfig {
  logo?: string; // url to company picture
  companyName?: string;
  crn?: string; // company registration number
  address?: string;
  country?: string;
  city?: string;
  number?: string; // primary phone
  email?: string;
  website?: string;
  socialLinks?: string[]; // array of urls
  ownership?: { contactId: number; contactName?: string }[]; // references to Contact
}

export interface VatSettings {
  enabled: boolean;
  registrationNumber?: string; // VAT Reg No / TRN No
  attachDocument?: boolean; // whether to attach VAT/TRN document
}

export interface BankDetailsItem {
  enabled: boolean;
  bankName?: string;
  accountName?: string;
  iban?: string;
  accountNumber?: string;
  branch?: string;
  swiftCode?: string;
}

export interface InvoicingSettings {
  showNotes: boolean;
  notesOnInvoice?: string;
  noteOnQuotation?: string;
}

export interface FinancialConfig {
  currency?: string;
  vat?: VatSettings;
  bankDetails?: BankDetailsItem[];
  invoicing?: InvoicingSettings;
  documentTypes?: string[];
  invoiceSequence?: string; // pattern or prefix
  referenceFormat?: string;
  skipDeleted?: boolean;
  paymentReminders?: {
    enabled: boolean;
    invoiceDaysBefore?: number;
    purchaseDaysBefore?: number;
  };
  accounts?: { id: string; name: string }[];
}

export interface HrLeavesConfig {
  types?: string[];
  policy?: string;
  countBasis?: string;
  includeNonWorkingDays?: boolean;
}

export interface HrConfig {
  deductions?: string[];
  additions?: string[];
  advances?: string[];
  leaves?: HrLeavesConfig;
  departments?: string[];
  requestApproval?: "required" | "one_level" | "two_level" | "none";
  reimbursables?: string[];
}

export interface CrmEntitySettings {
  category?: string;
  requirePhone?: boolean;
  requireEmail?: boolean;
  inactiveAfterDays?: number | null; // days after which contact becomes inactive
}

export interface CrmConfig {
  organization?: CrmEntitySettings;
  individual?: CrmEntitySettings;
  channels?: string[];
  locations?: string[];
  documents?: { category?: string; type?: string; renewable?: boolean }[];
  callPurposes?: string[];
  sentiment?: string[];
  showContactRecord?: boolean;
  notes?: string[];
  meetings?: string[];
  jobStages?: string[];
  jobAlert?: { enabled: boolean; days?: number };
}

export interface DealsConfig {
  leadLostIn?: number; // days
  quotationLostIn?: number; // days
  quotationStartsSeq?: string; // prefix or sequence
  proformaStartSeq?: string;
  salesType?: string[];
  salesLocation?: string[];
  fieldLabels?: Record<string, string>;
  dealStages?: string[];
  dealAlert?: { enabled: boolean; days?: number };
}

export interface AppConfigurations {
  legal?: LegalConfig;
  financial?: FinancialConfig;
  hr?: HrConfig;
  crm?: CrmConfig;
  deals?: DealsConfig;
}

export default AppConfigurations;
