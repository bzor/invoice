import { ApiError, api, readBody } from "@/lib/api";
import { loadDocument } from "@/lib/api-documents";
import { sendReminderCore } from "@/lib/core/send";

/**
 * POST /api/v1/documents/:id/remind — email a payment reminder for an unpaid
 * invoice to its contact. Body: { confirm: true } (see the send route).
 */
export const POST = api<{ id: string }>(async ({ db, params, url, request }) => {
  const doc = await loadDocument(db, params.id, url);
  const body = await readBody(request);

  if (body.confirm !== true) {
    throw new ApiError(
      400,
      'A reminder emails the client. Get the user\'s go-ahead, then repeat with "confirm": true',
      { would_send_to: doc.contact?.email ?? null },
    );
  }
  if (doc.status === "draft" || doc.status === "void") {
    throw new ApiError(409, `${doc.number} is ${doc.status}; nothing to remind about`);
  }

  const result = await sendReminderCore(db, doc.id);
  if (!result.ok) throw new ApiError(422, result.error);
  return { sent_to: result.to, number: doc.number };
});
