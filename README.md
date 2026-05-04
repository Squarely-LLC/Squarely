# Squarely

Squarely is a private internal web application for Squarely LLC. It supports day-to-day business workflows across operations, finance, HR, configuration, and related admin tooling.

This repository is proprietary company software. It is not an open-source project, and the code, assets, seeded data, and business rules in this workspace should be treated as internal-only.

## What this repository contains

- Vue 3 single-page application built with Vite and Vuetify
- Pinia stores for app state, seeded records, and browser persistence
- Mock Service Worker (MSW) handlers for local fake API behavior during development
- Feature areas for configuration, contacts, employees, quotations, invoices, receipts, expenses, logistics, and related admin screens
- Docker files for local development and production-style container builds

## Core stack

- Vue 3
- Vite
- TypeScript
- Pinia
- Vuetify 3
- Vue Router
- MSW for local API mocking
- pnpm for dependency management

## Private repository notice

- This repository is intended for authorized Squarely personnel and approved contractors only.
- Do not publish code, screenshots, seed data, or internal documentation from this repository externally.
- Do not add public-facing contribution, licensing, or community workflow language unless leadership explicitly asks for it.

## Prerequisites

- Node.js 18 or newer
- pnpm

Install pnpm globally if needed:

```powershell
npm install -g pnpm
```

## Local setup

Install dependencies from the repository root:

```powershell
pnpm install
```

The install process runs `postinstall`, which builds icon assets and initializes the MSW worker in `public/`.

If postinstall fails, run these commands manually:

```powershell
pnpm run build:icons
pnpm run msw:init
```

## Common commands

- `pnpm run dev` starts the local Vite dev server
- `pnpm run build` builds the production bundle
- `pnpm run preview` previews the production build locally on port `5050`
- `pnpm run typecheck` runs `vue-tsc --noEmit`
- `pnpm run lint` runs ESLint with autofix enabled
- `pnpm run build:icons` regenerates icon assets
- `pnpm run msw:init` regenerates `public/mockServiceWorker.js`

Start local development:

```powershell
pnpm run dev
```

## Application areas

The current codebase includes feature surfaces and supporting stores for workflows such as:

- Contacts and employee management
- Quotations, invoices, receipts, credit notes, debit notes, and proformas
- Expenses and payment vouchers
- Jobs, deals, site surveys, snaglists, and logistics-related views
- Configuration and catalog management
- Calendar, chat, kanban, and other operational utility screens
- Authentication, access-control, and role-oriented UI surfaces

Some areas are fully business-specific, while others are shared admin utilities inherited from the broader app foundation.

## Development model

Local development relies heavily on browser-side persistence plus MSW-backed handlers instead of a required live backend.

- MSW worker assets live in [public/mockServiceWorker.js](public/mockServiceWorker.js)
- Handlers live under [src/plugins/fake-api/handlers](src/plugins/fake-api/handlers)
- Many stores initialize from local storage and re-seed from fake API data when needed
- App bootstrapping and store initialization start in [src/main.ts](src/main.ts)

This means local development is usually self-contained, but it also means storage state can affect behavior between sessions. When debugging, clear browser storage or re-seed affected stores if UI state looks stale.

## Configuration and seeded data

Several modules persist state locally for faster development and repeatable demos.

- Application configuration is managed through [src/stores/config.ts](src/stores/config.ts)
- Fake API records are defined under [src/plugins/fake-api/handlers](src/plugins/fake-api/handlers)
- Static assets and MSW worker files are served from [public](public)

Be careful when changing seed data or persistence keys. Small changes can affect multiple screens that depend on shared local state.

## Project structure

- [src](src) application source
- [src/main.ts](src/main.ts) app bootstrap and plugin registration
- [src/pages](src/pages) route-level pages
- [src/views/apps](src/views/apps) business feature views
- [src/stores](src/stores) Pinia stores and local persistence logic
- [src/plugins](src/plugins) router, Pinia, fake API wiring, and other plugins
- [public](public) static assets and MSW worker output
- [dev.Dockerfile](dev.Dockerfile), [prod.Dockerfile](prod.Dockerfile), [docker-compose.dev.yml](docker-compose.dev.yml), and [docker-compose.prod.yml](docker-compose.prod.yml) container workflows

## Docker

Development example:

```powershell
docker compose -f docker-compose.dev.yml up --build
```

Use the production Docker assets only in approved environments and with company-managed configuration.

## Validation

Before opening an internal PR, run:

```powershell
pnpm run lint
pnpm run typecheck
```

This repository does not currently include a default automated unit or E2E test suite, so linting and type-checking are the minimum expected local validation steps.

## Troubleshooting

- If `pnpm run dev` fails, check the first Vite or esbuild error in the terminal rather than the later cascade.
- If mocked endpoints are missing, regenerate the worker with `pnpm run msw:init`.
- If screens show stale or unexpected data, clear the relevant browser storage and reload.
- If a store appears empty, inspect its fake API seed data and initialization path before assuming the UI is at fault.

## Internal workflow notes

- Treat this repository as proprietary company code.
- Keep documentation focused on internal setup, architecture, and delivery workflow.
- Avoid open-source sections such as community contributions, public issue filing, or repository licensing guidance unless the project direction changes.

