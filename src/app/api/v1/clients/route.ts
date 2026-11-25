import { ApiError, api, readBody } from "@/lib/api";
import {
  CLIENT_FIELDS,
  clientView,
  listClients,
  loadClient,
  parseClient,
  parseContact,
  rejectUnknown,
  similarClients,
  squash,
} from "@/lib/api-clients";
import { saveClientCore, saveContactCore } from "@/lib/core/clients";

/** GET /api/v1/clients?q= — clients with their contacts; `q` matches the name. */
export const GET = api(async ({ db, url }) => {
  // Match every word of the query somewhere in the name, so "acme labs" finds
  // "Acme Research Labs, Inc." without the caller knowing the exact name.
  const words = (url.searchParams.get("q") ?? "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const clients = (await listClients(db))
    .filter((c) => {
      // Also compare with punctuation stripped, so "gsp" finds "GS&P".
      const name = c.name.toLowerCase();
      const bare = squash(c.name);
      return words.every(
        (w) => name.includes(w) || (squash(w) && bare.includes(squash(w))),
      );
    })
    .map(clientView);
  return { count: clients.length, clients };
});

/**
 * POST /api/v1/clients — create a client, optionally with its contacts.
 * Body: { name, address?, currency?, default_net_terms?, default_notes?,
 *         contacts?: [{ name, email?, phone?, title?, is_primary?, notes? }],
 *         allow_similar? }
 *
 * A name that looks like an existing client's is refused with the candidates,
 * unless `allow_similar` is true: near-duplicate clients already exist and each
 * one splits a customer's history across two records.
 */
export const POST = api(async ({ db, request }) => {
  const body = await readBody(request);
  rejectUnknown(body, [...CLIENT_FIELDS, "contacts", "allow_similar"]);
  const client = parseClient(body);

  if (body.contacts !== undefined && !Array.isArray(body.contacts)) {
    throw new ApiError(400, "contacts must be an array");
  }
  const contacts = ((body.contacts as unknown[]) ?? []).map((c, i) =>
    parseContact(c, `contacts[${i}]`),
  );
  if (contacts.filter((c) => c.is_primary).length > 1) {
    throw new ApiError(400, "Only one contact can be primary");
  }

  if (body.allow_similar !== true) {
    const similar = similarClients(client.name, await listClients(db));
    if (similar.length) {
      throw new ApiError(
        409,
        `"${client.name}" looks like an existing client. Use that one, or repeat with "allow_similar": true if this really is a different client`,
        { similar: similar.map(clientView) },
      );
    }
  }

  const id = await saveClientCore(db, client);
  // With no explicit choice, the first contact listed is the primary.
  const primaryIndex = Math.max(0, contacts.findIndex((c) => c.is_primary));
  for (const [i, c] of contacts.entries()) {
    await saveContactCore(db, { ...c, client_id: id, is_primary: i === primaryIndex });
  }

  return Response.json(clientView(await loadClient(db, id)), { status: 201 });
});
