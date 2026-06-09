import "server-only";

import { createClient } from "@/lib/supabase/server";
import { toBase } from "@/lib/money";
import type {
  Client,
  Contact,
  DocStatus,
  DocType,
  DocumentRow,
  DocumentWithRelations,
  LineItem,
  Payment,
  Settings,
} from "@/lib/types";

export async function getSettings(): Promise<Settings> {
  const supabase = await createClient();
  const { data } = await supabase.from("settings").select("*").eq("id", 1).single();
  return data as unknown as Settings;
}

export async function listClients(): Promise<
  (Client & { contacts: { count: number }[]; documents: { count: number }[] })[]
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("clients")
    .select("*, contacts(count), documents(count)")
    .order("name");
  return (data ?? []) as never;
}

export async function getClient(id: string): Promise<
  (Client & { contacts: Contact[] }) | null
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("clients")
    .select("*, contacts(*)")
    .eq("id", id)
    .single();
  return (data as never) ?? null;
}

export type EditorClient = Pick<
  Client,
  "id" | "name" | "currency" | "default_net_terms" | "default_notes"
> & { contacts: Pick<Contact, "id" | "name" | "is_primary">[] };

export async function listClientsForEditor(): Promise<EditorClient[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("clients")
    .select(
      "id, name, currency, default_net_terms, default_notes, contacts(id, name, is_primary)",
    )
    .order("name");
  return (data ?? []) as unknown as EditorClient[];
}

export async function listDocumentsForClient(
  clientId: string,
): Promise<DocumentRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select("*")
    .eq("client_id", clientId)
    .order("issue_date", { ascending: false });
  return (data ?? []) as unknown as DocumentRow[];
}

export type DocumentListItem = DocumentRow & {
  client: Client | null;
  payments: { amount: number }[];
};

export async function listDocuments(
  type: DocType,
  opts: { status?: DocStatus[] } = {},
): Promise<DocumentListItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("documents")
    .select("*, client:clients(*), payments(amount)")
    .eq("type", type)
    .order("issue_date", { ascending: false });

  if (opts.status?.length) query = query.in("status", opts.status);

  const { data } = await query;
  return (data ?? []) as unknown as DocumentListItem[];
}

export async function getDocument(
  id: string,
): Promise<DocumentWithRelations | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select(
      "*, client:clients(*), contact:contacts(*), line_items(*), payments(*)",
    )
    .eq("id", id)
    .single();

  if (!data) return null;
  const doc = data as unknown as DocumentWithRelations;
  doc.line_items = (doc.line_items ?? []).sort((a, b) => a.position - b.position);
  return doc;
}

export async function listContactEmailsForClient(
  clientId: string,
): Promise<{ name: string; email: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contacts")
    .select("name, email, is_primary")
    .eq("client_id", clientId)
    .order("is_primary", { ascending: false })
    .order("name");
  return ((data ?? []) as { name: string; email: string }[]).filter(
    (c) => c.email,
  );
}

export async function findInvoiceFromEstimate(
  estimateId: string,
): Promise<{ id: string; number: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select("id, number")
    .eq("source_estimate_id", estimateId)
    .maybeSingle();
  return (data as { id: string; number: string } | null) ?? null;
}

export async function getPdfData(id: string) {
  const [doc, settings] = await Promise.all([getDocument(id), getSettings()]);
  if (!doc) return null;
  return {
    doc: doc as DocumentRow,
    client: doc.client,
    contact: doc.contact,
    lineItems: doc.line_items,
    settings,
  };
}

export function amountPaid(
  payments: { amount: number }[] | undefined,
): number {
  return (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
}

/** Dashboard rollups, all converted to the base currency. */
export async function getDashboardStats() {
  const supabase = await createClient();
  const settings = await getSettings();

  const { data: invoices } = await supabase
    .from("documents")
    .select("id, total, fx_rate, status, due_date, payments(amount)")
    .eq("type", "invoice")
    .neq("status", "void");

  const now = new Date();
  const yearStart = `${now.getFullYear()}-01-01`;
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthStart = lastMonth.toISOString().slice(0, 10);
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);

  let outstanding = 0;
  let overdueCount = 0;
  const today = now.toISOString().slice(0, 10);

  type InvoiceRollupRow = {
    total: number;
    fx_rate: number;
    status: string;
    due_date: string | null;
    payments: { amount: number }[];
  };

  for (const inv of (invoices ?? []) as unknown as InvoiceRollupRow[]) {
    const paid = amountPaid(inv.payments as Payment[]);
    const due = Number(inv.total) - paid;
    if (due > 0.005 && inv.status !== "draft") {
      outstanding += toBase(due, Number(inv.fx_rate));
      if (inv.due_date && inv.due_date < today) overdueCount++;
    }
  }

  // Payment-based rollups (each payment converted via its invoice fx_rate).
  const { data: payments } = await supabase
    .from("payments")
    .select("amount, date, invoice:documents(fx_rate)")
    .gte("date", yearStart);

  let paidThisYear = 0;
  let paidLastMonth = 0;
  type PaymentRow = {
    amount: number;
    date: string;
    invoice: { fx_rate: number } | null;
  };
  for (const p of (payments ?? []) as unknown as PaymentRow[]) {
    const fx = Number(p.invoice?.fx_rate ?? 1);
    const base = toBase(Number(p.amount), fx);
    paidThisYear += base;
    if (p.date >= lastMonthStart && p.date < thisMonthStart) paidLastMonth += base;
  }

  return {
    baseCurrency: settings.base_currency,
    outstanding,
    overdueCount,
    paidThisYear,
    paidLastMonth,
  };
}

export type YearlyReport = {
  year: number;
  baseCurrency: string;
  invoiced: number;
  paid: number;
  quarters: { invoiced: number; paid: number }[];
  byClient: { name: string; invoiced: number; paid: number }[];
};

export async function getYearlyReport(year: number): Promise<YearlyReport> {
  const supabase = await createClient();
  const settings = await getSettings();
  const start = `${year}-01-01`;
  const end = `${year + 1}-01-01`;

  // Invoices issued in the year (for "invoiced" + by-client invoiced).
  const { data: invoices } = await supabase
    .from("documents")
    .select("total, fx_rate, issue_date, client:clients(name)")
    .eq("type", "invoice")
    .neq("status", "void")
    .gte("issue_date", start)
    .lt("issue_date", end);

  // Payments received in the year (for "paid" + by-client paid).
  const { data: payments } = await supabase
    .from("payments")
    .select("amount, date, invoice:documents(fx_rate, client:clients(name))")
    .gte("date", start)
    .lt("date", end);

  const quarters = [0, 1, 2, 3].map(() => ({ invoiced: 0, paid: 0 }));
  const byClient = new Map<string, { invoiced: number; paid: number }>();
  const bump = (name: string) => {
    if (!byClient.has(name)) byClient.set(name, { invoiced: 0, paid: 0 });
    return byClient.get(name)!;
  };

  let invoiced = 0;
  for (const row of (invoices ?? []) as unknown as {
    total: number;
    fx_rate: number;
    issue_date: string;
    client: { name: string } | null;
  }[]) {
    const base = toBase(Number(row.total), Number(row.fx_rate));
    invoiced += base;
    quarters[quarterOf(row.issue_date)].invoiced += base;
    bump(row.client?.name ?? "—").invoiced += base;
  }

  let paid = 0;
  for (const row of (payments ?? []) as unknown as {
    amount: number;
    date: string;
    invoice: { fx_rate: number; client: { name: string } | null } | null;
  }[]) {
    const base = toBase(Number(row.amount), Number(row.invoice?.fx_rate ?? 1));
    paid += base;
    quarters[quarterOf(row.date)].paid += base;
    bump(row.invoice?.client?.name ?? "—").paid += base;
  }

  return {
    year,
    baseCurrency: settings.base_currency,
    invoiced,
    paid,
    quarters,
    byClient: [...byClient.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.invoiced - a.invoiced),
  };
}

function quarterOf(date: string): number {
  const m = Number(date.slice(5, 7));
  return Math.floor((m - 1) / 3);
}

export type DocLineInput = Pick<
  LineItem,
  "description" | "quantity" | "unit_price"
>;
