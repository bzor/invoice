import "server-only";

import { revalidatePath } from "next/cache";

import { today } from "@/lib/dates";
import type { Db } from "@/lib/supabase/db";

/** Recompute an invoice's stored status from its payments + due date. */
export async function recomputeStatus(db: Db, invoiceId: string) {
  const { data: doc } = await db
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

  await db.from("documents").update({ status }).eq("id", invoiceId);
}

export type PaymentInput = {
  invoice_id: string;
  amount: number;
  date?: string;
  method?: string;
  note?: string;
};

/** Record a payment against an invoice and refresh its status. */
export async function recordPaymentCore(db: Db, input: PaymentInput) {
  if (!input.invoice_id || !input.amount) throw new Error("Amount is required");

  const { error } = await db.from("payments").insert({
    invoice_id: input.invoice_id,
    amount: input.amount,
    date: input.date || today(),
    method: (input.method ?? "").trim(),
    note: (input.note ?? "").trim(),
  });
  if (error) throw new Error(error.message);
  await recomputeStatus(db, input.invoice_id);

  revalidatePath("/");
  revalidatePath(`/invoices/${input.invoice_id}`);
}
