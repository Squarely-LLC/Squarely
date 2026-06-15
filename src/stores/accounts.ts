import type { EmployeeProperties } from "@/plugins/fake-api/handlers/apps/employees/types";
import { useEmployeesStore } from "@/stores/employees";
import {
  buildAbilityRules,
  currentCenterId,
  currentCenterName,
  hasRolePermission,
  loadAccountRoleState,
  publicUser,
  saveAccountRoleState,
  seedAccountRoleState,
  type AccountStatus,
  type AccountUserRecord,
  type PermissionAction,
  type PermissionModule,
  type RoleRecord,
} from "@/utils/accountRoles";
import { defineStore } from "pinia";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const normalizeEmail = (email?: string | null) =>
  String(email ?? "")
    .trim()
    .toLowerCase();

const usernameFromEmail = (email: string) =>
  email.split("@")[0]?.replace(/[^a-z0-9_.-]/gi, "") || "user";

export interface AccountUserPayload {
  fullName: string;
  email: string;
  roleId: string;
  status?: AccountStatus;
  password?: string;
  temporaryPassword?: boolean;
  avatar?: string | null;
}

export interface RolePayload {
  name: string;
  permissions?: RoleRecord["permissions"];
}

const roleIdFromName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const useAccountsStore = defineStore("accounts", {
  state: () => ({
    roles: [] as RoleRecord[],
    users: [] as AccountUserRecord[],
    initialized: false,
  }),
  getters: {
    centerId: () => currentCenterId(),
    centerName: () => currentCenterName(),
    roleById: (state) => (id?: string | null) =>
      state.roles.find((role) => role.id === id) ?? null,
    userById: (state) => (id?: number | string | null) =>
      state.users.find((user) => String(user.id) === String(id)) ?? null,
    userByEmail: (state) => (email?: string | null) => {
      const normalized = normalizeEmail(email);
      return (
        state.users.find((user) => normalizeEmail(user.email) === normalized) ??
        null
      );
    },
    currentCenterUsers: (state) =>
      state.users.filter((user) => user.centerId === currentCenterId()),
    currentCenterRoles: (state) =>
      state.roles.filter((role) => role.centerId === currentCenterId()),
  },
  actions: {
    init(force = false) {
      if (this.initialized && !force) return;
      const state = loadAccountRoleState();
      this.roles = state.roles;
      this.users = state.users;
      this.initialized = true;
      this.ensureMasterAccount();
    },

    persist() {
      saveAccountRoleState({ roles: this.roles, users: this.users });
    },

    resetToSeed() {
      const seeded = seedAccountRoleState();
      this.roles = seeded.roles;
      this.users = seeded.users;
      this.initialized = true;
      this.persist();
    },

    ensureMasterAccount() {
      const centerId = currentCenterId();
      const masterRole = this.roles.find(
        (role) => role.name === "Account Owner / Super Admin",
      );
      if (!masterRole) return;

      const existing = this.users.find(
        (user) => user.centerId === centerId && user.isMaster,
      );
      if (existing) return;

      const seededMaster = seedAccountRoleState().users[0];
      this.users.unshift({ ...seededMaster, centerId, roleId: masterRole.id });
      this.persist();
    },

    roleForUser(user?: AccountUserRecord | null) {
      if (!user) return null;
      return this.roles.find((role) => role.id === user.roleId) ?? null;
    },

    abilityRulesForUser(user?: AccountUserRecord | null) {
      return buildAbilityRules(this.roleForUser(user));
    },

    can(
      user: AccountUserRecord | null | undefined,
      module: PermissionModule,
      action: PermissionAction = "read",
    ) {
      return hasRolePermission(this.roleForUser(user), module, action);
    },

    ensureEmployeeForAccount(payload: AccountUserPayload) {
      const employeesStore = useEmployeesStore();
      employeesStore.init();
      const email = normalizeEmail(payload.email);
      const existing = employeesStore.all.find(
        (employee) => normalizeEmail(employee.email) === email,
      );
      if (existing) return existing;

      const created = employeesStore.addEmployee({
        fullName: payload.fullName,
        email,
        number: "",
        status: "Active",
        picture: payload.avatar || undefined,
        accounting: {},
        documents: [],
        records: [],
        transactions: [],
        channel: "Direct Sales",
        worksInSales: false,
        createdAt: new Date().toISOString(),
        employment: {
          department: "Management",
          contractStatus: "draft",
          startDate: new Date().toISOString().slice(0, 10),
          endDate: null,
          isSalesTeamMember: false,
        },
      } as Partial<EmployeeProperties>);

      return created;
    },

    createUser(
      payload: AccountUserPayload,
      createdBy?: number | string | null,
    ) {
      this.init();
      const email = normalizeEmail(payload.email);
      if (!email) throw new Error("Email is required.");
      if (this.users.some((user) => normalizeEmail(user.email) === email))
        throw new Error("A user with this email already exists.");

      const role = this.roleById(payload.roleId);
      if (!role) throw new Error("Role is required.");

      const employee = this.ensureEmployeeForAccount({ ...payload, email });
      const now = new Date().toISOString();
      const nextId =
        Math.max(0, ...this.users.map((user) => Number(user.id) || 0)) + 1;
      const user: AccountUserRecord = {
        id: nextId,
        centerId: currentCenterId(),
        employeeId: employee.id,
        personId: employee.id,
        fullName: payload.fullName.trim(),
        username: usernameFromEmail(email),
        email,
        password: payload.password?.trim() || `Temp#${nextId}Squarely`,
        roleId: role.id,
        status: payload.status ?? "active",
        avatar: payload.avatar || employee.picture || null,
        temporaryPassword: payload.temporaryPassword ?? true,
        createdBy: createdBy ?? null,
        isMaster: false,
        createdAt: now,
        updatedAt: now,
      };

      this.users.unshift(user);
      this.persist();
      return clone(user);
    },

    createRole(payload: RolePayload) {
      this.init();
      const name = payload.name.trim();
      if (!name) throw new Error("Role name is required.");
      if (
        this.roles.some(
          (role) =>
            role.centerId === currentCenterId() &&
            role.name.toLowerCase() === name.toLowerCase(),
        )
      )
        throw new Error("A role with this name already exists.");

      const template =
        this.roles.find((role) => role.name === "Admin") ?? this.roles[0];
      if (!template) throw new Error("A role template is required.");

      const baseId = roleIdFromName(name);
      let id = baseId;
      let suffix = 2;
      while (this.roles.some((role) => role.id === id)) {
        id = `${baseId}-${suffix}`;
        suffix += 1;
      }

      const now = new Date().toISOString();
      const role: RoleRecord = {
        id,
        centerId: currentCenterId(),
        name,
        permissions: clone(payload.permissions ?? template.permissions),
        system: false,
        createdAt: now,
        updatedAt: now,
      };

      this.roles.push(role);
      this.persist();
      return clone(role);
    },

    updateRole(id: string, patch: RolePayload) {
      this.init();
      const index = this.roles.findIndex((role) => role.id === id);
      if (index === -1) throw new Error("Role not found.");

      const current = this.roles[index];
      if (current.name === "Account Owner / Super Admin")
        throw new Error("The master role cannot be changed.");

      const name = patch.name.trim();
      if (!name) throw new Error("Role name is required.");
      if (
        this.roles.some(
          (role) =>
            role.id !== id &&
            role.centerId === current.centerId &&
            role.name.toLowerCase() === name.toLowerCase(),
        )
      )
        throw new Error("A role with this name already exists.");

      this.roles.splice(index, 1, {
        ...current,
        name,
        permissions: clone(patch.permissions ?? current.permissions),
        updatedAt: new Date().toISOString(),
      });
      this.persist();
      return clone(this.roles[index]);
    },

    deleteRole(id: string) {
      this.init();
      const index = this.roles.findIndex((role) => role.id === id);
      if (index === -1) return;
      const role = this.roles[index];
      if (role.name === "Account Owner / Super Admin")
        throw new Error("The master role cannot be deleted.");
      if (this.users.some((user) => user.roleId === id))
        throw new Error("This role is assigned to users and cannot be deleted.");

      this.roles.splice(index, 1);
      this.persist();
    },

    updateUser(id: number | string, patch: Partial<AccountUserPayload>) {
      this.init();
      const index = this.users.findIndex(
        (user) => String(user.id) === String(id),
      );
      if (index === -1) throw new Error("User not found.");
      const current = this.users[index];

      if (current.isMaster) {
        if (patch.roleId && patch.roleId !== current.roleId)
          throw new Error("The master account role cannot be changed.");
        if (patch.status && patch.status !== current.status)
          throw new Error("The master account cannot be deactivated.");
      }

      if (
        patch.email &&
        normalizeEmail(patch.email) !== normalizeEmail(current.email)
      ) {
        const nextEmail = normalizeEmail(patch.email);
        if (
          this.users.some(
            (user) =>
              user.id !== current.id &&
              normalizeEmail(user.email) === nextEmail,
          )
        )
          throw new Error("A user with this email already exists.");
        current.email = nextEmail;
        current.username = usernameFromEmail(nextEmail);
      }

      if (patch.fullName !== undefined) current.fullName = patch.fullName;
      if (patch.roleId !== undefined) current.roleId = patch.roleId;
      if (patch.status !== undefined) current.status = patch.status;
      if (patch.password !== undefined && patch.password.trim()) {
        current.password = patch.password.trim();
        current.temporaryPassword = patch.temporaryPassword ?? false;
      }
      if (patch.avatar !== undefined) current.avatar = patch.avatar;
      current.updatedAt = new Date().toISOString();
      this.persist();
      return clone(current);
    },

    deleteUser(id: number | string) {
      this.init();
      const index = this.users.findIndex(
        (user) => String(user.id) === String(id),
      );
      if (index === -1) return;
      if (this.users[index].isMaster)
        throw new Error("The master account cannot be deleted.");
      this.users.splice(index, 1);
      this.persist();
    },

    publicUser(user: AccountUserRecord) {
      return publicUser(user, this.roleForUser(user) ?? undefined);
    },
  },
});
