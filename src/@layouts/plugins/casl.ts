import { useAbility } from "@casl/vue";
import type { RouteLocationNormalized } from "vue-router";
import type { NavGroup } from "@layouts/types";

const inferSubjectFromRoute = (route: RouteLocationNormalized) => {
  const name = String(route.name ?? "");
  const path = route.path;

  if (name.startsWith("dashboards-crm") || path.startsWith("/reports"))
    return "reports";
  if (name.startsWith("dashboards") || path.startsWith("/dashboards"))
    return "dashboard";
  if (name.startsWith("apps-todo") || path.startsWith("/apps/todo"))
    return "tasks";
  if (name.startsWith("apps-calendar") || path.startsWith("/apps/calendar"))
    return "calendar";
  if (name.startsWith("apps-contact") || path.startsWith("/apps/contact"))
    return "contacts";
  if (name.startsWith("operations-deals") || path.startsWith("/operations/deals"))
    return "deals";
  if (name.startsWith("operations-jobs") || path.startsWith("/operations/jobs"))
    return "jobs";
  if (name.startsWith("apps-hr") || path.startsWith("/apps/hr"))
    return "hr";
  if (
    name.startsWith("finance") ||
    name.startsWith("apps-invoice") ||
    name.startsWith("apps-quotation") ||
    name.startsWith("apps-proforma") ||
    name.startsWith("apps-receipt") ||
    name.startsWith("apps-expense") ||
    path.startsWith("/finance")
  )
    return "finance";
  if (name.startsWith("catalogues") || path.startsWith("/catalogues"))
    return "catalogue";
  if (
    name.startsWith("configuration") ||
    name.startsWith("settings-users-roles") ||
    path.startsWith("/configuration") ||
    path.startsWith("/settings")
  )
    return name.startsWith("settings-users-roles") ||
      path.startsWith("/settings/users-roles")
      ? "usersRoles"
      : "configuration";

  return null;
};

/**
 * Returns ability result if ACL is configured or else just return true
 * We should allow passing string | undefined to can because for admin ability we omit defining action & subject
 *
 * Useful if you don't know if ACL is configured or not
 * Used in @core files to handle absence of ACL without errors
 *
 * @param {string} action CASL Actions // https://casl.js.org/v4/en/guide/intro#basics
 * @param {string} subject CASL Subject // https://casl.js.org/v4/en/guide/intro#basics
 */
export const can = (
  action: string | undefined,
  subject: string | undefined,
) => {
  const vm = getCurrentInstance();

  if (!vm) return false;

  const localCan = vm.proxy && "$can" in vm.proxy;

  // @ts-expect-error We will get TS error in below line because we aren't using $can in component instance
  return localCan ? vm.proxy?.$can(action, subject) : true;
};

/**
 * Check if user can view item based on it's ability
 * Based on item's action and subject & Hide group if all of it's children are hidden
 * @param {object} item navigation object item
 */
export const canViewNavMenuGroup = (item: NavGroup) => {
  const hasAnyVisibleChild = item.children.some((i) =>
    can(i.action, i.subject),
  );

  // If subject and action is defined in item => Return based on children visibility (Hide group if no child is visible)
  // Else check for ability using provided subject and action along with checking if has any visible child
  if (!(item.action && item.subject)) return hasAnyVisibleChild;

  return can(item.action, item.subject) && hasAnyVisibleChild;
};

export const canNavigate = (to: RouteLocationNormalized) => {
  const ability = useAbility();

  // Get the most specific route (last one in the matched array)
  const targetRoute = to.matched[to.matched.length - 1];

  // If the target route has specific permissions, check those first
  if (targetRoute?.meta?.action && targetRoute?.meta?.subject)
    return ability.can(targetRoute.meta.action, targetRoute.meta.subject);

  // If no specific permissions, fall back to checking if any parent route allows access
  const guardedRoutes = to.matched.filter(
    (route) => route.meta.action && route.meta.subject,
  );
  if (!guardedRoutes.length) {
    const inferredSubject = inferSubjectFromRoute(to);
    return inferredSubject ? ability.can("read", inferredSubject) : true;
  }

  if (
    guardedRoutes.some((route) =>
      ability.can(String(route.meta.action), String(route.meta.subject)),
    )
  )
    return true;

  const inferredSubject = inferSubjectFromRoute(to);
  if (!inferredSubject) return true;

  return ability.can("read", inferredSubject);
};
