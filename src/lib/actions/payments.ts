"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { today } from "@/lib/dates";
import { createClient as createSupabase } from "@/lib/supabase/server";

/** Recompute an invoice's stored status from its payments + due date. */
async function recomputeStatus(invoiceId: string) {
  const supabase = await createSupabase();
  const { data: doc } = await supabase
    .from("documents")
    .select("total, due_date, status, payments(amount)")
    .eq("id", invoiceId)
    .single();
  if (!doc) return;

  const d = doc as unknown as {
    total: number;
    due_date: string | null;
    status: string;
    payments: { amount: number }[];
  };
  if (d.status === "draft" || d.status === "void") return;

  const paid = d.payments.reduce((s, p) => s + Number(p.amount), 0);
  const due = Number(d.total) - paid;

  let status: string;
  if (due <= 0.005) status = "paid";
  else if (d.due_date && d.due_date < today()) status = "overdue";
  else if (paid > 0.005) status = "partial";
  else status = "sent";

  await supabase.from("documents").update({ status }).eq("id", invoiceId);
}

export async function recordPayment(formData: FormData) {
  await requireUser();
  const supabase = await createSupabase();

  const invoiceId = String(formData.get("invoice_id") ?? "");
  const payload = {
    invoice_id: invoiceId,
    amount: Number(formData.get("amount") ?? 0),
    date: String(formData.get("date") ?? today()) || today(),
    method: String(formData.get("method") ?? "").trim(),
    note: String(formData.get("note") ?? "").trim(),
  };
  if (!invoiceId || !payload.amount) throw new Error("Amount is required");

  await supabase.from("payments").insert(payload);
  await recomputeStatus(invoiceId);

  revalidatePath("/");
  revalidatePath(`/invoices/${invoiceId}`);
}

export async function deletePayment(formData: FormData) {
  await requireUser();
  const supabase = await createSupabase();

  const id = String(formData.get("id") ?? "");
  const invoiceId = String(formData.get("invoice_id") ?? "");
  await supabase.from("payments").delete().eq("id", id);
  await recomputeStatus(invoiceId);

  revalidatePath("/");
  revalidatePath(`/invoices/${invoiceId}`);
}
