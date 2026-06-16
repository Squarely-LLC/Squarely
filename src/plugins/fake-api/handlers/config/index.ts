import { HttpResponse, http } from "msw";
import { db } from "./db";
import type AppConfigurations from "./types";
import {
  permissionDeniedResponse,
  requireCurrentUserPermission,
} from "@/utils/authorization";

// Minimal local handler types to avoid depending on shared types in the fake-api loader
type HandlerArgs = {
  params?: Record<string, any>;
  query?: Record<string, any>;
  body?: any;
};
type HandlerResult = { status: number; data?: any };

const mergeConfigurations = (patch?: Partial<AppConfigurations>) => {
  if (!patch) return;
  // Perform a shallow merge at the top level, but also merge nested
  // section objects (like `legal`, `financial`, etc.) so callers can
  // send partial updates for a section without replacing the whole
  // section object.
  const existing = db.configurations;
  const merged: Partial<AppConfigurations> = { ...existing };

  for (const key of Object.keys(patch)) {
    const k = key as keyof AppConfigurations;
    const val = (patch as any)[k];

    // If both existing value and patch value are plain objects (not arrays),
    // merge their properties shallowly. Otherwise, replace.
    const existingVal = (existing as any)[k];
    const isPlainObject = (v: any) =>
      v && typeof v === "object" && !Array.isArray(v);

    if (isPlainObject(existingVal) && isPlainObject(val)) {
      merged[k] = { ...(existingVal || {}), ...(val || {}) } as any;
    } else {
      merged[k] = val as any;
    }
  }

  db.configurations = merged as AppConfigurations;
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
  requireCurrentUserPermission("configuration", "update");

  const body = args?.body as Partial<AppConfigurations> | undefined;
  try {
    // eslint-disable-next-line no-console
    console.log("[fake-api] PUT /api/configurations", body);
  } catch {}
  // Merge incoming partial sections so callers can update a subset of fields
  mergeConfigurations(body);
  return { status: 200, data: db.configurations };
};

export const handlerConfigurations = [
  http.get("/api/configurations", () =>
    HttpResponse.json(db.configurations, { status: 200 })
  ),
  http.put("/api/configurations", async ({ request }) => {
    try {
      requireCurrentUserPermission("configuration", "update");
    } catch {
      return permissionDeniedResponse("configuration", "update");
    }

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
