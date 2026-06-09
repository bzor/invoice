"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { addDays } from "@/lib/dates";
import { getFxRate } from "@/lib/fx";
import { lineTotal, computeTotals } from "@/lib/money";
import { createClient as createSupabase } from "@/lib/supabase/server";
import type {
  BankInfoMode,
  DiscountType,
  DocType,
} from "@/lib/types";

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

export async function saveDocument(
  input: DocumentInput,
): Promise<{ id: string; number: string }> {
  await requireUser();
  const supabase = await createSupabase();

  if (!input.client_id) throw new Error("Select a client");

  // Settings drive base currency + numbering.
  const { data: settings } = await supabase
    .from("settings")
    .select("base_currency")
    .eq("id", 1)
    .single();
  const baseCurrency = (settings as { base_currency: string })?.base_currency ?? "USD";

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
    const { data, error } = await supabase
      .from("documents")
      .update(base)
      .eq("id", documentId)
      .select("number")
      .single();
    if (error) throw new Error(error.message);
    number = (data as { number: string }).number;
  } else {
    const { data: num, error: numErr } = await supabase.rpc(
      "next_document_number",
      { p_type: input.type },
    );
    if (numErr) throw new Error(numErr.message);
    number = num as string;

    const { data, error } = await supabase
      .from("documents")
      .insert({ ...base, number, status: "draft" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    documentId = (data as { id: string }).id;
  }

  // Replace line items.
  await supabase.from("line_items").delete().eq("document_id", documentId);
  if (input.line_items.length) {
    await supabase.from("line_items").insert(
      input.line_items.map((li, i) => ({
        document_id: documentId,
        position: i,
        title: li.title,
        description: li.description,
        quantity: li.quantity,
        unit_price: li.unit_price,
        line_total: lineTotal(li.quantity, li.unit_price),
      })),
    );
  }

  revalidatePath("/");
  revalidatePath(`/${input.type === "invoice" ? "invoices" : "estimates"}`);
  if (input.id) {
    revalidatePath(
      `/${input.type === "invoice" ? "invoices" : "estimates"}/${documentId}`,
    );
  }

  return { id: documentId, number };
}

async function setDocStatus(id: string, patch: Record<string, unknown>) {
  await requireUser();
  const supabase = await createSupabase();
  const { data } = await supabase
    .from("documents")
    .update(patch)
    .eq("id", id)
    .select("type")
    .single();
  const type = (data as { type: DocType } | null)?.type ?? "estimate";
  revalidatePath("/");
  revalidatePath(`/${type === "invoice" ? "invoices" : "estimates"}/${id}`);
}

export async function approveEstimate(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await setDocStatus(id, {
    status: "approved",
    approved_at: new Date().toISOString(),
    declined_at: null,
  });
}

export async function declineEstimate(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await setDocStatus(id, {
    status: "declined",
    declined_at: new Date().toISOString(),
  });
}

export async function markSent(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await setDocStatus(id, {
    status: "sent",
    sent_at: new Date().toISOString(),
  });
}

export async function voidDocument(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await setDocStatus(id, { status: "void" });
}

/** Create a draft invoice from an estimate. Returns the new invoice id. */
export async function convertToInvoice(formData: FormData) {
  await requireUser();
  const supabase = await createSupabase();
  const estimateId = String(formData.get("id") ?? "");

  const { data: est } = await supabase
    .from("documents")
    .select("*, line_items(*)")
    .eq("id", estimateId)
    .single();
  if (!est) throw new Error("Estimate not found");
  const e = est as unknown as DocumentInput & {
    id: string;
    line_items: LineInput[];
    base_currency: string;
    discount_value: number;
    discount_type: DiscountType;
    bank_info_mode: BankInfoMode;
  };

  const issue = new Date().toISOString().slice(0, 10);
  const due = e.net_terms != null ? addDays(issue, e.net_terms) : null;
  const fxRate = (await getFxRate(e.currency, e.base_currency, issue)) ?? 1;

  const { data: num } = await supabase.rpc("next_document_number", {
    p_type: "invoice",
  });

  const { data: created, error } = await supabase
    .from("documents")
    .insert({
      type: "invoice",
      number: num as string,
      status: "draft",
      client_id: e.client_id,
      contact_id: e.contact_id,
      po_number: e.po_number,
      subject: e.subject,
      issue_date: issue,
      due_date: due,
      net_terms: e.net_terms,
      currency: e.currency,
      discount_type: e.discount_type,
      discount_value: e.discount_value,
      notes: e.notes,
      bank_info_mode: e.bank_info_mode,
      base_currency: e.base_currency,
      fx_rate: fxRate,
      subtotal: (est as { subtotal: number }).subtotal,
      discount_total: (est as { discount_total: number }).discount_total,
      total: (est as { total: number }).total,
      source_estimate_id: e.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const invoiceId = (created as { id: string }).id;

  if (e.line_items.length) {
    await supabase.from("line_items").insert(
      e.line_items.map((li, i) => ({
        document_id: invoiceId,
        position: i,
        title: li.title,
        description: li.description,
        quantity: li.quantity,
        unit_price: li.unit_price,
        line_total: lineTotal(li.quantity, li.unit_price),
      })),
    );
  }

  revalidatePath("/invoices");
  revalidatePath(`/estimates/${estimateId}`);
  const { redirect } = await import("next/navigation");
  redirect(`/invoices/${invoiceId}`);
}

export async function deleteDocument(formData: FormData) {
  await requireUser();
  const supabase = await createSupabase();
  const id = String(formData.get("id") ?? "");
  const type = String(formData.get("type") ?? "invoice");
  await supabase.from("documents").delete().eq("id", id);
  revalidatePath(`/${type === "invoice" ? "invoices" : "estimates"}`);
  const { redirect } = await import("next/navigation");
  redirect(`/${type === "invoice" ? "invoices" : "estimates"}`);
}
