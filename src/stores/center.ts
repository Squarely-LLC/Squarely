import type {
  Center,
  CenterMembership,
  CenterSessionContext,
} from "@db/auth/types";
import { syncAbilityRules } from "@/plugins/casl/ability";
import { useContactsStore } from "@/stores/contacts";
import { useEmployeesStore } from "@/stores/employees";
import { useQuotationsStore } from "@/stores/quotations";
import { useTodos } from "@/stores/todos";
import { defineStore } from "pinia";

const getActiveCenterCookie = () => useCookie<number | null>("activeCenterId");
const getCentersCookie = () => useCookie<Center[] | null>("authCenters");
const getMembershipsCookie = () =>
  useCookie<CenterMembership[] | null>("authMemberships");
const getAbilityCookie = () =>
  useCookie<CenterMembership["abilityRules"]>("userAbilityRules");

export const useCenterStore = defineStore("center", {
  state: () => ({
    activeCenterId: null as number | null,
    centers: [] as Center[],
    memberships: [] as CenterMembership[],
    initialized: false,
  }),
  getters: {
    activeCenter: (state) =>
      state.centers.find((center) => center.id === state.activeCenterId) ??
      null,
    activeMembership: (state) =>
      state.memberships.find(
        (membership) => membership.centerId === state.activeCenterId,
      ) ?? null,
  },
  actions: {
    bootstrap() {
      this.activeCenterId = getActiveCenterCookie().value;
      this.centers = getCentersCookie().value ?? [];
      this.memberships = getMembershipsCookie().value ?? [];
      this.initialized = true;
    },
    applyContext(context: CenterSessionContext) {
      this.activeCenterId = context.activeCenterId;
      this.centers = context.centers;
      this.memberships = context.memberships;

      getActiveCenterCookie().value = context.activeCenterId;
      getCentersCookie().value = context.centers;
      getMembershipsCookie().value = context.memberships;
    },
    setActiveCenter(centerId: number | null) {
      this.activeCenterId = centerId;
      getActiveCenterCookie().value = centerId;

      const activeMembership = this.memberships.find(
        (membership) => membership.centerId === centerId,
      );
      const nextAbilityRules = activeMembership?.abilityRules ?? [];

      getAbilityCookie().value = nextAbilityRules;
      syncAbilityRules(nextAbilityRules);

      useContactsStore().init(true);
      useEmployeesStore().init(true);
      useQuotationsStore().init(true);
      useTodos().init();
    },
    clear() {
      this.activeCenterId = null;
      this.centers = [];
      this.memberships = [];
      getActiveCenterCookie().value = null;
      getCentersCookie().value = null;
      getMembershipsCookie().value = null;
    },
  },
});
