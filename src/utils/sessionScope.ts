import type { UserData } from "@db/auth/types";

export interface SessionScope {
  userId: number | string;
  centerId: number | null;
  scopedCenterId: number | string;
  scopeSuffix: string;
}

export const getCurrentSessionScope = (): SessionScope => {
  const user = useCookie<UserData | null>("userData").value;
  const centerId = useCookie<number | null>("activeCenterId").value;
  const userId = user?.id ?? "guest";
  const scopedCenterId = centerId ?? "none";

  return {
    userId,
    centerId,
    scopedCenterId,
    scopeSuffix: `user.${userId}.center.${scopedCenterId}`,
  };
};

export const buildScopedStorageKey = (baseKey: string) =>
  `${baseKey}.${getCurrentSessionScope().scopeSuffix}`;