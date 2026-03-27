import { setupWorker } from "msw/browser";

// Handlers
import { handlerAppBarSearch } from "@db/app-bar-search/index";
import { handlerAppsAcademy } from "@db/apps/academy/index";
import { handlerAppsCalendar } from "@db/apps/calendar/index";
import { handlerAppsChat } from "@db/apps/chat/index";
import { handlerAppsContacts } from "@db/apps/contact/index";
import { handlerAppsEcommerce } from "@db/apps/ecommerce/index";
import { handlerAppsEmail } from "@db/apps/email/index";
import { handlerAppsEmployees } from "@db/apps/employees/index";
import { handlerAppsInvoice } from "@db/apps/invoice/index";
import { handlerAppsKanban } from "@db/apps/kanban/index";
import { handlerAppLogistics } from "@db/apps/logistics/index";
import { handlerAppsPermission } from "@db/apps/permission/index";
import { handlerAppsUsers } from "@db/apps/users/index";
import { handlerAuth } from "@db/auth/index";
import { handlerConfigurations } from "@db/config/index";
import { handlerDashboard } from "@db/dashboard/index";
import { handlerPagesDatatable } from "@db/pages/datatable/index";
import { handlerPagesFaq } from "@db/pages/faq/index";
import { handlerPagesHelpCenter } from "@db/pages/help-center/index";
import { handlerPagesProfile } from "@db/pages/profile/index";
import { handlerAppsTodos } from "./handlers/apps/todos/data";
import { handlerOperationsJobs } from "./handlers/operations/jobs/index";

const worker = setupWorker(
  ...handlerAppsEcommerce,
  ...handlerAppsAcademy,
  ...handlerAppsInvoice,
  ...handlerAppsUsers,
  ...handlerAppsEmployees,
  ...handlerAppsContacts,
  ...handlerAppsEmail,
  ...handlerAppsCalendar,
  ...handlerAppsChat,
  ...handlerAppsPermission,
  ...handlerPagesHelpCenter,
  ...handlerPagesProfile,
  ...handlerPagesFaq,
  ...handlerPagesDatatable,
  ...handlerAppBarSearch,
  ...handlerConfigurations,
  ...handlerAppLogistics,
  ...handlerAuth,
  ...handlerAppsKanban,
  ...handlerDashboard,
  ...handlerAppsTodos,
  ...handlerOperationsJobs,
);

export default function () {
  if (typeof window === "undefined") return;

  const fakeApiWindow = window as typeof window & {
    __squarelyMswStartPromise?: Promise<unknown>;
  };

  if (fakeApiWindow.__squarelyMswStartPromise) return;

  const workerUrl = `${import.meta.env.BASE_URL ?? "/"}mockServiceWorker.js`;

  fakeApiWindow.__squarelyMswStartPromise = worker.start({
    serviceWorker: {
      url: workerUrl,
    },
    onUnhandledRequest: "bypass",
    quiet: true,
  });
}
