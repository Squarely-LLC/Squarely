import avatar1 from "@images/avatars/avatar-1.png";
import avatar2 from "@images/avatars/avatar-2.png";
import avatar3 from "@images/avatars/avatar-3.png";
import avatar4 from "@images/avatars/avatar-4.png";
import avatar5 from "@images/avatars/avatar-5.png";
import avatar6 from "@images/avatars/avatar-6.png";
import avatar7 from "@images/avatars/avatar-7.png";
import avatar8 from "@images/avatars/avatar-8.png";

export const ROLE_TEST_USER_PASSWORD = "SquarelyRoleTest#2026";

export type SeedIdentity = {
  id: number;
  roleId: string;
  roleName: string;
  fullName: string;
  username: string;
  email: string;
  avatar: string;
  department: string;
  worksInSales: boolean;
  isSalesTeamMember: boolean;
  reportToIds: number[];
};

export const seedEmployeeId = {
  lina: 101,
  farah: 102,
  maya: 103,
  nour: 104,
  omar: 105,
  rania: 106,
  karim: 107,
  sara: 108,
  imad: 109,
  layla: 110,
} as const;

export const seedIdentities: SeedIdentity[] = [
  {
    id: seedEmployeeId.lina,
    roleId: "account-owner-super-admin",
    roleName: "Account Owner / Super Admin",
    fullName: "Lina Haddad",
    username: "lina",
    email: "admin@demo.com",
    avatar: avatar1,
    department: "Executive",
    worksInSales: true,
    isSalesTeamMember: true,
    reportToIds: [seedEmployeeId.maya],
  },
  {
    id: seedEmployeeId.farah,
    roleId: "admin",
    roleName: "Admin",
    fullName: "Farah Mansour",
    username: "admin",
    email: "admin@squarely.test",
    avatar: avatar2,
    department: "Operations",
    worksInSales: false,
    isSalesTeamMember: false,
    reportToIds: [seedEmployeeId.lina],
  },
  {
    id: seedEmployeeId.maya,
    roleId: "hr-manager",
    roleName: "HR Manager",
    fullName: "Maya Rahal",
    username: "hr-manager",
    email: "hr-manager@squarely.test",
    avatar: avatar3,
    department: "HR",
    worksInSales: false,
    isSalesTeamMember: false,
    reportToIds: [seedEmployeeId.lina],
  },
  {
    id: seedEmployeeId.nour,
    roleId: "hr-executive",
    roleName: "HR Executive",
    fullName: "Nour Yazbek",
    username: "hr-executive",
    email: "hr-executive@squarely.test",
    avatar: avatar4,
    department: "HR",
    worksInSales: false,
    isSalesTeamMember: false,
    reportToIds: [seedEmployeeId.maya],
  },
  {
    id: seedEmployeeId.omar,
    roleId: "sales-manager",
    roleName: "Sales Manager",
    fullName: "Omar Nasser",
    username: "sales-manager",
    email: "sales-manager@squarely.test",
    avatar: avatar5,
    department: "Sales",
    worksInSales: true,
    isSalesTeamMember: true,
    reportToIds: [seedEmployeeId.lina],
  },
  {
    id: seedEmployeeId.rania,
    roleId: "sales-executive",
    roleName: "Sales Executive",
    fullName: "Rania Abdul",
    username: "sales-executive",
    email: "sales-executive@squarely.test",
    avatar: avatar6,
    department: "Sales",
    worksInSales: true,
    isSalesTeamMember: true,
    reportToIds: [seedEmployeeId.omar],
  },
  {
    id: seedEmployeeId.karim,
    roleId: "operation-manager",
    roleName: "Operation Manager",
    fullName: "Karim Haddad",
    username: "operation-manager",
    email: "operation-manager@squarely.test",
    avatar: avatar7,
    department: "Operations",
    worksInSales: false,
    isSalesTeamMember: false,
    reportToIds: [seedEmployeeId.farah],
  },
  {
    id: seedEmployeeId.sara,
    roleId: "operation-executive",
    roleName: "Operation Executive",
    fullName: "Sara Mansour",
    username: "operation-executive",
    email: "operation-executive@squarely.test",
    avatar: avatar8,
    department: "Operations",
    worksInSales: false,
    isSalesTeamMember: false,
    reportToIds: [seedEmployeeId.karim],
  },
  {
    id: seedEmployeeId.imad,
    roleId: "auditor",
    roleName: "Auditor",
    fullName: "Imad Khoury",
    username: "auditor",
    email: "auditor@squarely.test",
    avatar: avatar5,
    department: "Finance",
    worksInSales: false,
    isSalesTeamMember: false,
    reportToIds: [seedEmployeeId.lina],
  },
  {
    id: seedEmployeeId.layla,
    roleId: "finance-executive",
    roleName: "Finance Executive",
    fullName: "Layla Saab",
    username: "finance-executive",
    email: "finance-executive@squarely.test",
    avatar: avatar6,
    department: "Finance",
    worksInSales: false,
    isSalesTeamMember: false,
    reportToIds: [seedEmployeeId.imad],
  },
];

export const seedIdentityByRoleId = new Map(
  seedIdentities.map((identity) => [identity.roleId, identity]),
);

export const seedIdentityByEmail = new Map(
  seedIdentities.map((identity) => [identity.email.toLowerCase(), identity]),
);

export const seedEmployeeIds = seedIdentities.map((identity) => identity.id);

export const seedAuthorRef = (id: number) => {
  const identity = seedIdentities.find((entry) => entry.id === id) ?? seedIdentities[0];

  return {
    id: identity.id,
    accountId: identity.id,
    employeeId: identity.id,
    personId: identity.id,
    name: identity.fullName,
    email: identity.email,
    avatarUrl: identity.avatar,
  };
};
