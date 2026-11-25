import "server-only";

import { ApiError, fetchAll } from "@/lib/api";
import { CURRENCIES } from "@/lib/currencies";
import { siteUrl } from "@/lib/env";
import type { Db } from "@/lib/supabase/db";
import type { Client, Contact } from "@/lib/types";

// Request parsing + response shaping for the /api/v1/clients routes.

export type ClientWithContacts = Client & { contacts: Contact[] };

export const contactView = (p: Contact) => ({
  id: p.id,
  name: p.name,
  email: p.email,
  title: p.title,
  phone: p.phone,
  is_primary: p.is_primary,
});

/** Agent-facing view of a client, primary contact first. */
export const clientView = (c: ClientWithContacts) => ({
  id: c.id,
  name: c.name,
  currency: c.currency,
  default_net_terms: c.default_net_terms,
  address: c.address,
  url: `${siteUrl()}/clients/${c.id}`,
  contacts: [...c.contacts]
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
    .map(contactView),
});

export function listClients(db: Db): Promise<ClientWithContacts[]> {
  return fetchAll<ClientWithContacts>((from, to) =>
    db
      .from("clients")
      .select("*, contacts(*)")
      .order("name")
      .order("id")
      .range(from, to),
  );
}

export async function loadClient(db: Db, id: string): Promise<ClientWithContacts> {
  const { data } = await db
    .from("clients")
    .select("*, contacts(*)")
    .eq("id", id)
    .maybeSingle();
  if (!data) throw new ApiError(404, `No client with id "${id}"`);
  return data as unknown as ClientWithContacts;
}

export const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Existing clients a new name might be a duplicate of: the same name ignoring
 * case and punctuation, or one name contained in the other ("GSP" vs
 * "GS&P San Francisco"). Deliberately loose — a false alarm costs the caller
 * one confirmation, a missed duplicate splits a client's billing history.
 */
export function similarClients(name: string, clients: ClientWithContacts[]) {
  const n = squash(name);
  if (!n) return [];
  return clients.filter((c) => {
    const m = squash(c.name);
    if (!m) return false;
    if (m === n) return true;
    const [short, long] = m.length < n.length ? [m, n] : [n, m];
    return short.length >= 3 && long.includes(short);
  });
}

const bad = (message: string) => new ApiError(400, message);

export function rejectUnknown(
  body: Record<string, unknown>,
  allowed: readonly string[],
  at = "",
) {
  const unknown = Object.keys(body).filter((k) => !allowed.includes(k));
  if (unknown.length) {
    throw new ApiError(400, `Unknown field(s): ${unknown.map((k) => at + k).join(", ")}`, {
      allowed_fields: allowed,
    });
  }
}

function text(body: Record<string, unknown>, key: string, at = ""): string {
  const v = body[key];
  if (v === undefined || v === null) return "";
  if (typeof v !== "string") throw bad(`${at}${key} must be a string`);
  return v.trim();
}

export const CLIENT_FIELDS = [
  "name",
  "address",
  "currency",
  "default_net_terms",
  "default_notes",
] as const;

export function parseClient(body: Record<string, unknown>) {
  const name = text(body, "name");
  if (!name) throw bad("name is required");

  const currency = (text(body, "currency") || "USD").toUpperCase();
  if (!(CURRENCIES as readonly string[]).includes(currency)) {
    throw bad(`currency must be one of ${CURRENCIES.join(", ")}`);
  }

  let terms: number | null = null;
  if (body.default_net_terms !== undefined && body.default_net_terms !== null) {
    const n = body.default_net_terms;
    if (typeof n !== "number" || !Number.isInteger(n) || n < 0) {
      throw bad("default_net_terms must be a whole number of days, or null");
    }
    terms = n;
  }

  return {
    name,
    address: text(body, "address"),
    currency,
    default_net_terms: terms,
    default_notes: text(body, "default_notes"),
  };
}

export const CONTACT_FIELDS = [
  "name",
  "email",
  "phone",
  "title",
  "is_primary",
  "notes",
] as const;

// Loose on purpose: catch typos and pasted names, not police RFC 5322.
const EMAIL = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

export function parseContact(raw: unknown, at = "") {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw bad(`${at || "contact"} must be an object`);
  }
  const body = raw as Record<string, unknown>;
  const prefix = at ? `${at}.` : "";
  rejectUnknown(body, CONTACT_FIELDS, prefix);

  const name = text(body, "name", prefix);
  if (!name) throw bad(`${prefix}name is required`);
  const email = text(body, "email", prefix);
  if (email && !EMAIL.test(email)) {
    throw bad(`${prefix}email "${email}" is not an email address`);
  }
  if (body.is_primary !== undefined && typeof body.is_primary !== "boolean") {
    throw bad(`${prefix}is_primary must be true or false`);
  }
  return {
    name,
    email,
    phone: text(body, "phone", prefix),
    title: text(body, "title", prefix),
    notes: text(body, "notes", prefix),
    is_primary: body.is_primary as boolean | undefined,
  };
}
