import "server-only";

import {
  ApiError,
  SUMMARY_COLUMNS,
  fetchAll,
  isIsoDate,
  isUuid,
  parseDocType,
  resolveDocumentId,
  summarize,
} from "@/lib/api";
import { loadClient, rejectUnknown } from "@/lib/api-clients";
import type { DocumentInput, LineInput } from "@/lib/core/documents";
import { CURRENCIES } from "@/lib/currencies";
import { getDocument, getSettings } from "@/lib/data";
import { today } from "@/lib/dates";
import type { Db } from "@/lib/supabase/db";
import type {
  BankInfoMode,
  Contact,
  DiscountType,
  DocType,
  DocumentWithRelations,
} from "@/lib/types";

// Request parsing + response shaping for the /api/v1/documents routes.

/** Load the document a route's `[id]` segment (id or number) refers to. */
export async function loadDocument(
  db: Db,
  ref: string,
  url: URL,
): Promise<DocumentWithRelations> {
  const type = parseDocType(url.searchParams.get("type"));
  const id = await resolveDocumentId(db, ref, type);
  const doc = await getDocument(id, db);
  if (!doc) throw new ApiError(404, `No document with id or number "${ref}"`);
  return doc;
}

/** Full agent-facing view of one document. */
export function detail(doc: DocumentWithRelations) {
  return {
    ...summarize(doc),
    contact: doc.contact
      ? { id: doc.contact.id, name: doc.contact.name, email: doc.contact.email }
      : null,
    net_terms: doc.net_terms,
    line_items: doc.line_items.map((li) => ({
      title: li.title,
      description: li.description,
      quantity: Number(li.quantity),
      unit_price: Number(li.unit_price),
      line_total: Number(li.line_total),
    })),
    subtotal: Number(doc.subtotal),
    discount_type: doc.discount_type,
    discount_value: Number(doc.discount_value),
    discount_total: Number(doc.discount_total),
    notes: doc.notes,
    bank_info_mode: doc.bank_info_mode,
    base_currency: doc.base_currency,
    fx_rate: Number(doc.fx_rate),
    source_estimate_id: doc.source_estimate_id,
    sent_at: doc.sent_at,
    approved_at: doc.approved_at,
    declined_at: doc.declined_at,
    payments: (doc.payments ?? []).map((p) => ({
      id: p.id,
      date: p.date,
      amount: Number(p.amount),
      method: p.method,
      note: p.note,
    })),
    email_events: (doc.email_events ?? []).slice(0, 10).map((e) => ({
      type: e.type,
      recipient: e.recipient,
      occurred_at: e.occurred_at,
      detail: e.detail,
    })),
  };
}

const WRITABLE = [
  "contact_id",
  "po_number",
  "subject",
  "issue_date",
  "net_terms",
  "due_date",
  "currency",
  "discount_type",
  "discount_value",
  "notes",
  "bank_info_mode",
  "line_items",
] as const;

const bad = (message: string) => new ApiError(400, message);

function str(body: Record<string, unknown>, key: string): string | undefined {
  const v = body[key];
  if (v === undefined) return undefined;
  if (typeof v !== "string") throw bad(`${key} must be a string`);
  return v;
}

function num(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw bad(`${label} must be a number`);
  }
  return value;
}

function parseLineItems(value: unknown): LineInput[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw bad("line_items must be a non-empty array");
  }
  return value.map((raw, i) => {
    const at = `line_items[${i}]`;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw bad(`${at} must be an object`);
    }
    const li = raw as Record<string, unknown>;
    rejectUnknown(li, ["title", "description", "quantity", "unit_price"]);
    const title = str(li, "title") ?? "";
    const description = str(li, "description") ?? "";
    if (!title.trim() && !description.trim()) {
      throw bad(`${at} needs a title or description`);
    }
    if (li.unit_price === undefined) throw bad(`${at}.unit_price is required`);
    const quantity =
      li.quantity === undefined ? 1 : num(li.quantity, `${at}.quantity`);
    if (quantity < 0) throw bad(`${at}.quantity cannot be negative`);
    return {
      title,
      description,
      quantity,
      unit_price: num(li.unit_price, `${at}.unit_price`),
    };
  });
}

/** Fields that parse the same way on create and update. `undefined` = absent. */
function parseCommon(body: Record<string, unknown>) {
  const out: Partial<Omit<DocumentInput, "id" | "type" | "client_id">> = {};

  const po = str(body, "po_number");
  if (po !== undefined) out.po_number = po;
  const subject = str(body, "subject");
  if (subject !== undefined) out.subject = subject;
  const notes = str(body, "notes");
  if (notes !== undefined) out.notes = notes;

  if (body.issue_date !== undefined) {
    if (!isIsoDate(body.issue_date)) throw bad("issue_date must be YYYY-MM-DD");
    out.issue_date = body.issue_date;
  }
  if (body.due_date !== undefined) {
    if (body.due_date !== null && !isIsoDate(body.due_date)) {
      throw bad("due_date must be YYYY-MM-DD or null");
    }
    out.due_date = body.due_date;
  }
  if (body.net_terms !== undefined) {
    if (body.net_terms === null) out.net_terms = null;
    else {
      const n = num(body.net_terms, "net_terms");
      if (!Number.isInteger(n) || n < 0) {
        throw bad("net_terms must be a whole number of days, or null");
      }
      out.net_terms = n;
    }
  }
  if (body.currency !== undefined) {
    const c = String(body.currency).toUpperCase();
    if (!(CURRENCIES as readonly string[]).includes(c)) {
      throw bad(`currency must be one of ${CURRENCIES.join(", ")}`);
    }
    out.currency = c;
  }
  if (body.discount_type !== undefined) {
    if (body.discount_type !== "amount" && body.discount_type !== "percent") {
      throw bad('discount_type must be "amount" or "percent"');
    }
    out.discount_type = body.discount_type as DiscountType;
  }
  if (body.discount_value !== undefined) {
    const v = num(body.discount_value, "discount_value");
    if (v < 0) throw bad("discount_value cannot be negative");
    out.discount_value = v;
  }
  if (body.bank_info_mode !== undefined) {
    if (!["none", "domestic", "international"].includes(body.bank_info_mode as string)) {
      throw bad('bank_info_mode must be "none", "domestic" or "international"');
    }
    out.bank_info_mode = body.bank_info_mode as BankInfoMode;
  }
  if (body.line_items !== undefined) {
    out.line_items = parseLineItems(body.line_items);
  }
  return out;
}

function checkDiscount(input: Pick<DocumentInput, "discount_type" | "discount_value">) {
  if (input.discount_type === "percent" && input.discount_value > 100) {
    throw bad("A percent discount cannot exceed 100");
  }
}

function checkContact(
  client: { name: string; contacts: Contact[] },
  contactId: unknown,
): string | null {
  if (contactId === null) return null;
  if (!isUuid(contactId) || !client.contacts.some((c) => c.id === contactId)) {
    throw new ApiError(400, `contact_id is not a contact of ${client.name}`, {
      contacts: client.contacts.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        is_primary: c.is_primary,
      })),
    });
  }
  return contactId;
}

/**
 * Build the input for a new draft. Anything the caller omits falls back the
 * way the web editor does — client currency / terms / notes, then Settings —
 * except the contact (the client's primary, so the draft is ready to send)
 * and the bank details mode (see below).
 */
export async function buildCreateInput(
  db: Db,
  body: Record<string, unknown>,
): Promise<DocumentInput> {
  rejectUnknown(body, ["type", "client_id", ...WRITABLE]);

  const type = parseDocType(typeof body.type === "string" ? body.type : null);
  if (!type) throw bad('type is required: "invoice" or "estimate"');
  if (!isUuid(body.client_id)) {
    throw bad("client_id is required (find it with GET /api/v1/clients?q=)");
  }
  if (body.line_items === undefined) throw bad("line_items is required");

  const [client, settings] = await Promise.all([
    loadClient(db, body.client_id),
    getSettings(db),
  ]);
  const given = parseCommon(body);

  const contactId =
    body.contact_id !== undefined
      ? checkContact(client, body.contact_id)
      : ((
          client.contacts.find((c) => c.is_primary) ??
          (client.contacts.length === 1 ? client.contacts[0] : undefined)
        )?.id ?? null);

  const input: DocumentInput = {
    type,
    client_id: client.id,
    contact_id: contactId,
    po_number: given.po_number ?? "",
    subject: given.subject ?? "",
    issue_date: given.issue_date ?? today(),
    net_terms:
      given.net_terms !== undefined
        ? given.net_terms
        : (client.default_net_terms ?? settings.default_net_terms),
    due_date: given.due_date ?? null,
    currency: given.currency ?? client.currency,
    discount_type: given.discount_type ?? "amount",
    discount_value: given.discount_value ?? 0,
    notes: given.notes ?? (client.default_notes || settings.default_notes),
    // Unlike the editor (which starts at "none" and is set by hand), default
    // to how documents actually go out: invoices print domestic bank details,
    // estimates print none.
    bank_info_mode:
      given.bank_info_mode ?? (type === "invoice" ? "domestic" : "none"),
    line_items: given.line_items!,
  };
  checkDiscount(input);
  return input;
}

/** Merge a PATCH body over an existing draft. Line items, if given, replace. */
export async function buildUpdateInput(
  db: Db,
  doc: DocumentWithRelations,
  body: Record<string, unknown>,
): Promise<DocumentInput> {
  rejectUnknown(body, WRITABLE);
  if (Object.keys(body).length === 0) throw bad("Nothing to update");
  const given = parseCommon(body);

  const contactId =
    body.contact_id !== undefined
      ? checkContact(await loadClient(db, doc.client_id), body.contact_id)
      : doc.contact_id;

  const issueDate = given.issue_date ?? doc.issue_date;
  const netTerms = given.net_terms !== undefined ? given.net_terms : doc.net_terms;
  // An explicit due date wins. Otherwise keep the stored one unless the dates
  // it was derived from changed, in which case let the core re-derive it.
  const datesChanged =
    issueDate !== doc.issue_date || netTerms !== doc.net_terms;
  const dueDate =
    given.due_date !== undefined
      ? given.due_date
      : datesChanged
        ? null
        : doc.due_date;

  const input: DocumentInput = {
    id: doc.id,
    type: doc.type as DocType,
    client_id: doc.client_id,
    contact_id: contactId,
    po_number: given.po_number ?? doc.po_number,
    subject: given.subject ?? doc.subject,
    issue_date: issueDate,
    net_terms: netTerms,
    due_date: dueDate,
    currency: given.currency ?? doc.currency,
    discount_type: given.discount_type ?? doc.discount_type,
    discount_value: given.discount_value ?? Number(doc.discount_value),
    notes: given.notes ?? doc.notes,
    bank_info_mode: given.bank_info_mode ?? doc.bank_info_mode,
    line_items:
      given.line_items ??
      doc.line_items.map((li) => ({
        title: li.title,
        description: li.description,
        quantity: Number(li.quantity),
        unit_price: Number(li.unit_price),
      })),
  };
  checkDiscount(input);
  return input;
}

export type DocumentSummary = ReturnType<typeof summarize>;

/**
 * List documents as summaries, newest first. `type` and `clientId` filter in
 * SQL; anything depending on effective status is filtered by the caller, since
 * overdue / partial / paid are derived rather than stored.
 */
export async function listSummaries(
  db: Db,
  opts: { type?: DocType; clientId?: string; since?: string; until?: string } = {},
): Promise<DocumentSummary[]> {
  const rows = await fetchAll<Parameters<typeof summarize>[0]>((from, to) => {
    let q = db.from("documents").select(SUMMARY_COLUMNS);
    if (opts.type) q = q.eq("type", opts.type);
    if (opts.clientId) q = q.eq("client_id", opts.clientId);
    if (opts.since) q = q.gte("issue_date", opts.since);
    if (opts.until) q = q.lte("issue_date", opts.until);
    return q
      .order("issue_date", { ascending: false })
      .order("id")
      .range(from, to);
  });
  return rows.map(summarize);
}

/** Sent invoices with money still owed, most overdue first. */
export function outstandingOf(docs: DocumentSummary[]): DocumentSummary[] {
  return docs
    .filter(
      (d) =>
        d.type === "invoice" &&
        d.status !== "draft" &&
        d.status !== "void" &&
        (d.balance_due ?? 0) > 0.005,
    )
    .sort((a, b) =>
      (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"),
    );
}
