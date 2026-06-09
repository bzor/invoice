import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const ref = process.env.NEXT_PUBLIC_SUPABASE_URL.match(
  /https:\/\/([^.]+)\.supabase\.co/,
)[1];
const password = process.env.DATABASE_PASSWORD;

// Try direct connection first, then session-mode pooler as fallback.
const candidates = [
  `postgresql://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`,
  ...["us-east-1", "us-east-2", "us-west-1", "eu-central-1", "ap-southeast-1"].map(
    (r) =>
      `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-${r}.pooler.supabase.com:5432/postgres`,
  ),
];

const dir = join(process.cwd(), "supabase", "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

async function tryConnect(conn) {
  const client = new pg.Client({
    connectionString: conn,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });
  await client.connect();
  return client;
}

let client;
for (const conn of candidates) {
  try {
    client = await tryConnect(conn);
    console.log("Connected via", conn.replace(/:[^:@]+@/, ":****@"));
    break;
  } catch (e) {
    console.log("  ✗", conn.split("@")[1]?.split("/")[0], "-", e.message);
  }
}
if (!client) {
  console.error("Could not connect to the database.");
  process.exit(2);
}

for (const f of files) {
  const sql = readFileSync(join(dir, f), "utf8");
  process.stdout.write(`Running ${f} … `);
  try {
    await client.query(sql);
    console.log("ok");
  } catch (e) {
    console.log("FAILED");
    console.error(e.message);
    await client.end();
    process.exit(1);
  }
}

await client.end();
console.log("All migrations applied.");
