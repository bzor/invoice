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

export async function sendDocumentEmail(opts: {
  to: string;
  subject: string;
  html: string;
  filename: string;
  pdf: Buffer;
  replyTo?: string;
}) {
  const { error } = await resend().emails.send({
    from: emailFrom(),
    to: opts.to,
    replyTo: opts.replyTo || undefined,
    subject: opts.subject,
    html: opts.html,
    attachments: [{ filename: opts.filename, content: opts.pdf }],
  });
  if (error) throw new Error(error.message);
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
