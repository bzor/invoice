# Email deliverability & delivery tracking

How invoice email is authenticated, sent, and tracked. Invoices send from
`invoices@bzorsystems.com` via Resend (note: **not** `bzor.com` — a separate
domain). Production app: `https://invoice.bzorsystems.com`.

## Why this matters

Large enterprise recipients (e.g. agencies running Proofpoint or Microsoft
Defender) silently **quarantine** mail from senders they don't fully trust — the
message shows as "Delivered" in Resend (the receiving server returned 250) but
never reaches the person. The fix is strong authentication plus a published DMARC
policy; the tracking below gives visibility into what actually happened.

## Domain authentication (DNS on `bzorsystems.com`)

| Record | Value | Notes |
| --- | --- | --- |
| SPF / DKIM | (Resend-provided) | Set up when the domain was verified in Resend. DKIM is aligned to the From domain — this is what carries DMARC pass. |
| **DMARC** | `_dmarc.bzorsystems.com` TXT → `v=DMARC1; p=none; rua=mailto:dmarc@bzorsystems.com` | The missing piece that caused enterprise quarantining. `p=none` monitors without enforcing. |

**Follow-up:** after ~2 weeks of clean aggregate (`rua`) reports, tighten the
policy to `p=quarantine` for real spoofing protection.

Verify from the CLI:

```bash
dig +short TXT _dmarc.bzorsystems.com
# → "v=DMARC1; p=none; rua=mailto:dmarc@bzorsystems.com"
```

> DNS-host gotcha: enter the name as `_dmarc` (the host appends the zone). Typing
> the full `_dmarc.bzorsystems.com` in a UI that also appends produces the broken
> `_dmarc.bzorsystems.com.bzorsystems.com`.

## Message hygiene

- Every send goes out as **`multipart/alternative`** (plain-text + HTML). The
  text part is derived from the HTML template by `htmlToText()` in
  `src/lib/email.ts` — HTML-only mail is penalised by most spam filters.

## Delivery tracking (Resend webhook)

Resend accepting a message ("Delivered") is a weak signal for enterprise
recipients. The app records Resend's webhook events so each invoice shows real
delivery state.

**Flow:**

1. On send, `recordSentEmail()` (`src/lib/email-events.ts`) writes a `sent` row to
   the `email_events` table (migration `0004_email_events.sql`), linking Resend's
   message id to the document.
2. Resend POSTs events to `/api/resend-webhook` (`src/app/api/resend-webhook/route.ts`).
   The handler verifies the Svix signature (HMAC-SHA256, via `node:crypto` — no
   new deps), then upserts the event, attributing it to the document via the
   send-time link row. Idempotent on the Svix message id.
3. `getDocument()` embeds `email_events`; the Delivery panel in
   `src/components/document-detail.tsx` renders them (green = delivered/opened,
   red = bounced/complained/failed).

### Setup (per environment)

1. **Migration** — apply `supabase/migrations/0004_email_events.sql`.
2. **Env** — set `RESEND_WEBHOOK_SECRET` (the `whsec_…` Resend gives when you
   create the endpoint). In production this must be set in **Vercel Production**
   env, not just `.env.local`.
3. **Resend → Webhooks → Add endpoint.** URL must be **exactly**:

   ```
   https://invoice.bzorsystems.com/api/resend-webhook
   ```

   Subscribe to the `email.*` events. Handler is defensive about unknown types.

### Endpoint-URL gotchas (these all fail as redirects)

Resend does **not** follow redirects on POST, so the registered URL must hit the
handler directly (returns `400` to an unsigned probe, `200` to a signed event).
Anything that redirects shows up as `307`/`308` "Redirecting…" and fails:

| URL | Result |
| --- | --- |
| `https://invoice.bzorsystems.com/api/resend-webhook` | ✅ reaches handler |
| `…/api/resend-webhook/` (trailing slash) | ❌ 308 |
| `https://bzorsystems.com/…` (apex, not `invoice.`) | ❌ 307 → `www` |
| `http://…` (not https) | ❌ 308 |

The auth proxy (`src/proxy.ts`) also has to exempt this path, or it redirects the
unauthenticated POST to `/login` — see the `isPublic` check.

## Tracking scope: opens/clicks intentionally OFF

Resend's open/click tracking requires a redirect subdomain that **rewrites every
link** — a deliverability risk with enterprise filters (they distrust redirect
domains). We deliberately do **not** enable it. Consequences:

- The Delivery panel shows **Sent → Delivered** (+ Bounced / Marked-as-spam), not
  opens.
- `email.opened` / `email.clicked` never fire; that's expected, not a bug.

`delivered` + no `bounce` is the baseline signal. Do not "fix" missing opens by
enabling tracking without weighing the deliverability tradeoff.
