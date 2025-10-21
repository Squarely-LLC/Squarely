import { HttpResponse, http } from "msw";
import { db } from "./db";
import type AppConfigurations from "./types";

// Minimal local handler types to avoid depending on shared types in the fake-api loader
type HandlerArgs = {
  params?: Record<string, any>;
  query?: Record<string, any>;
  body?: any;
};
type HandlerResult = { status: number; data?: any };

const mergeConfigurations = (patch?: Partial<AppConfigurations>) => {
  db.configurations = { ...db.configurations, ...(patch || {}) };
};

// GET /api/configurations
export const getConfigurations = (_args: HandlerArgs): HandlerResult => {
  try {
    // eslint-disable-next-line no-console
    console.log("[fake-api] GET /api/configurations");
  } catch {}
  return {
    status: 200,
    data: db.configurations,
  };
};

// PUT /api/configurations
export const updateConfigurations = (args: HandlerArgs): HandlerResult => {
  const body = args?.body as Partial<AppConfigurations> | undefined;
  try {
    // eslint-disable-next-line no-console
    console.log("[fake-api] PUT /api/configurations", body);
  } catch {}
  // Shallow merge allows callers to update individual sections without refetching everything
  mergeConfigurations(body);
  return { status: 200, data: db.configurations };
};

export const handlerConfigurations = [
  http.get("/api/configurations", () =>
    HttpResponse.json(db.configurations, { status: 200 })
  ),
  http.put("/api/configurations", async ({ request }) => {
    const body = (await request
      .json()
      .catch(() => ({}))) as Partial<AppConfigurations>;
    try {
      // eslint-disable-next-line no-console
      console.log("[fake-api] service-worker PUT /api/configurations", body);
    } catch {}
    mergeConfigurations(body);
    return HttpResponse.json(db.configurations, { status: 200 });
  }),
];

export default {
  get: getConfigurations,
  put: updateConfigurations,
};
