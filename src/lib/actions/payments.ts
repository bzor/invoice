"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { recomputeStatus, recordPaymentCore } from "@/lib/core/payments";
import { getPdfData } from "@/lib/data";
import { formatDate, today } from "@/lib/dates";
import { receiptEmailHtml, sendPlainEmail } from "@/lib/email";
import { setFlash } from "@/lib/flash";
import { formatMoney } from "@/lib/money";
import { createClient as createSupabase } from "@/lib/supabase/server";

/** Best-effort: email the invoice's contact a payment receipt. Returns sent? */
async function emailReceipt(
  invoiceId: string,
  amount: number,
  dateStr: string,
  method: string,
): Promise<boolean> {
  try {
    const data = await getPdfData(invoiceId);
    if (!data) return false;
    const { doc, contact, settings } = data;
    const to = (contact?.email || "").trim();
    if (!to) return false;

    const supabase = await createSupabase();
    const { data: pays } = await supabase
      .from("payments")
      .select("amount")
      .eq("invoice_id", invoiceId);
    const paid = ((pays ?? []) as { amount: number }[]).reduce(
      (s, p) => s + Number(p.amount),
      0,
    );
    const balance = Math.max(0, Number(doc.total) - paid);

    await sendPlainEmail({
      to,
      replyTo: settings.business_email || process.env.ALLOWED_EMAIL,
      subject: `Payment received — Invoice ${doc.number}`,
      html: receiptEmailHtml({
        number: doc.number,
        businessName: settings.business_name,
        amountPaid: formatMoney(amount, doc.currency),
        date: formatDate(dateStr),
        method,
        balanceDue: formatMoney(balance, doc.currency),
        paidInFull: balance <= 0.005,
      }),
    });
    return true;
  } catch {
    return false;
  }
}

export async function recordPayment(formData: FormData) {
  await requireUser();
  const supabase = await createSupabase();

  await recordPaymentCore(supabase, {
    invoice_id: String(formData.get("invoice_id") ?? ""),
    amount: Number(formData.get("amount") ?? 0),
    date: String(formData.get("date") ?? ""),
    method: String(formData.get("method") ?? ""),
    note: String(formData.get("note") ?? ""),
  });
  await setFlash("Payment recorded");
}

/** Settle the full outstanding balance, optionally emailing a receipt. */
export async function markPaid(formData: FormData) {
  await requireUser();
  const supabase = await createSupabase();
  const invoiceId = String(formData.get("invoice_id") ?? "");
  if (!invoiceId) throw new Error("Missing invoice");

  const { data: docRow } = await supabase
    .from("documents")
    .select("total")
    .eq("id", invoiceId)
    .single();
  const total = Number((docRow as { total: number } | null)?.total ?? 0);

  const { data: pays } = await supabase
    .from("payments")
    .select("amount")
    .eq("invoice_id", invoiceId);
  const paid = ((pays ?? []) as { amount: number }[]).reduce(
    (s, p) => s + Number(p.amount),
    0,
  );
  const due = total - paid;

  if (due <= 0.005) {
    await setFlash("Invoice already paid");
    revalidatePath(`/invoices/${invoiceId}`);
    return;
  }

  await supabase.from("payments").insert({
    invoice_id: invoiceId,
    amount: due,
    date: today(),
    method: "",
    note: "Marked as paid",
  });
  await recomputeStatus(supabase, invoiceId);

  const wantReceipt = formData.get("send_receipt") === "on";
  const sent = wantReceipt
    ? await emailReceipt(invoiceId, due, today(), "")
    : false;
  await setFlash(sent ? "Marked as paid · receipt emailed" : "Marked as paid");

  revalidatePath("/");
  revalidatePath(`/invoices/${invoiceId}`);
}

export async function deletePayment(formData: FormData) {
  await requireUser();
  const supabase = await createSupabase();

  const id = String(formData.get("id") ?? "");
  const invoiceId = String(formData.get("invoice_id") ?? "");
  await supabase.from("payments").delete().eq("id", id);
  await recomputeStatus(supabase, invoiceId);
  await setFlash("Payment removed");

  revalidatePath("/");
  revalidatePath(`/invoices/${invoiceId}`);
}
