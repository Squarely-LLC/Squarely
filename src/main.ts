import { createApp } from "vue";

import App from "@/App.vue";
import { store } from "@/plugins/2.pinia";
import { useAuthStore } from "@/stores/auth";
import { useCenterStore } from "@/stores/center";
import { registerPlugins } from "@core/utils/plugins";

// Styles
import "@core/scss/template/index.scss";
import "@styles/styles.scss";

import { router } from "@/plugins/1.router/index";

async function bootstrap() {
  // Create vue app
  const app = createApp(App);

  // Wait for async plugins like MSW before any startup fetches can run.
  await registerPlugins(app);

  const centerStore = useCenterStore(store);
  const authStore = useAuthStore(store);
  centerStore.bootstrap();
  authStore.bootstrap();

  // Centralized contacts initialization (seed canonical DB only if store is empty)
  // Keep this here so pages don't perform destructive seeding.
  try {
    // Import lazily to avoid tree-shake issues and to run only in browser
    if (typeof window !== "undefined") {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { useContactsStore } = require("@/stores/contacts") as any;
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { db: contactsDb } =
        require("@/plugins/fake-api/handlers/apps/contact/db") as any;

      // register config fake-api handler so /api/configurations is available
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      try {
        require("@/plugins/fake-api/handlers/config/index") as any;
      } catch {}

      const contactsStore = useContactsStore(store);
      // init reads from localStorage or seeds from db.users; safe to call
      contactsStore.init();
      if (
        !contactsStore.all ||
        (Array.isArray(contactsStore.all) && contactsStore.all.length === 0)
      ) {
        contactsStore.replaceAll(contactsDb.users || []);
      }
    }
  } catch (error) {
    // non-fatal: skip initialization if something goes wrong at startup
    // console.warn('contacts initialization failed', error);
  }

  // Centralized employees initialization (similar to contacts seeding)
  try {
    if (typeof window !== "undefined") {
      const { useEmployeesStore } = require("@/stores/employees") as any;
      const { db: employeesDb } =
        require("@/plugins/fake-api/handlers/apps/employees/db") as any;

      const employeesStore = useEmployeesStore(store);
      employeesStore.init?.();
      if (
        !employeesStore.all ||
        (Array.isArray(employeesStore.all) && employeesStore.all.length === 0)
      ) {
        employeesStore.replaceAll(employeesDb.users || []);
      }
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    // console.warn('employees initialization failed', error);
  }

  // Centralized quotations initialization (same pattern as contacts/employees)
  // The store migrates old localStorage versions and re-seeds if needed.
  try {
    if (typeof window !== "undefined") {
      const { useQuotationsStore } = require("@/stores/quotations") as any;

      const quotationsStore = useQuotationsStore(store);
      quotationsStore.init();
    }
  } catch (error) {
    // non-fatal: skip if something goes wrong
  }

  // Mount vue app only after the first route is resolved so the
  // HTML loading spinner stays visible until Vue can actually render content.
  await router.isReady();
  app.mount("#app");
}

void bootstrap();
