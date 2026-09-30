# Enable Vercel Skew Protection for the web app

- **Date:** 2026-09-30
- **Status:** Accepted
- **Scope:** Deployment / operations (`web/` on Vercel)

## Context

The chat confirm flow calls a Next.js **Server Action** (`executeWrite` in
`web/lib/chat-actions.ts`). Next.js gives each Server Action a content-hashed
ID, so the ID **changes whenever the action's code changes**.

On Vercel, when a new deployment ships while a user still has an older page
open, that stale client posts the **old** action ID, which no longer exists on
the new deployment. The request 404s with:

> Failed to find Server Action "…". This request might be from an older or
> newer deployment.

We hit this for real on 2026-09-30, testing the recurring-events change right
after deploying it: the open `/assistant` tab was running the previous build
and its Confirm button called a since-changed `executeWrite`.

## Decision

Enable **Vercel Skew Protection** (project → Settings → Advanced → Skew
Protection). It pins each browser session to the deployment it originally
loaded, so a client keeps talking to its own version's Server Actions instead
of 404-ing when we ship mid-session.

A **hard reload** (Ctrl+Shift+R) remains the manual recovery for anyone who
does end up on a stale client.

## Consequences

- Open sessions keep running the deployment they loaded for the protection
  window — i.e. slightly older code may serve a user until they reload. That
  trade-off is acceptable for this app; there are no cross-deployment data
  contracts that would break.
- This is a **dashboard toggle, not a code change** — it is not captured in the
  repo other than by this record, so it must be re-enabled if the Vercel
  project is recreated.
- No effect on correctness of writes: `executeWrite` still re-validates every
  argument server-side regardless of which deployment serves it.
