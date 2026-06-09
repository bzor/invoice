# Bzor Invoice

A lean, single-user invoicing app: clients & contacts, estimates & invoices,
PDF generation + email, payment tracking, dashboard, and reports. Built to
replace Harvest with only the features that matter.

**Stack:** Next.js 16 (App Router) · Supabase (Postgres + Auth + Storage) ·
Resend (email) · `@react-pdf/renderer` (PDFs) · Tailwind v4.

## Features

- **Clients & contacts** — name, address, default currency/terms; multiple
  contacts per client with a primary.
- **Estimates & invoices** — line items, discount (amount or %), PO number,
  subject, net terms, notes, and a domestic/international bank-details toggle.
- **Estimate lifecycle** — public share link for the client to Approve/Decline
  (no login), plus one-click **Convert to invoice**.
- **PDF** — download or email (via Resend) from one template; archived in Storage.
- **Payments** — record full/partial payments; status auto-derives to
  partial / paid / overdue.
- **Dashboard** — outstanding, paid last month, and payments YTD, all converted
  to a base currency using each document's FX rate snapshotted at issue date.
- **Reports** — invoiced vs collected by quarter and by client, per year.

## Setup

### 1. Supabase

1. Create a project (free tier is fine). In **Project Settings → API**, copy the
   project URL, the `anon` key, and the `service_role` key.
2. Run the migrations in `supabase/migrations` (in order) against your database —
   paste them into the **SQL editor**, or use the Supabase CLI:
   ```bash
   supabase link --project-ref <ref>
   supabase db push
   ```
   This creates all tables, the numbering/share RPCs, RLS policies, and the
   `documents` (private) + `branding` (public) Storage buckets.
3. **Auth → Providers → Email**: keep email enabled (magic link). Under
   **Auth → URL Configuration**, set the Site URL and add
   `https://<your-domain>/auth/callback` (and `http://localhost:3000/auth/callback`)
   to the redirect allowlist.

### 2. Environment

Copy `.env.example` to `.env.local` and fill in:

| Var | What |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase API |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only; share-link reads + Storage |
| `ALLOWED_EMAIL` | the one email allowed to sign in (`kc@bzor.com`) |
| `RESEND_API_KEY` | Resend API key |
| `RESEND_FROM` | e.g. `Bzor Systems <invoices@bzorsystems.com>` |
| `NEXT_PUBLIC_SITE_URL` | base URL for share links + auth redirects |

### 3. Resend domain

In Resend, add and verify **bzorsystems.com** (Domains → Add → copy the DKIM /
SPF / return-path DNS records into your DNS host). Once verified you can send
from `invoices@bzorsystems.com`.

### 4. Run

```bash
npm install
npm run dev
```

Open http://localhost:3000, sign in with the allowlisted email, then fill in
**Settings** (business info, logo, bank details, numbering) before creating your
first client.

## Deploy (Vercel)

Push to GitHub, import the repo in Vercel, add the same env vars (set
`NEXT_PUBLIC_SITE_URL` to the production URL), and deploy. Update the Supabase
redirect allowlist and `RESEND_FROM`/DNS to match the production domain.

## Notes

- DB types in `src/lib/types.ts` are hand-maintained. After linking the CLI you
  can regenerate them with `supabase gen types typescript` and re-add the
  `Database` generic to the clients in `src/lib/supabase/`.
- FX rates come from Frankfurter (ECB) with an exchangerate.host fallback, and
  are snapshotted on each document at issue date so reports never drift.
