import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Google({
      // Auth.js v5 otherwise auto-reads AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET;
      // wire our documented env var names explicitly so .env.local works.
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/calendar.events",
          // offline access makes Google issue a refresh token (with prompt
          // "consent" below), so the server can silently renew the short-lived
          // access token instead of forcing the user to sign in every ~hour.
          access_type: "offline",
          // Always show the account chooser (+ consent) so the user picks which
          // Google account to connect, instead of Google auto-selecting the one
          // already signed in.
          prompt: "select_account consent",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // account is only present at sign-in. Persist the tokens + expiry in the
      // (encrypted) JWT; the access token is refreshed on read in the action.
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at; // Unix seconds
        // Record whether the user actually granted the calendar scope
        // (Google lets them decline it on the consent screen — granular consent).
        token.calendarGranted = (account.scope ?? "").includes(
          "https://www.googleapis.com/auth/calendar.events",
        );
      }
      return token;
    },
    async session({ session, token }) {
      // Deliberately do NOT copy the Google access token onto the session:
      // the session is served to the browser at /api/auth/session. The token
      // stays in the encrypted JWT and is read server-side via getToken().
      session.calendarGranted = token.calendarGranted as boolean | undefined;
      return session;
    },
  },
});
