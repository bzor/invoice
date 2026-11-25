# Agent API (`/api/v1`)

A small JSON API so an agent or script outside the browser can do the everyday
things: look up a client, create a draft invoice or estimate, see what is
outstanding, record a payment, send a document. It exists because the web UI is
only reachable with a magic-link session cookie.

The agent-facing reference (endpoints, body fields, working rules) is the
`invoice` skill at `~/.claude/skills/invoice/SKILL.md`, with a curl wrapper
`inv` beside it. This file covers how the API is built and operated.

## Auth

Every request carries `Authorization: Bearer <INVOICE_API_TOKEN>`.

- The token is one shared secret in the `INVOICE_API_TOKEN` env var (Vercel +
  `.env.local`). The same value sits in `~/.config/bzor-invoice/token` (mode 600)
  for the skill's helper.
- If the env var is unset or shorter than 32 characters the API answers 503 for
  everything, rather than run unprotected.
- `src/proxy.ts` lets `/api/v1/*` through without a session; `api()` in
  `src/lib/api.ts` then checks the token on every route. A new route under
  `/api/v1` **must** be wrapped in `api()` or it is public.
- There is no Supabase user behind a token request, so routes run on the
  service-role client (RLS bypassed). The token is therefore as powerful as the
  app itself. Treat a leak like a leaked password: rotate it.

**Rotate:** `openssl rand -hex 32`, set it in Vercel (Production) and redeploy,
then update `.env.local` and `~/.config/bzor-invoice/token`.

## How it shares logic with the web UI

Business logic lives in `src/lib/core/` and takes a Supabase client as its first
argument:

| Core | Web entry (`src/lib/actions/`, session client) | API entry |
| --- | --- | --- |
| `saveDocumentCore` | `saveDocument` | `POST /documents`, `PATCH /documents/:ref` |
| `duplicateDocumentCore` | `duplicateDocument` | `POST …/duplicate` |
| `convertToInvoiceCore` | `convertToInvoice` | `POST …/convert` |
| `recordPaymentCore` | `recordPayment` | `POST …/payments` |
| `sendDocumentCore`, `sendReminderCore` | `sendDocument`, `sendReminder` | `POST …/send`, `…/remind` |

Server actions add `requireUser()`, flash messages and redirects; route handlers
add token auth, input validation and JSON shaping (`src/lib/api-documents.ts`).
Totals, FX snapshot, numbering and status derivation are the same code either
way. The readers in `src/lib/data.ts` take an optional `db` for the same reason.

## Deliberate limits

- **Creates drafts only.** Nothing is emailed until `send` / `remind`, and those
  require `"confirm": true` in the body so an agent cannot send by accident.
- **Edits drafts only.** A document that has gone to a client is changed in the UI.
- **No delete, void, or client/contact writes.** UI only.
- **Overpayments and repeat conversions are refused** unless explicitly forced.
- **Unknown body fields are rejected**, so a misspelled field fails instead of
  being ignored.

## Notes

- A document can be addressed by id or number. Numbers are unique per type only.
- List endpoints page through PostgREST's 1000-row cap (`fetchAll`). The web
  UI's own list queries in `data.ts` do not, and invoices are near that count.
- `POST /documents` defaults `bank_info_mode` to `domestic` for invoices (the web
  editor defaults to `none`), because that is how invoices actually go out.
