# Squarely —

built with Vue 3, Vite, Pinia and Vuetify.

This repository contains a feature-rich UI scaffold used by the app. It includes a local fake API powered by MSW for development, a Pinia store layer, utilities for file storage, and a collection of views/components for common admin functionality (configuration panels, dashboards, forms, etc.).

This README explains how to set up, run, and contribute to the project.

## Quick facts
- Framework: Vue 3 + Composition API
- Bundler: Vite
- UI: Vuetify 3
- State: Pinia
- Dev fake API: MSW (Mock Service Worker) under `public/` + `src/plugins/fake-api`
- Package manager: pnpm (recommended)

## Prerequisites
- Node.js (LTS) — recommended: 18.x or newer
- pnpm (used in this workspace)

Install pnpm globally if you don't have it:

```powershell
npm install -g pnpm
```

## Install

Install project dependencies (run from repository root):

```powershell
pnpm install
```

Notes:
- The project uses a `postinstall` script to build icon assets and initialize MSW service worker files. If that step fails, re-run `pnpm run msw:init` and `pnpm run build:icons` manually.

## Useful scripts

- `pnpm run dev` — start dev server (Vite)
- `pnpm run build` — build production bundle
- `pnpm run preview` — preview the production build locally
- `pnpm run typecheck` — run `vue-tsc` type-check
- `pnpm run lint` — run ESLint and attempt autofixes
- `pnpm run build:icons` — build icon assets
- `pnpm run msw:init` — regenerate MSW service worker files in `public/`

Example: start dev server

```powershell
pnpm run dev
```

If you see a `vite`/`esbuild` error during `pnpm run dev`, check the terminal output for the first error and the stack trace. Common fixes: missing environment values, port conflicts, or dependency mismatches.

## Development notes

- The app uses MSW to mock API endpoints for local development. The fake API handlers are under `src/plugins/fake-api/handlers` and are wired to the client during boot in development mode.
- Configuration data (used by the UI) is handled by a Pinia store at `src/stores/config.ts`. The store persists to localStorage and sends updates to the fake API in dev.
- File uploads used for company logos are stored via a small IndexedDB-backed file store (`src/utils/fileStore`), which the fake API uses to return pointer strings (for example `idb:<key>|<encoded-filename>`).
- Country/city helpers use the `country-state-city` package to populate `VAutocomplete` items for country and city selection.

Recommended VS Code setup

- VS Code + Volar extension (enable TypeScript plugin in Volar if you want richer typing for `.vue` files)
- ESLint extension for linting integration

## Project structure (high level)

- `src/` — application source code
	- `main.ts` — app entry
	- `App.vue` — root component
	- `@core/` — core utilities, types, components
	- `plugins/` — Vue plugins and dev helpers (including `fake-api`)
	- `stores/` — Pinia stores (`config.ts`, `notifications.ts`, etc.)
	- `views/` — page-level views (including `apps/configuration/SettingsLegal.vue`)
	- `components/` — shared UI components
- `public/` — static assets and MSW worker files
- `dev.Dockerfile`, `prod.Dockerfile` and `docker-compose.*.yml` — docker configs

## Working with the fake API (MSW)

MSW provides local mocked endpoints which makes development faster and predictable.

- The MSW worker file is generated into `public/` by the `msw init public/ --save` command, which runs automatically on `postinstall`.
- Handlers live in `src/plugins/fake-api/handlers`. For example the configurations handler is at `src/plugins/fake-api/handlers/config/index.ts`.

If you modify or add handlers, regenerate the worker (only needed in some setups):

```powershell
pnpm run msw:init
```

## Running with Docker

There are Dockerfiles for dev and prod and docker-compose files for development and production-like environments. Example (dev compose):

```powershell
docker compose -f docker-compose.dev.yml up --build
```

## Key flows to be aware of

- Configuration editing (views under `src/views/apps/configuration`) uses a card-per-section UI where each card saves only its subset of fields. The fake API and the `config` store are implemented to accept partial updates.
- File uploads for logos use the `saveFile` / `getFileObjectUrl` / `deleteFile` helpers in `src/utils/fileStore` — these interact with IndexedDB during development.

## Linting & formatting

```powershell
pnpm run lint
pnpm run typecheck
```

## Tests

This repository does not ship with a test runner configured by default. If you want to add unit or E2E tests, consider adding Vitest for unit tests and Playwright or Cypress for browser flows. Keep MSW active during tests to stub network calls.

## Troubleshooting

- Dev server crashes with `esbuild` or `vite` errors:
	- Check the terminal for the first error. Often it's a missing import, version mismatch, or a Node version incompatibility.
	- Ensure `pnpm install` completed successfully and `pnpm run msw:init` was run (postinstall usually does this).
- MSW handlers not applied: ensure `public/mockServiceWorker.js` exists and the app bootstraps MSW in dev mode.



## Where to start reading the code

- `src/main.ts` — application setup and plugin initialization
- `src/plugins/fake-api` — MSW handlers and fake API wiring (dev-only)
- `src/stores/config.ts` — configuration store; good entry point to see how config updates are persisted and merged
- `src/views/apps/configuration/SettingsLegal.vue` — example view showing file uploads, per-card save logic, and country/city autocompletes

## License & acknowledgements

This project uses many OSS libraries — check `package.json` for dependency licenses. Include your preferred license file at the repo root if needed.

