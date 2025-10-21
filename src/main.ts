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

// Mount vue app
app.mount("#app");
