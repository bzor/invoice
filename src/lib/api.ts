import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import { amountPaid } from "@/lib/data";
import { siteUrl } from "@/lib/env";
import { round2 } from "@/lib/money";
import { effectiveStatus } from "@/lib/status";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Db } from "@/lib/supabase/db";
import type { DocStatus, DocType, DocumentRow } from "@/lib/types";

// Plumbing for the token-authenticated JSON API under /api/v1, used by agents
// and scripts outside the browser. Requests carry `Authorization: Bearer
// <INVOICE_API_TOKEN>` and run against the service-role client, since there is
// no Supabase session. See docs/agent-api.md.

/** An error whose message is safe to return to the caller with `status`. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

const sha256 = (s: string) => createHash("sha256").update(s).digest();

function authorize(request: Request) {
  const expected = process.env.INVOICE_API_TOKEN ?? "";
  // Refuse to run with a missing or guessable token rather than fail open.
  if (expected.length < 32) {
    throw new ApiError(503, "API is not configured (INVOICE_API_TOKEN unset)");
  }
  const header = request.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  // Hash both sides so the comparison is constant-time at any length.
  if (!given || !timingSafeEqual(sha256(given), sha256(expected))) {
    throw new ApiError(401, "Missing or invalid bearer token");
  }
}

type Handler<P> = (ctx: {
  request: Request;
  params: P;
  db: Db;
  url: URL;
}) => Promise<Response | object>;

/**
 * Wrap a route handler: check the bearer token, hand it a service-role client,
 * JSON-encode a plain-object return, and turn thrown errors into JSON errors.
 */
export function api<P = Record<string, never>>(handler: Handler<P>) {
  return async (request: Request, context: { params: Promise<P> }) => {
    try {
      authorize(request);
      const result = await handler({
        request,
        params: await context.params,
        db: createAdminClient(),
        url: new URL(request.url),
      });
      return result instanceof Response ? result : Response.json(result);
    } catch (e) {
      if (e instanceof ApiError) {
        return Response.json(
          { error: e.message, ...e.extra },
          { status: e.status },
        );
      }
      console.error("[api]", e);
      const message = e instanceof Error ? e.message : "Internal error";
      return Response.json({ error: message }, { status: 500 });
    }
  };
}

/** Parse a JSON object body, or throw a 400. */
export async function readBody(
  request: Request,
): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (!text.trim()) return {};
  try {
    const body: unknown = JSON.parse(text);
    if (body && typeof body === "object" && !Array.isArray(body)) {
      return body as Record<string, unknown>;
    }
  } catch {
    // fall through
  }
  throw new ApiError(400, "Body must be a JSON object");
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: unknown): s is string =>
  typeof s === "string" && UUID.test(s);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export const isIsoDate = (s: unknown): s is string =>
  typeof s === "string" &&
  ISO_DATE.test(s) &&
  !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

export function parseDocType(value: string | null): DocType | undefined {
  if (value == null || value === "") return undefined;
  if (value === "invoice" || value === "estimate") return value;
  throw new ApiError(400, 'type must be "invoice" or "estimate"');
}

/**
 * Resolve a path segment to a document id. Accepts the UUID or the document
 * number (e.g. `INV-0123`). Numbers are only unique per type, so a number that
 * exists as both an invoice and an estimate needs `?type=` to disambiguate.
 */
export async function resolveDocumentId(
  db: Db,
  ref: string,
  type?: DocType,
): Promise<string> {
  if (isUuid(ref)) return ref;

  let query = db.from("documents").select("id, type, number").eq("number", ref);
  if (type) query = query.eq("type", type);
  const { data, error } = await query;
  if (error) throw new ApiError(500, error.message);

  const rows = (data ?? []) as { id: string; type: DocType; number: string }[];
  if (rows.length === 1) return rows[0].id;
  if (rows.length === 0) {
    throw new ApiError(404, `No document with id or number "${ref}"`);
  }
  throw new ApiError(
    409,
    `Number "${ref}" is both an invoice and an estimate; add ?type=invoice or ?type=estimate, or use the id`,
    { candidates: rows },
  );
}

type Summarizable = Pick<
  DocumentRow,
  | "id"
  | "type"
  | "number"
  | "status"
  | "subject"
  | "po_number"
  | "issue_date"
  | "due_date"
  | "currency"
  | "total"
> & {
  share_token?: string;
  client?: { id: string; name: string } | null;
  payments?: { amount: number }[];
};

/**
 * The compact, agent-facing view of a document. `status` is the effective
 * status (overdue / partial / paid derived from payments and due date), which
 * is what the web UI shows; the raw column is not exposed.
 */
export function summarize(doc: Summarizable) {
  const paid = round2(amountPaid(doc.payments));
  const total = Number(doc.total);
  const status: DocStatus = effectiveStatus(doc, paid);
  const section = doc.type === "invoice" ? "invoices" : "estimates";
  const base = siteUrl();
  return {
    id: doc.id,
    type: doc.type,
    number: doc.number,
    status,
    client: doc.client ? { id: doc.client.id, name: doc.client.name } : null,
    subject: doc.subject,
    po_number: doc.po_number,
    issue_date: doc.issue_date,
    due_date: doc.due_date,
    currency: doc.currency,
    total,
    ...(doc.type === "invoice"
      ? { amount_paid: paid, balance_due: round2(Math.max(0, total - paid)) }
      : {}),
    url: `${base}/${section}/${doc.id}`,
    // Only estimates have a public, no-login page for the client.
    ...(doc.type === "estimate" && doc.share_token
      ? { share_url: `${base}/share/${doc.share_token}` }
      : {}),
  };
}

/** Columns `summarize` needs, for list queries. */
export const SUMMARY_COLUMNS =
  "id, type, number, status, subject, po_number, issue_date, due_date, currency, total, fx_rate, share_token, client:clients(id, name), payments(amount)";

/**
 * Run a list query to exhaustion. PostgREST caps a response at 1000 rows, and
 * there are already most of that many invoices, so page through instead.
 */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{
    data: unknown[] | null;
    error: { message: string } | null;
  }>,
): Promise<T[]> {
  const size = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw new ApiError(500, error.message);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < size) return rows;
  }
}
