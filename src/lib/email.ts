import "server-only";

import { Resend } from "resend";

let client: Resend | null = null;
function resend() {
  if (!client) client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

export function emailFrom() {
  return process.env.RESEND_FROM ?? "invoices@example.com";
}

/** Resend's message id, used to correlate later webhook events. */
export type SendResult = { id: string | null };

export async function sendDocumentEmail(opts: {
  to: string;
  subject: string;
  html: string;
  filename: string;
  pdf: Buffer;
  replyTo?: string;
}): Promise<SendResult> {
  const { data, error } = await resend().emails.send({
    from: emailFrom(),
    to: opts.to,
    replyTo: opts.replyTo || undefined,
    subject: opts.subject,
    html: opts.html,
    text: htmlToText(opts.html),
    attachments: [{ filename: opts.filename, content: opts.pdf }],
  });
  if (error) throw new Error(error.message);
  return { id: data?.id ?? null };
}

/** Send a plain email with no attachment (notifications, reminders w/o PDF). */
export async function sendPlainEmail(opts: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<SendResult> {
  const { data, error } = await resend().emails.send({
    from: emailFrom(),
    to: opts.to,
    replyTo: opts.replyTo || undefined,
    subject: opts.subject,
    html: opts.html,
    text: htmlToText(opts.html),
  });
  if (error) throw new Error(error.message);
  return { id: data?.id ?? null };
}

export function reminderEmailHtml(opts: {
  number: string;
  businessName: string;
  amountDue: string;
  dueDate?: string | null;
  overdue: boolean;
  message?: string;
}) {
  const intro =
    opts.message?.trim() ||
    (opts.overdue
      ? `A friendly reminder that invoice ${opts.number} is now past due. The balance below remains outstanding.`
      : `A friendly reminder about invoice ${opts.number}. The balance below is outstanding.`);

  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;max-width:520px">
    <p style="white-space:pre-wrap">${escapeHtml(intro)}</p>
    <table style="margin:20px 0;border-collapse:collapse">
      <tr><td style="padding:2px 16px 2px 0;color:#64748b">Invoice</td><td style="font-weight:600">${opts.number}</td></tr>
      <tr><td style="padding:2px 16px 2px 0;color:#64748b">Amount due</td><td style="font-weight:600">${opts.amountDue}</td></tr>
      ${opts.dueDate ? `<tr><td style="padding:2px 16px 2px 0;color:#64748b">${opts.overdue ? "Was due" : "Due"}</td><td>${opts.dueDate}</td></tr>` : ""}
    </table>
    <p style="color:#94a3b8;font-size:13px;margin-top:24px">${escapeHtml(opts.businessName)}</p>
  </div>`;
}

export function receiptEmailHtml(opts: {
  number: string;
  businessName: string;
  amountPaid: string;
  date: string;
  method?: string;
  balanceDue: string;
  paidInFull: boolean;
}) {
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;max-width:520px">
    <p>Thank you — we've received your payment.</p>
    <table style="margin:20px 0;border-collapse:collapse">
      <tr><td style="padding:2px 16px 2px 0;color:#64748b">Invoice</td><td style="font-weight:600">${opts.number}</td></tr>
      <tr><td style="padding:2px 16px 2px 0;color:#64748b">Amount paid</td><td style="font-weight:600">${opts.amountPaid}</td></tr>
      <tr><td style="padding:2px 16px 2px 0;color:#64748b">Date</td><td>${opts.date}</td></tr>
      ${opts.method ? `<tr><td style="padding:2px 16px 2px 0;color:#64748b">Method</td><td>${escapeHtml(opts.method)}</td></tr>` : ""}
      <tr><td style="padding:2px 16px 2px 0;color:#64748b">${opts.paidInFull ? "Status" : "Balance due"}</td><td style="font-weight:600">${opts.paidInFull ? "Paid in full" : opts.balanceDue}</td></tr>
    </table>
    <p style="color:#94a3b8;font-size:13px;margin-top:24px">${escapeHtml(opts.businessName)}</p>
  </div>`;
}

export function estimateResponseEmailHtml(opts: {
  number: string;
  clientName: string;
  approved: boolean;
  reviewUrl: string;
}) {
  const verb = opts.approved ? "approved" : "declined";
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;max-width:520px">
    <p><strong>${escapeHtml(opts.clientName)}</strong> ${verb} estimate <strong>${escapeHtml(opts.number)}</strong>.</p>
    ${opts.approved ? `<p style="color:#64748b">You can convert it to an invoice when you're ready.</p>` : ""}
    <p style="margin-top:20px"><a href="${opts.reviewUrl}" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 18px;text-decoration:none">View estimate</a></p>
  </div>`;
}

export function documentEmailHtml(opts: {
  typeLabel: string;
  number: string;
  businessName: string;
  total: string;
  dueDate?: string | null;
  message?: string;
  shareUrl?: string;
}) {
  const intro =
    opts.message?.trim() ||
    `Please find ${opts.typeLabel.toLowerCase()} ${opts.number} attached.`;

  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;max-width:520px">
    <p style="white-space:pre-wrap">${escapeHtml(intro)}</p>
    <table style="margin:20px 0;border-collapse:collapse">
      <tr><td style="padding:2px 16px 2px 0;color:#64748b">${opts.typeLabel}</td><td style="font-weight:600">${opts.number}</td></tr>
      <tr><td style="padding:2px 16px 2px 0;color:#64748b">Total</td><td style="font-weight:600">${opts.total}</td></tr>
      ${opts.dueDate ? `<tr><td style="padding:2px 16px 2px 0;color:#64748b">Due</td><td>${opts.dueDate}</td></tr>` : ""}
    </table>
    ${
      opts.shareUrl
        ? `<p><a href="${opts.shareUrl}" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Review & respond online</a></p>`
        : ""
    }
    <p style="color:#94a3b8;font-size:13px;margin-top:24px">${escapeHtml(opts.businessName)}</p>
  </div>`;
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Derive a plain-text alternative from our (simple, hand-authored) HTML
 * templates. Shipping a text/plain part alongside the HTML is a cheap,
 * reliable spam-score win — HTML-only mail is penalised by most filters.
 * This isn't a general HTML parser; it just handles the tags we actually
 * emit (p, tables, links, br).
 */
export function htmlToText(html: string): string {
  return html
    // Links → "text (url)" so the destination survives in plain text.
    .replace(
      /<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
      (_m, href, text) => `${text.replace(/<[^>]+>/g, "").trim()} (${href})`,
    )
    // Keep a table row's label + value on one line, tab-separated.
    .replace(/<\/td>\s*<td[^>]*>/gi, "\t")
    // Block-level boundaries become line breaks.
    .replace(/<\/(p|tr|div|h[1-6]|table|li)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    // Drop every remaining tag.
    .replace(/<[^>]+>/g, "")
    // Decode the handful of entities our templates produce.
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    // Tidy whitespace: strip source indentation, trailing spaces, runaway
    // blank lines, and edges.
    .replace(/^[ \t]+/gm, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
