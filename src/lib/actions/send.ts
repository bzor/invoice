"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { getPdfData } from "@/lib/data";
import { formatDate } from "@/lib/dates";
import { documentEmailHtml, sendDocumentEmail } from "@/lib/email";
import { siteUrl } from "@/lib/env";
import { formatMoney } from "@/lib/money";
import { renderDocumentPdf } from "@/lib/pdf/document-pdf";
import { createClient as createSupabase } from "@/lib/supabase/server";

export type SendResult = { ok: true } | { ok: false; error: string };

export async function sendDocument(input: {
  id: string;
  to?: string;
  message?: string;
}): Promise<SendResult> {
  await requireUser();
  const supabase = await createSupabase();

  const data = await getPdfData(input.id);
  if (!data) return { ok: false, error: "Document not found" };

  const to = (input.to || data.contact?.email || "").trim();
  if (!to) {
    return {
      ok: false,
      error: "No recipient — add an email to the contact or enter one.",
    };
  }

  const pdf = await renderDocumentPdf(data);
  const { doc } = data;
  const typeLabel = doc.type === "invoice" ? "Invoice" : "Estimate";
  const filename = `BZOR-${doc.number}.pdf`.toUpperCase();

  // Archive the PDF in Storage.
  const path = `${doc.type}/${doc.id}/${doc.number}.pdf`;
  await supabase.storage.from("documents").upload(path, pdf, {
    contentType: "application/pdf",
    upsert: true,
  });

  try {
    await sendDocumentEmail({
      to,
      replyTo: data.settings.business_email || process.env.ALLOWED_EMAIL,
      subject: `${typeLabel} ${doc.number} from ${data.settings.business_name}`,
      filename,
      pdf,
      html: documentEmailHtml({
        typeLabel,
        number: doc.number,
        businessName: data.settings.business_name,
        total: formatMoney(Number(doc.total), doc.currency),
        dueDate: doc.due_date ? formatDate(doc.due_date) : null,
        message: input.message,
        shareUrl:
          doc.type === "estimate"
            ? `${siteUrl()}/share/${doc.share_token}`
            : undefined,
      }),
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Send failed" };
  }

  // Mark sent (don't downgrade an already-progressed status).
  const newStatus =
    doc.status === "draft" || doc.status === "approved" ? "sent" : doc.status;
  await supabase
    .from("documents")
    .update({
      status: newStatus,
      sent_at: new Date().toISOString(),
      pdf_path: path,
    })
    .eq("id", doc.id);

  revalidatePath("/");
  revalidatePath(`/${doc.type === "invoice" ? "invoices" : "estimates"}/${doc.id}`);
  return { ok: true };
}
