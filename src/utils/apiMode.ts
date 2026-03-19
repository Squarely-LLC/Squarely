const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;

export const remoteApiEnabled = import.meta.env.VITE_USE_REMOTE_API === "true";

export const apiBaseUrl =
  remoteApiEnabled && rawApiBaseUrl
    ? rawApiBaseUrl.replace(/\/+$/, "")
    : "/api";
