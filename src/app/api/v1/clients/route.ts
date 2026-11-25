import { api, fetchAll } from "@/lib/api";
import type { Client, Contact } from "@/lib/types";

/** GET /api/v1/clients?q= — clients with their contacts; `q` matches the name. */
export const GET = api(async ({ db, url }) => {
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();

  const rows = await fetchAll<Client & { contacts: Contact[] }>((from, to) =>
    db
      .from("clients")
      .select("*, contacts(*)")
      .order("name")
      .order("id")
      .range(from, to),
  );

  // Match every word of the query somewhere in the name, so "acme labs" finds
  // "Acme Research Labs, Inc." without the caller knowing the exact name.
  const words = q.split(/\s+/).filter(Boolean);
  const clients = rows
    .filter((c) => words.every((w) => c.name.toLowerCase().includes(w)))
    .map((c) => ({
      id: c.id,
      name: c.name,
      currency: c.currency,
      default_net_terms: c.default_net_terms,
      address: c.address,
      contacts: [...c.contacts]
        .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
        .map((p) => ({
          id: p.id,
          name: p.name,
          email: p.email,
          title: p.title,
          is_primary: p.is_primary,
        })),
    }));

  return { count: clients.length, clients };
});
