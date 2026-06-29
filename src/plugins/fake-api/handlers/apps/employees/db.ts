import type { EmployeeProperties, EmployeeRequest } from "./types";
import { seedEmployeeId, seedIdentities } from "@/utils/seedIdentityGraph";

interface DB {
  users: EmployeeProperties[];
}

export const db: DB = {
  users: [],
};

const seededEmployeeRequests: Record<number, EmployeeRequest[]> = {
  [seedEmployeeId.lina]: [
    {
      id: 101,
      type: "Leave",
      typeId: "Vacation",
      startDate: "2026-07-06",
      returnDate: "2026-07-08",
      requestedDays: 2,
      deductible: true,
      periodId: "July - 2026",
      reason: "Family appointment",
      status: "pending",
      createdAt: "2026-06-26T08:15:00Z",
    },
    {
      id: 102,
      type: "Deduction",
      deductionType: "Expense correction",
      date: "2026-06-26",
      amount: 75,
      period: "June - 2026",
      notes: "Parking expense correction pending HR manager approval.",
      status: "pending",
      createdAt: "2026-06-26T09:10:00Z",
    },
  ],
  [seedEmployeeId.farah]: [
    {
      id: 201,
      type: "Advance",
      advanceType: "Salary advance",
      date: "2026-06-26",
      amount: 500,
      payBackInMonths: 2,
      startOfPaymentPeriod: "July - 2026",
      notes: "Pending manager approval from Lina.",
      status: "pending",
      createdAt: "2026-06-26T07:45:00Z",
    },
  ],
  [seedEmployeeId.maya]: [
    {
      id: 301,
      type: "Time au Lieu",
      numberOfDays: 1,
      date: "2026-06-27",
      relatedTo: "Weekend support",
      note: "HR weekend onboarding support.",
      status: "pending",
      createdAt: "2026-06-26T10:05:00Z",
    },
  ],
  [seedEmployeeId.omar]: [
    {
      id: 501,
      type: "Addition",
      additionType: "Commission adjustment",
      date: "2026-06-26",
      amount: 250,
      period: "June - 2026",
      relatedType: "Deal",
      relatedId: "DL01",
      notes: "Sales commission adjustment pending Lina approval.",
      status: "pending",
      createdAt: "2026-06-26T11:20:00Z",
    },
  ],
  [seedEmployeeId.imad]: [
    {
      id: 901,
      type: "Leave",
      typeId: "Sick",
      startDate: "2026-06-30",
      returnDate: "2026-07-01",
      requestedDays: 1,
      deductible: false,
      periodId: "June - 2026",
      reason: "Medical checkup",
      status: "pending",
      createdAt: "2026-06-26T12:00:00Z",
    },
  ],
};

const canonicalEmployee = (
  identity: (typeof seedIdentities)[number],
  index: number,
): EmployeeProperties => ({
  id: identity.id,
  fullName: identity.fullName,
  email: identity.email,
  number: `+961 70 900 ${String(identity.id).padStart(3, "0")}`,
  status: "Active",
  picture: identity.avatar,
  accounting: {
    taxId: `EMP-${String(identity.id).padStart(4, "0")}`,
    crn: `HR-${String(identity.id).padStart(4, "0")}`,
    vatNumber: `VAT-HR-${String(identity.id).padStart(4, "0")}`,
  },
  documents: [],
  records: [
    {
      id: identity.id,
      type: "note",
      title: `${identity.roleName} onboarding`,
      body: `${identity.fullName} is seeded as the ${identity.roleName} test account.`,
      author: {
        id: seedEmployeeId.lina,
        name: "Lina Haddad",
      },
      attachments: [],
      createdAt: "2026-01-05T09:00:00Z",
    },
  ],
  transactions: [],
  address: "Squarely Center",
  country: "Lebanon",
  city: "Beirut",
  language: "English",
  channel: identity.worksInSales ? "Direct Sales" : "Referral",
  website: "https://squarely.internal",
  worksInSales: identity.worksInSales,
  createdAt: "2026-01-01T09:00:00Z",
  department: identity.department,
  employment: {
    department: identity.department,
    reportToIds: identity.reportToIds,
    contractStatus: "active",
    startDate: "2026-01-01",
    endDate: null,
    isSalesTeamMember: identity.isSalesTeamMember,
    salesPercentage: identity.isSalesTeamMember ? 5 : 0,
    salesAmount: 0,
    contracts: [
      {
        id: identity.id,
        salaryPaid: "Monthly",
        employmentType: "Full-time",
        startDate: "2026-01-01",
        probationEndDate: "2026-04-01",
        firstPayroll: "2026-01-31",
        note: `${identity.roleName} seed contract`,
        status: "Active",
        createdAt: "2026-01-01T09:00:00Z",
      },
    ],
    positions: [
      {
        id: identity.id,
        position: identity.roleName,
        startingDate: "2026-01-01",
        note: "Canonical ACL seed position",
        createdAt: "2026-01-01T09:00:00Z",
      },
    ],
  },
  salary: {
    currency: "USD",
    history: [
      {
        id: identity.id,
        basicSalary: 3000 + (index + 1) * 250,
        transportation: 250,
        housing: 250,
        allowance: 100,
        date: "01-01-2026",
        startingPeriod: "January - 2026",
        note: "Canonical seed salary",
        createdAt: "2026-01-01T09:00:00Z",
      },
    ],
  },
  paymentMethods: [],
  attendance: {
    vacation: 21,
    sickLeave: 14,
    parentalLeave: 60,
    carryoverDays: 0,
    workSchedule: {
      Monday: { active: true, remote: false, from: "09:00", to: "18:00" },
      Tuesday: { active: true, remote: false, from: "09:00", to: "18:00" },
      Wednesday: { active: true, remote: false, from: "09:00", to: "18:00" },
      Thursday: { active: true, remote: false, from: "09:00", to: "18:00" },
      Friday: { active: true, remote: true, from: "09:00", to: "17:00" },
      Saturday: { active: false, remote: false, from: "09:00", to: "17:00" },
      Sunday: { active: false, remote: false, from: "09:00", to: "17:00" },
    },
    allowedExtraTime: 12,
  },
  requests: seededEmployeeRequests[identity.id] ?? [],
});

db.users = seedIdentities.map(canonicalEmployee);
