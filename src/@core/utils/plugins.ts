import type { App } from "vue";

/**
 * This is helper function to register plugins like a nuxt
 * To register a plugin just export a const function `defineVuePlugin` that takes `app` as argument and call `app.use`
 * For Scanning plugins it will include all files in `src/plugins` and `src/plugins/**\/index.ts`
 *
 *
 * @param {App} app Vue app instance
 *
 * @example
 * ```ts
 * // File: src/plugins/vuetify/index.ts
 *
 * import type { App } from 'vue'
 * import { createVuetify } from 'vuetify'
 *
 * const vuetify = createVuetify({ ... })
 *
 * export default function (app: App) {
 *   app.use(vuetify)
 * }
 * ```
 *
 * All you have to do is use this helper function in `main.ts` file like below:
 * ```ts
 * // File: src/main.ts
 * import { registerPlugins } from '@core/utils/plugins'
 * import { createApp } from 'vue'
 * import App from '@/App.vue'
 *
 * // Create vue app
 * const app = createApp(App)
 *
 * // Register plugins
 * registerPlugins(app) // [!code focus]
 *
 * // Mount vue app
 * app.mount('#app')
 * ```
 */

export const registerPlugins = async (app: App) => {
  const imports = import.meta.glob<{ default: (app: App) => void }>(
    ["../../plugins/*.{ts,js}", "../../plugins/*/index.{ts,js}"],
    { eager: true },
  );

  // NOTE: When migrating to a real backend (Laravel), remove the fake-api plugin
  // folder entirely and delete the MSW service worker from public/.
  // At that point, re-add this filter to exclude it from production:
  //   .filter(path => !(import.meta.env.PROD && path.includes('/plugins/fake-api/')))

  const importPaths = Object.keys(imports).sort((a, b) => {
    const rank = (path: string) => {
      if (path.includes("/plugins/casl/")) return 0;
      if (path.includes("/plugins/2.pinia.")) return 1;
      if (path.includes("/plugins/1.router/")) return 2;

      return 3;
    };

    return rank(a) - rank(b) || a.localeCompare(b);
  });

  const seen = new Set<string>();

  for (const path of importPaths) {
    const normalizedPath = path
      .replace(/\/index\.(ts|js)$/, "")
      .replace(/\.(ts|js)$/, "");

    if (seen.has(normalizedPath)) continue;

    seen.add(normalizedPath);

    const pluginImportModule = imports[path];

    await pluginImportModule.default?.(app);
  }
};
