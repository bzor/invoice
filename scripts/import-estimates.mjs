/**
 * One-time Harvest → bzor-invoice estimate importer.
 * Run AFTER clients/contacts are imported (it links by client name).
 *
 * Usage:
 *   node --env-file=.env.local scripts/import-estimates.mjs            # dry run
 *   node --env-file=.env.local scripts/import-estimates.mjs --commit   # write
 *   [--file docs/harvest_estimate_report.csv]
 *
 * Idempotent: matched by (type='estimate', number=Harvest ID).
 */
import { readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const commit = args.includes("--commit");
const fileIdx = args.indexOf("--file");
const file =
  fileIdx >= 0 ? args[fileIdx + 1] : "docs/harvest_estimate_report.csv";

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
const dateOrNull = (v) => (norm(v) ? norm(v) : null);

async function main() {
  console.log(`\n${commit ? "COMMIT" : "DRY RUN"} — estimate import\n${"=".repeat(40)}`);

  const { data: settings } = await supabase
    .from("settings")
    .select("base_currency")
    .eq("id", 1)
    .single();
  const base = settings?.base_currency ?? "USD";

  // Lookup maps from already-imported data.
  const { data: clients } = await supabase.from("clients").select("id, name");
  const byName = new Map(clients.map((c) => [c.name.trim().toLowerCase(), c.id]));
  const { data: primaries } = await supabase
    .from("contacts")
    .select("client_id, id")
    .eq("is_primary", true);
  const primaryByClient = new Map(primaries.map((p) => [p.client_id, p.id]));

  const { data: existing } = await supabase
    .from("documents")
    .select("number")
    .eq("type", "estimate");
  const existingNumbers = new Set((existing ?? []).map((d) => d.number));

  const rows = parse(readFileSync(file, "utf8"), {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  });

  const docs = [];
  const lineMeta = new Map(); // number -> { description, amount }
  const seen = new Set();
  let skippedExisting = 0,
    skippedNoClient = 0,
    dupes = 0;

  for (const r of rows) {
    const number = norm(r["ID"]);
    if (!number) continue;
    if (existingNumbers.has(number)) {
      skippedExisting++;
      continue;
    }
    if (seen.has(number)) {
      dupes++;
      continue;
    }
    seen.add(number);

    const clientId = byName.get(norm(r["Client"]).toLowerCase());
    if (!clientId) {
      skippedNoClient++;
      continue;
    }

    const subtotal = money(r["Subtotal"]);
    const discount = money(r["Discount"]);
    const total = money(r["Estimate Amount"]); // == subtotal - discount (no tax)
    const accepted = dateOrNull(r["Accepted Date"]);
    const declined = dateOrNull(r["Declined Date"]);
    const status = accepted ? "approved" : declined ? "declined" : "sent";
    const currency = currencyCode(r["Currency"]);
    const subject = norm(r["Subject"]);

    docs.push({
      type: "estimate",
      number,
      status,
      client_id: clientId,
      contact_id: primaryByClient.get(clientId) ?? null,
      po_number: norm(r["PO Number"]),
      subject,
      issue_date: norm(r["Issue Date"]) || null,
      currency,
      base_currency: base,
      fx_rate: currency === base ? 1 : 1, // all USD here; invoices handle FX
      discount_type: "amount",
      discount_value: discount,
      subtotal,
      discount_total: discount,
      total,
      bank_info_mode: "none",
      approved_at: accepted,
      declined_at: declined,
      sent_at: status === "sent" ? norm(r["Issue Date"]) || null : null,
    });
    lineMeta.set(number, {
      description: subject || "Estimated services",
      amount: subtotal,
    });
  }

  const byStatus = docs.reduce((a, d) => ((a[d.status] = (a[d.status] || 0) + 1), a), {});
  console.log(
    `\nEstimates: ${rows.length} in CSV · ${docs.length} to create · ` +
      `${skippedExisting} already imported · ${skippedNoClient} no-client · ${dupes} duplicate ID`,
  );
  console.log("  status:", JSON.stringify(byStatus));
  docs.slice(0, 5).forEach((d) =>
    console.log(`   + ${d.number}  ${d.status.padEnd(8)} ${d.currency} ${d.total}  ${d.subject.slice(0, 40)}`),
  );
  if (docs.length > 5) console.log(`   … and ${docs.length - 5} more`);

  if (commit && docs.length) {
    const numberToId = new Map();
    for (let i = 0; i < docs.length; i += 100) {
      const batch = docs.slice(i, i + 100);
      const { data, error } = await supabase
        .from("documents")
        .insert(batch)
        .select("id, number");
      if (error) throw new Error(`document insert: ${error.message}`);
      for (const d of data) numberToId.set(d.number, d.id);
    }
    const lines = [];
    for (const [number, meta] of lineMeta) {
      const id = numberToId.get(number);
      if (!id) continue;
      lines.push({
        document_id: id,
        position: 0,
        description: meta.description,
        quantity: 1,
        unit_price: meta.amount,
        line_total: meta.amount,
      });
    }
    for (let i = 0; i < lines.length; i += 200) {
      const { error } = await supabase
        .from("line_items")
        .insert(lines.slice(i, i + 200));
      if (error) throw new Error(`line_item insert: ${error.message}`);
    }
    console.log(`\n   ✓ inserted ${docs.length} estimates + ${lines.length} line items`);
  }

  console.log(
    `\n${"=".repeat(40)}\n${commit ? "Done." : "Dry run only — re-run with --commit to apply."}\n`,
  );
}

main().catch((e) => {
  console.error("\nImport failed:", e.message);
  process.exit(1);
});
