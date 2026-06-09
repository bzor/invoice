/**
 * One-time Harvest → bzor-invoice invoice importer.
 * Joins the invoice report + line-item report by Harvest invoice ID.
 * Run AFTER clients/contacts are imported.
 *
 * Usage:
 *   node --env-file=.env.local scripts/import-invoices.mjs            # dry run
 *   node --env-file=.env.local scripts/import-invoices.mjs --commit   # write
 *   [--invoices docs/harvest_invoice_report.csv]
 *   [--lines docs/harvest_invoice_line_item_report.csv]
 *
 * Idempotent: matched by (type='invoice', number=Harvest ID).
 * Payments + line items are only written for newly-created invoices.
 */
import { readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const commit = args.includes("--commit");
const flag = (n, d) => {
  const i = args.indexOf(n);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const invoicesPath = flag("--invoices", "docs/harvest_invoice_report.csv");
const linesPath = flag("--lines", "docs/harvest_invoice_line_item_report.csv");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const norm = (v) => (v ?? "").trim();
const money = (v) => Number(norm(v).replace(/,/g, "")) || 0;
const currencyCode = (v) => {
  const m = norm(v).match(/([A-Z]{3})\s*$/);
  return m ? m[1] : "USD";
};
const readCsv = (p) =>
  parse(readFileSync(p, "utf8"), { columns: true, skip_empty_lines: true, bom: true });

function deriveStatus(amount, paid, balance) {
  if (paid > 0.01 && balance <= 0.01) return "paid";
  if (paid > 0.01) return "partial";
  return "sent";
}

async function main() {
  console.log(`\n${commit ? "COMMIT" : "DRY RUN"} — invoice import\n${"=".repeat(40)}`);

  const { data: settings } = await supabase
    .from("settings").select("base_currency").eq("id", 1).single();
  const base = settings?.base_currency ?? "USD";

  const { data: clients } = await supabase.from("clients").select("id, name");
  const byName = new Map(clients.map((c) => [c.name.trim().toLowerCase(), c.id]));
  const { data: primaries } = await supabase
    .from("contacts").select("client_id, id").eq("is_primary", true);
  const primaryByClient = new Map(primaries.map((p) => [p.client_id, p.id]));

  const { data: existing } = await supabase
    .from("documents").select("number").eq("type", "invoice");
  const existingNumbers = new Set((existing ?? []).map((d) => d.number));

  // Group line items by invoice ID (preserve file order).
  const lineRows = readCsv(linesPath);
  const linesByInvoice = new Map();
  for (const r of lineRows) {
    const id = norm(r["Invoice ID"]);
    if (!linesByInvoice.has(id)) linesByInvoice.set(id, []);
    linesByInvoice.get(id).push({
      description: norm(r["Item Description"]) || "Services",
      quantity: money(r["Item Quantity"]) || 1,
      unit_price: money(r["Item Unit Price"]),
      line_total: money(r["Item Amount"]),
    });
  }

  const invRows = readCsv(invoicesPath);
  const docs = [];
  const payments = []; // {number, amount, date}
  const linePlan = new Map(); // number -> line[]
  const seen = new Set();
  let skippedExisting = 0, skippedNoClient = 0, dupes = 0;
  const statusCount = {};

  for (const r of invRows) {
    const number = norm(r["ID"]);
    if (!number) continue;
    if (existingNumbers.has(number)) { skippedExisting++; continue; }
    if (seen.has(number)) { dupes++; continue; }
    seen.add(number);

    const clientId = byName.get(norm(r["Client"]).toLowerCase());
    if (!clientId) { skippedNoClient++; continue; }

    const amount = money(r["Invoice Amount"]);
    const paid = money(r["Paid Amount"]);
    const balance = money(r["Balance"]);
    const discount = money(r["Discount"]);
    const subtotal = money(r["Subtotal"]);
    const status = deriveStatus(amount, paid, balance);
    statusCount[status] = (statusCount[status] || 0) + 1;
    const currency = currencyCode(r["Currency"]);
    const issue = norm(r["Issue Date"]) || null;

    docs.push({
      type: "invoice",
      number,
      status,
      client_id: clientId,
      contact_id: primaryByClient.get(clientId) ?? null,
      po_number: norm(r["PO Number"]),
      subject: norm(r["Subject"]),
      issue_date: issue,
      currency,
      base_currency: base,
      fx_rate: 1, // all USD
      discount_type: "amount",
      discount_value: discount,
      subtotal,
      discount_total: discount,
      total: amount,
      bank_info_mode: "none",
      sent_at: issue,
    });

    // Line items (fallback to a single subtotal line if none in the file).
    const lines = linesByInvoice.get(number) ?? [
      { description: norm(r["Subject"]) || "Services", quantity: 1, unit_price: subtotal, line_total: subtotal },
    ];
    linePlan.set(number, lines);

    if (paid > 0.01) {
      payments.push({
        number,
        amount: paid,
        date: norm(r["Last Payment Date"]) || issue,
      });
    }
  }

  const totalLines = [...linePlan.values()].reduce((a, l) => a + l.length, 0);
  console.log(
    `\nInvoices: ${invRows.length} in CSV · ${docs.length} to create · ` +
      `${skippedExisting} already imported · ${skippedNoClient} no-client · ${dupes} dup`,
  );
  console.log("  status:", JSON.stringify(statusCount));
  console.log(`  line items to create: ${totalLines}`);
  console.log(`  payments to create: ${payments.length} ($${payments.reduce((a, p) => a + p.amount, 0).toLocaleString()})`);
  docs.slice(0, 5).forEach((d) =>
    console.log(`   + ${d.number}  ${d.status.padEnd(7)} ${d.currency} ${d.total.toLocaleString()}  ${d.subject.slice(0, 38)}`),
  );
  if (docs.length > 5) console.log(`   … and ${docs.length - 5} more`);

  if (commit && docs.length) {
    const numberToId = new Map();
    for (let i = 0; i < docs.length; i += 100) {
      const { data, error } = await supabase
        .from("documents").insert(docs.slice(i, i + 100)).select("id, number");
      if (error) throw new Error(`document insert: ${error.message}`);
      for (const d of data) numberToId.set(d.number, d.id);
    }

    const lineInserts = [];
    for (const [number, lines] of linePlan) {
      const id = numberToId.get(number);
      if (!id) continue;
      lines.forEach((l, i) => lineInserts.push({ document_id: id, position: i, ...l }));
    }
    for (let i = 0; i < lineInserts.length; i += 300) {
      const { error } = await supabase.from("line_items").insert(lineInserts.slice(i, i + 300));
      if (error) throw new Error(`line_item insert: ${error.message}`);
    }

    const paymentInserts = payments
      .map((p) => ({
        invoice_id: numberToId.get(p.number),
        amount: p.amount,
        date: p.date,
        method: "",
        note: "Imported from Harvest",
      }))
      .filter((p) => p.invoice_id);
    for (let i = 0; i < paymentInserts.length; i += 300) {
      const { error } = await supabase.from("payments").insert(paymentInserts.slice(i, i + 300));
      if (error) throw new Error(`payment insert: ${error.message}`);
    }

    console.log(`\n   ✓ inserted ${docs.length} invoices + ${lineInserts.length} line items + ${paymentInserts.length} payments`);
  }

  console.log(`\n${"=".repeat(40)}\n${commit ? "Done." : "Dry run only — re-run with --commit to apply."}\n`);
}

main().catch((e) => {
  console.error("\nImport failed:", e.message);
  process.exit(1);
});
