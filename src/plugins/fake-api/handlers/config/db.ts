import type AppConfigurations from "./types";

export interface ConfigDB {
  configurations: AppConfigurations;
}

export const db: ConfigDB = {
  configurations: {
    legal: {
      logo: "",
      companyName: "Your Company Name",
      crn: "",
      address: "",
      country: "",
      city: "",
      number: "",
      email: "",
      website: "",
      socialLinks: [],
      ownership: [],
    },
    financial: {
      currency: "USD",
      vat: { enabled: false, registrationNumber: "", attachDocument: false },
      bankDetails: [],
      invoicing: { showNotes: false, notesOnInvoice: "", noteOnQuotation: "" },
      documentTypes: [],
      invoiceSequence: "",
      referenceFormat: "",
      skipDeleted: false,
      paymentReminders: { enabled: false },
      accounts: [],
    },
    hr: {
      deductions: [],
      additions: [],
      advances: [],
      leaves: [],
      departments: [],
      requestApproval: "none",
      reimbursables: [],
    },
    crm: {
      organization: {
        category: "",
        requirePhone: false,
        requireEmail: false,
        inactiveAfterDays: null,
      },
      individual: {
        category: "",
        requirePhone: false,
        requireEmail: false,
        inactiveAfterDays: null,
      },
      channels: [],
      locations: [],
      documents: [],
      callPurposes: [],
      sentiment: [],
      showContactRecord: true,
      notes: [],
      meetings: [],
      jobStages: [],
      jobAlert: { enabled: false },
    },
    deals: {
      leadLostIn: 30,
      quotationLostIn: 30,
      quotationStartsSeq: "",
      proformaStartSeq: "",
      salesType: [],
      salesLocation: [],
      fieldLabels: {},
      dealStages: [],
      dealAlert: { enabled: false },
    },
  },
};

export default db;
