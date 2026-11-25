import "server-only";

import { revalidatePath } from "next/cache";

import { addDays, today } from "@/lib/dates";
import { getFxRate } from "@/lib/fx";
import { computeTotals, lineTotal } from "@/lib/money";
import type { Db } from "@/lib/supabase/db";
import type { BankInfoMode, DiscountType, DocType } from "@/lib/types";

// Document writes shared by the web UI (server actions, session client) and the
// token API (route handlers, service-role client). Callers authenticate first;
// nothing here checks who is asking.

export type LineInput = {
  title: string;
  description: string;
  quantity: number;
  unit_price: number;
};

export type DocumentInput = {
  id?: string;
  type: DocType;
  client_id: string;
  contact_id: string | null;
  po_number: string;
  subject: string;
  issue_date: string;
  net_terms: number | null;
  due_date: string | null;
  currency: string;
  discount_type: DiscountType;
  discount_value: number;
  notes: string;
  bank_info_mode: BankInfoMode;
  line_items: LineInput[];
};

const section = (type: DocType) =>
  type === "invoice" ? "invoices" : "estimates";

async function insertLineItems(db: Db, documentId: string, items: LineInput[]) {
  if (!items.length) return;
  const { error } = await db.from("line_items").insert(
    items.map((li, i) => ({
      document_id: documentId,
      position: i,
      title: li.title,
      description: li.description,
      quantity: li.quantity,
      unit_price: li.unit_price,
      line_total: lineTotal(li.quantity, li.unit_price),
    })),
  );
  if (error) throw new Error(error.message);
}

/** Create (no `id`) or update a document. Totals are always recomputed here. */
export async function saveDocumentCore(
  db: Db,
  input: DocumentInput,
): Promise<{ id: string; number: string }> {
  if (!input.client_id) throw new Error("Select a client");

  // Settings drive base currency + numbering.
  const { data: settings } = await db
    .from("settings")
    .select("base_currency")
    .eq("id", 1)
    .single();
  const baseCurrency =
    (settings as { base_currency: string })?.base_currency ?? "USD";

  const totals = computeTotals({
    lineItems: input.line_items,
    discountType: input.discount_type,
    discountValue: input.discount_value,
  });

  const fxRate =
    (await getFxRate(input.currency, baseCurrency, input.issue_date)) ?? 1;

  const dueDate =
    input.due_date ??
    (input.net_terms != null ? addDays(input.issue_date, input.net_terms) : null);

  const base = {
    type: input.type,
    client_id: input.client_id,
    contact_id: input.contact_id || null,
    po_number: input.po_number,
    subject: input.subject,
    issue_date: input.issue_date,
    due_date: dueDate,
    net_terms: input.net_terms,
    currency: input.currency,
    discount_type: input.discount_type,
    discount_value: input.discount_value,
    notes: input.notes,
    bank_info_mode: input.bank_info_mode,
    base_currency: baseCurrency,
    fx_rate: fxRate,
    subtotal: totals.subtotal,
    discount_total: totals.discount_total,
    total: totals.total,
  };

  let documentId = input.id;
  let number: string;

  if (documentId) {
    const { data, error } = await db
      .from("documents")
      .update(base)
      .eq("id", documentId)
      .select("number")
      .single();
    if (error) throw new Error(error.message);
    number = (data as { number: string }).number;
  } else {
    const { data: num, error: numErr } = await db.rpc("next_document_number", {
      p_type: input.type,
    });
    if (numErr) throw new Error(numErr.message);
    number = num as string;

    const { data, error } = await db
      .from("documents")
      .insert({ ...base, number, status: "draft" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    documentId = (data as { id: string }).id;
  }

  // Replace line items.
  await db.from("line_items").delete().eq("document_id", documentId);
  await insertLineItems(db, documentId, input.line_items);

  revalidatePath("/");
  revalidatePath(`/${section(input.type)}`);
  if (input.id) revalidatePath(`/${section(input.type)}/${documentId}`);

  return { id: documentId, number };
}

type SourceDocument = {
  id: string;
  type: DocType;
  client_id: string;
  contact_id: string | null;
  po_number: string;
  subject: string;
  net_terms: number | null;
  currency: string;
  discount_type: DiscountType;
  discount_value: number;
  notes: string;
  bank_info_mode: BankInfoMode;
  base_currency: string;
  subtotal: number;
  discount_total: number;
  total: number;
  line_items: (LineInput & { position: number })[];
};

/**
 * Insert a new draft carrying over everything from `src` — client, contact,
 * line items, costs, currency, discount, notes — with a fresh number, today's
 * issue date and a newly snapshotted FX rate.
 */
async function copyAsDraft(
  db: Db,
  src: SourceDocument,
  type: DocType,
  extra: Record<string, unknown> = {},
): Promise<{ id: string; number: string }> {
  const issue = today();
  const due = src.net_terms != null ? addDays(issue, src.net_terms) : null;
  const fxRate = (await getFxRate(src.currency, src.base_currency, issue)) ?? 1;

  const { data: num, error: numErr } = await db.rpc("next_document_number", {
    p_type: type,
  });
  if (numErr) throw new Error(numErr.message);
  const number = num as string;

  const { data: created, error } = await db
    .from("documents")
    .insert({
      type,
      number,
      status: "draft",
      client_id: src.client_id,
      contact_id: src.contact_id,
      po_number: src.po_number,
      subject: src.subject,
      issue_date: issue,
      due_date: due,
      net_terms: src.net_terms,
      currency: src.currency,
      discount_type: src.discount_type,
      discount_value: src.discount_value,
      notes: src.notes,
      bank_info_mode: src.bank_info_mode,
      base_currency: src.base_currency,
      fx_rate: fxRate,
      subtotal: src.subtotal,
      discount_total: src.discount_total,
      total: src.total,
      ...extra,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const id = (created as { id: string }).id;

  const ordered = [...src.line_items].sort((a, b) => a.position - b.position);
  await insertLineItems(db, id, ordered);

  return { id, number };
}

async function loadSource(db: Db, id: string): Promise<SourceDocument | null> {
  const { data } = await db
    .from("documents")
    .select("*, line_items(*)")
    .eq("id", id)
    .single();
  return (data as unknown as SourceDocument | null) ?? null;
}

/** Create a draft invoice from an estimate. */
export async function convertToInvoiceCore(
  db: Db,
  estimateId: string,
): Promise<{ id: string; number: string }> {
  const est = await loadSource(db, estimateId);
  if (!est) throw new Error("Estimate not found");

  const created = await copyAsDraft(db, est, "invoice", {
    source_estimate_id: est.id,
  });

  revalidatePath("/");
  revalidatePath("/invoices");
  revalidatePath(`/estimates/${estimateId}`);
  return created;
}

/** Create a draft copy of an invoice or estimate (same type). */
export async function duplicateDocumentCore(
  db: Db,
  sourceId: string,
): Promise<{ id: string; number: string; type: DocType }> {
  const src = await loadSource(db, sourceId);
  if (!src) throw new Error("Document not found");

  const created = await copyAsDraft(db, src, src.type);

  revalidatePath("/");
  revalidatePath(`/${section(src.type)}`);
  return { ...created, type: src.type };
}
