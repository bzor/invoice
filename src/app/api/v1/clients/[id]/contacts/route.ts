import { ApiError, api, isUuid, readBody } from "@/lib/api";
import { clientView, loadClient, parseContact } from "@/lib/api-clients";
import { saveContactCore } from "@/lib/core/clients";

/**
 * POST /api/v1/clients/:id/contacts — add a contact to a client.
 * Body: { name, email?, phone?, title?, is_primary?, notes? }
 * A client's first contact becomes its primary unless `is_primary` is false.
 */
export const POST = api<{ id: string }>(async ({ db, params, request }) => {
  if (!isUuid(params.id)) throw new ApiError(400, "Client id must be a uuid");
  const client = await loadClient(db, params.id);
  const contact = parseContact(await readBody(request));

  const email = contact.email.toLowerCase();
  const existing = email
    ? client.contacts.find((c) => c.email.trim().toLowerCase() === email)
    : undefined;
  if (existing) {
    throw new ApiError(
      409,
      `${client.name} already has a contact with ${contact.email}: ${existing.name}`,
      { contact_id: existing.id },
    );
  }

  await saveContactCore(db, {
    ...contact,
    client_id: client.id,
    is_primary: contact.is_primary ?? client.contacts.length === 0,
  });
  return Response.json(clientView(await loadClient(db, client.id)), { status: 201 });
});
