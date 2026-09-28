// Read the Google access token from the encrypted JWT cookie, server-side only.
// It is never placed on the session, so it never reaches the browser. If the
// access token has expired, silently refresh it with the stored refresh token.

import { headers } from "next/headers";
import { getToken } from "next-auth/jwt";
import { shouldRefresh, refreshGoogleAccessToken } from "./google-auth";

export async function getGoogleAccessToken(): Promise<string | undefined> {
  const req = new Request("http://localhost", { headers: await headers() });
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    secureCookie: process.env.NODE_ENV === "production",
  });
  if (!token) return undefined;

  const accessToken = token.accessToken as string | undefined;
  const expiresAt = token.expiresAt as number | undefined;
  const refreshToken = token.refreshToken as string | undefined;

  if (accessToken && !shouldRefresh(expiresAt)) return accessToken;

  if (refreshToken) {
    const refreshed = await refreshGoogleAccessToken(refreshToken);
    if (refreshed) return refreshed.accessToken;
  }
  // No usable token and refresh failed/unavailable → caller prompts re-sign-in.
  return undefined;
}
