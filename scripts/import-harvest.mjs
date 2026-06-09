/**
 * One-time Harvest → bzor-invoice importer (clients + contacts).
 *
 * Usage:
 *   node --env-file=.env.local scripts/import-harvest.mjs            # dry run
 *   node --env-file=.env.local scripts/import-harvest.mjs --commit   # write
 *
 * Optional flags:
 *   --clients <path>   (default docs/harvest_client_list.csv)
 *   --contacts <path>  (default docs/harvest_contact_list.csv)
 *
 * Idempotent: clients matched by name, contacts by (client, email|name).
 */
import { readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const commit = args.includes("--commit");
const flag = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const clientsPath = flag("--clients", "docs/harvest_client_list.csv");
const contactsPath = flag("--contacts", "docs/harvest_contact_list.csv");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase env. Run with --env-file=.env.local");
  process.exit(2);
}
const supabase = createClient(url, key, {
  auth: { persistSession: false },
});

const norm = (v) => (v ?? "").trim();
const readCsv = (path) =>
  parse(readFileSync(path, "utf8"), {
    columns: true,
    skip_empty_lines: true,
    trim: false,
    bom: true,
  });

function log(...a) {
  console.log(...a);
}

async function main() {
  log(`\n${commit ? "COMMIT" : "DRY RUN"} — Harvest import\n${"=".repeat(40)}`);

  // ── Clients ───────────────────────────────────────────────────────────
  const clientRows = readCsv(clientsPath);
  const { data: existingClients } = await supabase
    .from("clients")
    .select("id, name");
  const byName = new Map(
    (existingClients ?? []).map((c) => [c.name.trim().toLowerCase(), c.id]),
  );

  const clientsToInsert = [];
  for (const row of clientRows) {
    const name = norm(row["Client Name"]);
    if (!name) continue;
    if (byName.has(name.toLowerCase())) continue;
    if (clientsToInsert.some((c) => c.name.toLowerCase() === name.toLowerCase()))
      continue;
    clientsToInsert.push({ name, address: norm(row["Address"]), currency: "USD" });
  }

  log(
    `\nClients: ${clientRows.length} in CSV · ${byName.size} already in DB · ${clientsToInsert.length} to create`,
  );
  clientsToInsert.slice(0, 5).forEach((c) => log(`   + ${c.name}`));
  if (clientsToInsert.length > 5) log(`   … and ${clientsToInsert.length - 5} more`);

  if (commit && clientsToInsert.length) {
    for (let i = 0; i < clientsToInsert.length; i += 100) {
      const batch = clientsToInsert.slice(i, i + 100);
      const { data, error } = await supabase
        .from("clients")
        .insert(batch)
        .select("id, name");
      if (error) throw new Error(`client insert: ${error.message}`);
      for (const c of data) byName.set(c.name.trim().toLowerCase(), c.id);
    }
    log(`   ✓ inserted ${clientsToInsert.length} clients`);
  } else {
    // Simulate new client ids so the contact preview below is accurate.
    for (const c of clientsToInsert)
      byName.set(c.name.toLowerCase(), `dry:${c.name.toLowerCase()}`);
  }

  // ── Contacts ──────────────────────────────────────────────────────────
  const contactRows = readCsv(contactsPath);

  // Existing contacts per client, to avoid duplicates + know who has a primary.
  const { data: existingContacts } = await supabase
    .from("contacts")
    .select("client_id, name, email, is_primary");
  const seen = new Set(); // `${client_id}|${email||name}`
  const clientHasPrimary = new Set();
  for (const c of existingContacts ?? []) {
    seen.add(`${c.client_id}|${(c.email || c.name).toLowerCase()}`);
    if (c.is_primary) clientHasPrimary.add(c.client_id);
  }

  const contactsToInsert = [];
  let skippedNoClient = 0;
  const primaryAssignedThisRun = new Set();

  for (const row of contactRows) {
    const clientName = norm(row["Client"]).toLowerCase();
    const clientId = byName.get(clientName);
    if (!clientId) {
      skippedNoClient++;
      continue;
    }
    const name =
      [norm(row["First Name"]), norm(row["Last Name"])].filter(Boolean).join(" ") ||
      norm(row["Email"]);
    if (!name) continue;

    const email = norm(row["Email"]);
    const dedupeKey = `${clientId}|${(email || name).toLowerCase()}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    // First contact for a client with no existing primary becomes primary.
    let isPrimary = false;
    if (!clientHasPrimary.has(clientId) && !primaryAssignedThisRun.has(clientId)) {
      isPrimary = true;
      primaryAssignedThisRun.add(clientId);
    }

    contactsToInsert.push({
      client_id: clientId,
      name,
      title: norm(row["Title"]),
      email,
      phone: norm(row["Mobile Phone"]) || norm(row["Office Phone"]),
      is_primary: isPrimary,
    });
  }

  log(
    `\nContacts: ${contactRows.length} in CSV · ${contactsToInsert.length} to create · ${skippedNoClient} skipped (no matching client)`,
  );
  contactsToInsert
    .slice(0, 5)
    .forEach((c) =>
      log(`   + ${c.name}${c.is_primary ? " (primary)" : ""} <${c.email || "no email"}>`),
    );
  if (contactsToInsert.length > 5)
    log(`   … and ${contactsToInsert.length - 5} more`);

  if (commit && contactsToInsert.length) {
    for (let i = 0; i < contactsToInsert.length; i += 100) {
      const batch = contactsToInsert.slice(i, i + 100);
      const { error } = await supabase.from("contacts").insert(batch);
      if (error) throw new Error(`contact insert: ${error.message}`);
    }
    log(`   ✓ inserted ${contactsToInsert.length} contacts`);
  }

  log(
    `\n${"=".repeat(40)}\n${
      commit
        ? "Done."
        : "Dry run only — nothing written. Re-run with --commit to apply."
    }\n`,
  );
}

main().catch((e) => {
  console.error("\nImport failed:", e.message);
  process.exit(1);
});
