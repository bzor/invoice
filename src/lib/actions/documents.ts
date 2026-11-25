"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import {
  convertToInvoiceCore,
  duplicateDocumentCore,
  markSentCore,
  saveDocumentCore,
  type DocumentInput,
} from "@/lib/core/documents";
import { setFlash } from "@/lib/flash";
import { createClient as createSupabase } from "@/lib/supabase/server";
import type { DocType } from "@/lib/types";

export async function saveDocument(
  input: DocumentInput,
): Promise<{ id: string; number: string }> {
  await requireUser();
  const result = await saveDocumentCore(await createSupabase(), input);
  await setFlash(
    input.id
      ? "Changes saved"
      : `${input.type === "invoice" ? "Invoice" : "Estimate"} created`,
  );
  return result;
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
  await setFlash("Estimate approved");
}

export async function declineEstimate(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await setDocStatus(id, {
    status: "declined",
    declined_at: new Date().toISOString(),
  });
  await setFlash("Estimate declined");
}

export async function markSent(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  await markSentCore(await createSupabase(), id);
  await setFlash("Marked as sent");
}

export async function voidDocument(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await setDocStatus(id, { status: "void" });
  await setFlash("Document voided");
}

/** Create a draft invoice from an estimate, then open it. */
export async function convertToInvoice(formData: FormData) {
  await requireUser();
  const estimateId = String(formData.get("id") ?? "");
  const { id } = await convertToInvoiceCore(await createSupabase(), estimateId);
  await setFlash("Invoice created from estimate");
  redirect(`/invoices/${id}`);
}

/**
 * Create a draft copy of a document — same client, contact, line items, costs,
 * currency, discount and notes — with a new number and today's issue date.
 * Works for invoices and estimates.
 */
export async function duplicateDocument(
  sourceId: string,
): Promise<{ id: string; type: DocType }> {
  await requireUser();
  const { id, type } = await duplicateDocumentCore(
    await createSupabase(),
    sourceId,
  );
  return { id, type };
}

export async function deleteDocument(formData: FormData) {
  await requireUser();
  const supabase = await createSupabase();
  const id = String(formData.get("id") ?? "");
  const type = String(formData.get("type") ?? "invoice");
  await supabase.from("documents").delete().eq("id", id);
  revalidatePath(`/${type === "invoice" ? "invoices" : "estimates"}`);
  redirect(`/${type === "invoice" ? "invoices" : "estimates"}`);
}
