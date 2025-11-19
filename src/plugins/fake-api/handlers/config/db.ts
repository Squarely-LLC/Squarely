import type AppConfigurations from "./types";

export interface ConfigDB {
  configurations: AppConfigurations;
}

export const db: ConfigDB = {
  configurations: {
    legal: {
      logo: "/images/avatars/avatar-1.png",
      companyName: "Squarely LLC",
      crn: "CRN-123456789",
      address: "123 Market Street, Suite 400",
      country: "United States",
      city: "San Francisco",
      number: "+1 (415) 555-1234",
      email: "info@squarely.example",
      website: "https://squarely.example",
      socialLinks: [
        "https://twitter.com/squarely",
        "https://linkedin.com/company/squarely",
      ],
      ownership: [
        { id: 1, contactName: "Jane Doe", contactId: 1 },
        { id: 2, contactName: "John Smith", contactId: 2 },
      ],
    },
    financial: {
      currency: "US Dollar (USD $)",
      vat: {
        enabled: true,
        registrationNumber: "VAT-987654321",
        attachDocument: true,
      },
      bankDetails: [
        {
          enabled: true,
          bankName: "Bank of Examples",
          accountName: "Squarely LLC",
          iban: "AE070331234567890123456",
          accountNumber: "1234567890",
          branch: "Downtown",
          swiftCode: "EXAMPL99",
        },
      ],
      invoicing: {
        showNotes: true,
        notesOnInvoice: "Payment due within 30 days.",
        noteOnQuotation: "Prices valid for 14 days from issue date.",
      },
      documentTypes: ["Invoice", "Quotation", "Proforma", "Receipt"],
      invoiceSequence: "INV-YYYY-",
      referenceFormat: "{type}-{seq}",
      skipDeleted: true,
      paymentReminders: {
        enabled: true,
        invoiceDaysBefore: 7,
        purchaseDaysBefore: 10,
      },
      accounts: [
        { id: "acc-1", name: "Cash" },
        { id: "acc-2", name: "Bank" },
        { id: "acc-3", name: "Receivables" },
      ],
    },
    hr: {
      deductions: ["Late Penalty", "Absence"],
      additions: ["Overtime", "Bonus"],
      advances: ["Travel Advance", "Salary Advance"],
      leaves: ["Annual", "Sick", "Unpaid"],
      departments: ["Sales", "Operations", "Finance", "HR"],
      requestApproval: "one_level",
      reimbursables: ["Fuel", "Meals", "Supplies"],
    },
    crm: {
      organization: {
        category: "B2B",
        requirePhone: true,
        requireEmail: true,
        inactiveAfterDays: 90,
      },
      individual: {
        category: "B2C",
        requirePhone: false,
        requireEmail: true,
        inactiveAfterDays: 120,
      },
      channels: ["Email", "Phone", "WhatsApp", "In-person"],
      locations: ["HQ", "Dubai", "Riyadh", "Cairo"],
      documents: [
        { category: "ID", type: "Passport", renewable: true },
        { category: "License", type: "Trade License", renewable: true },
      ],
      callPurposes: ["Follow-up", "New Lead", "Support"],
      sentiment: ["very_poor", "poor", "acceptable", "good", "very_good"],
      showContactRecord: true,
      notes: ["KYC complete", "Send brochure", "Invite to demo"],
      meetings: ["Intro Call", "Demo", "Negotiation"],
      jobStages: ["Lead", "Qualified", "Proposal", "Won", "Lost"],
      jobAlert: { enabled: true, days: 3 },
    },
    deals: {
      leadLostIn: 30,
      quotationLostIn: 45,
      quotationStartsSeq: "QTN-",
      proformaStartSeq: "PF-",
      salesType: ["Retail", "Wholesale"],
      salesLocation: ["Dubai", "Riyadh", "Online"],
      fieldLabels: { amount: "Deal Amount", owner: "Owner" },
      dealStages: [
        "Prospecting",
        "Proposal",
        "Negotiation",
        "Closed Won",
        "Closed Lost",
      ],
      dealAlert: { enabled: true, days: 5 },
    },
  },
};

export default db;
