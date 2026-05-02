import { getUserByAccessToken } from "@db/auth/db";

const readCookieValue = (request: Request, cookieName: string) => {
  const cookieHeader = request.headers.get("cookie") || "";
  const cookieMatch = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${cookieName}=([^;]+)`),
  );

  return cookieMatch?.[1] ? decodeURIComponent(cookieMatch[1]) : null;
};

export const readAccessToken = (request: Request) => {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) return authorization.slice(7);

  return readCookieValue(request, "accessToken");
};

export const getRequestScope = (request: Request) => {
  const token = readAccessToken(request);
  const user = getUserByAccessToken(token);
  const centerCookie = readCookieValue(request, "activeCenterId");
  const parsedCenterId = centerCookie == null ? null : Number(centerCookie);

  return {
    userId: user?.id ?? null,
    centerId:
      centerCookie != null && Number.isFinite(parsedCenterId)
        ? parsedCenterId
        : (user?.currentCenterId ?? 1),
  };
};

export const inCenterScope = (
  item: { centerId?: number | null } | null | undefined,
  centerId: number | null,
) => {
  const itemCenterId = item?.centerId ?? 1;
  return centerId == null ? true : Number(itemCenterId) === Number(centerId);
};