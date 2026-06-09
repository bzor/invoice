/**
 * Quick Resend deliverability check.
 *   node --env-file=.env.local scripts/test-email.mjs [recipient]
 * Defaults to ALLOWED_EMAIL. Sends a tiny test from RESEND_FROM.
 */
import { Resend } from "resend";

const to = process.argv[2] || process.env.ALLOWED_EMAIL;
const from = process.env.RESEND_FROM;
const resend = new Resend(process.env.RESEND_API_KEY);

console.log(`Sending test → ${to}\n  from: ${from}`);
const { data, error } = await resend.emails.send({
  from,
  to,
  subject: "Bzor Invoice — Resend test ✓",
  html: `<p>If you're reading this, sending from <b>${from}</b> works.</p>
         <p>The invoice app can now email estimates and invoices.</p>`,
});

if (error) {
  console.error("\n❌ Send failed:", JSON.stringify(error));
  process.exit(1);
}
console.log("\n✅ Accepted by Resend. Message id:", data?.id);
