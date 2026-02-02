import { createApp } from "vue";

import App from "@/App.vue";
import { store } from "@/plugins/2.pinia";
import { registerPlugins } from "@core/utils/plugins";

// Styles
import "@core/scss/template/index.scss";
import "@styles/styles.scss";

// Create vue app
const app = createApp(App);

// Register plugins
registerPlugins(app);

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

    // register config fake-api handler only when using local /api (not backend)
    const apiBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
    if (!apiBase || apiBase.startsWith("/")) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      try {
        require("@/plugins/fake-api/handlers/config/index") as any;
      } catch {}
    }

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

// Dev-only backend connectivity check (no UI changes)
try {
  if (import.meta.env.DEV && typeof window !== "undefined") {
    import("@/utils/api")
      .then(({ $api }) => $api("/health"))
      .then((res) => {
        // eslint-disable-next-line no-console
        console.info("[api] health ok", res);
      })
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.warn("[api] health failed", error);
      });
  }
} catch {
  // ignore dev-only check failures
}

// Mount vue app
app.mount("#app");
