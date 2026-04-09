import VueI18nPlugin from "@intlify/unplugin-vue-i18n/vite";
import vue from "@vitejs/plugin-vue";
import vueJsx from "@vitejs/plugin-vue-jsx";
import { fileURLToPath } from "node:url";
import { visualizer } from "rollup-plugin-visualizer";
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import {
  VueRouterAutoImports,
  getPascalCaseRouteName,
} from "unplugin-vue-router";
import VueRouter from "unplugin-vue-router/vite";
import { defineConfig } from "vite";
import { compression } from "vite-plugin-compression2";
import MetaLayouts from "vite-plugin-vue-meta-layouts";
import vuetify from "vite-plugin-vuetify";
import svgLoader from "vite-svg-loader";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    // Docs: https://github.com/posva/unplugin-vue-router
    // ?,1?,? This plugin should be placed before vue plugin
    VueRouter({
      getRouteName: (routeNode) => {
        // Convert pascal case to kebab case
        return getPascalCaseRouteName(routeNode)
          .replace(/([a-z\d])([A-Z])/g, "$1-$2")
          .toLowerCase();
      },
      beforeWriteFiles: (root) => {
        root.insert("/apps/email/:filter", "/src/pages/apps/email/index.vue");
        root.insert("/apps/email/:label", "/src/pages/apps/email/index.vue");
      },
    }),
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) =>
            tag === "swiper-container" || tag === "swiper-slide",
        },
      },
    }),
    // VueDevTools(), // Temporarily disabled due to localStorage error
    vueJsx(),
    // Docs: https://github.com/vuetifyjs/vuetify-loader/tree/master/packages/vite-plugin
    vuetify({
      styles: {
        configFile: "src/assets/styles/variables/_vuetify.scss",
      },
    }),

    // Docs: https://github.com/dishait/vite-plugin-vue-meta-layouts?tab=readme-ov-file
    MetaLayouts({
      target: "./src/layouts",
      defaultLayout: "default",
    }),

    // Docs: https://github.com/antfu/unplugin-vue-components#unplugin-vue-components
    Components({
      dirs: ["src/@core/components", "src/components"],
      dts: true,
      resolvers: [
        (componentName) => {
          // Auto import `VueApexCharts`
          if (componentName === "VueApexCharts")
            return {
              name: "default",
              from: "vue3-apexcharts",
              as: "VueApexCharts",
            };
        },
      ],
    }),

    // Docs: https://github.com/antfu/unplugin-auto-import#unplugin-auto-import
    AutoImport({
      imports: [
        "vue",
        VueRouterAutoImports,
        "@vueuse/core",
        "@vueuse/math",
        "vue-i18n",
        "pinia",
      ],
      dirs: [
        "./src/@core/utils",
        "./src/@core/composable/",
        "./src/composables/",
        "./src/utils/",
        "./src/plugins/*/composables/*",
      ],
      vueTemplate: true,

      // ?,1?,? Disabled to avoid confusion & accidental usage
      ignore: ["useCookies", "useStorage"],
    }),

    // Docs: https://github.com/intlify/bundle-tools/tree/main/packages/unplugin-vue-i18n#intlifyunplugin-vue-i18n
    VueI18nPlugin({
      runtimeOnly: true,
      compositionOnly: true,
      include: [
        fileURLToPath(
          new URL("./src/plugins/i18n/locales/**", import.meta.url),
        ),
      ],
    }),
    svgLoader(),

    // Pre-compress assets for Netlify/Vercel (gzip + brotli)
    compression({ algorithm: "gzip", exclude: [/\.(br)$/i] }),
    compression({ algorithm: "brotliCompress", exclude: [/\.(gz)$/i] }),

    // Bundle analyzer (run with ANALYZE=true pnpm build)
    process.env.ANALYZE
      ? visualizer({
          open: true,
          filename: "dist/stats.html",
          gzipSize: true,
          brotliSize: true,
        })
      : undefined,
  ].filter(Boolean),
  define: {
    "process.env": {},
    __VUE_PROD_DEVTOOLS__: false,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@themeConfig": fileURLToPath(
        new URL("./themeConfig.ts", import.meta.url),
      ),
      "@core": fileURLToPath(new URL("./src/@core", import.meta.url)),
      "@layouts": fileURLToPath(new URL("./src/@layouts", import.meta.url)),
      "@images": fileURLToPath(
        new URL("./src/assets/images/", import.meta.url),
      ),
      "@styles": fileURLToPath(
        new URL("./src/assets/styles/", import.meta.url),
      ),
      "@configured-variables": fileURLToPath(
        new URL(
          "./src/assets/styles/variables/_template.scss",
          import.meta.url,
        ),
      ),
      "@db": fileURLToPath(
        new URL("./src/plugins/fake-api/handlers/", import.meta.url),
      ),
      "@api-utils": fileURLToPath(
        new URL("./src/plugins/fake-api/utils/", import.meta.url),
      ),
    },
  },
  build: {
    chunkSizeWarningLimit: 500,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Core Vue ecosystem — cached long-term, rarely changes
          if (
            id.includes("node_modules/vue/") ||
            id.includes("node_modules/@vue/") ||
            id.includes("node_modules/vue-router/") ||
            id.includes("node_modules/pinia/") ||
            id.includes("node_modules/@vueuse/")
          ) {
            return "vendor-vue";
          }

          // Vuetify — largest single dependency
          if (id.includes("node_modules/vuetify/")) {
            return "vendor-vuetify";
          }

          // Charting libraries — only needed on chart/dashboard pages
          if (
            id.includes("node_modules/apexcharts/") ||
            id.includes("node_modules/vue3-apexcharts/") ||
            id.includes("node_modules/chart.js/") ||
            id.includes("node_modules/vue-chartjs/")
          ) {
            return "vendor-charts";
          }

          // Rich text editor — only needed on editor pages
          if (id.includes("node_modules/@tiptap/")) {
            return "vendor-editor";
          }

          // Maps — only needed on logistics/map pages
          if (id.includes("node_modules/mapbox-gl/")) {
            return "vendor-maps";
          }

          // Video player — only needed on video pages
          if (
            id.includes("node_modules/video.js/") ||
            id.includes("node_modules/@videojs-player/")
          ) {
            return "vendor-media";
          }

          // Calendar — only needed on calendar pages
          if (id.includes("node_modules/@fullcalendar/")) {
            return "vendor-calendar";
          }

          // Phone input libraries (excluding heavy city data)
          if (
            id.includes("node_modules/intl-tel-input/") ||
            id.includes("node_modules/libphonenumber-js/") ||
            id.includes("node_modules/vue3-tel-input/") ||
            id.includes("node_modules/flag-icons/")
          ) {
            return "vendor-phone";
          }

          // country-state-city is ~8MB (city databases) — isolate it
          if (id.includes("node_modules/country-state-city/")) {
            return "vendor-geodata";
          }

          // Icon system
          if (id.includes("node_modules/@iconify/")) {
            return "vendor-icons";
          }

          // i18n
          if (
            id.includes("node_modules/vue-i18n/") ||
            id.includes("node_modules/@intlify/")
          ) {
            return "vendor-i18n";
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  optimizeDeps: {
    exclude: ["vuetify"],
    entries: ["./src/**/*.vue"],
    include: [
      "msw/browser",
      "msw",
      "webfontloader",
      "@antfu/utils",
      "@casl/ability",
      "unplugin-vue-router/data-loaders/basic",
      "@sindresorhus/is",
      "destr",
      "cookie-es",
      "vue3-apexcharts",
      "ofetch",
      "apexcharts",
      "pinia",
      "vue-i18n",
      "@vueuse/core",
      "@vueuse/math",
      "vue-router",
      "vue3-perfect-scrollbar",
      "vue-flatpickr-component",
      "prismjs",
      "jwt-decode",
      "shepherd.js",
    ],
  },
});
