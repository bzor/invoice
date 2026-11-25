import { ApiError, api, readBody } from "@/lib/api";
import { detail, loadDocument } from "@/lib/api-documents";
import { sendDocumentCore } from "@/lib/core/send";
import { getDocument } from "@/lib/data";

/**
 * POST /api/v1/documents/:id/send — email the document, PDF attached, to its
 * contact (or `to`) and mark it sent. Body: { confirm: true, to?, message? }
 *
 * This puts mail in a client's inbox and cannot be taken back, so the body must
 * carry `confirm: true` — a deliberate extra step for the calling agent, which
 * should have its user's go-ahead for this specific document first.
 */
export const POST = api<{ id: string }>(async ({ db, params, url, request }) => {
  const doc = await loadDocument(db, params.id, url);
  const body = await readBody(request);

  if (body.confirm !== true) {
    throw new ApiError(
      400,
      'Sending emails the client. Get the user\'s go-ahead, then repeat with "confirm": true',
      { would_send_to: body.to ?? doc.contact?.email ?? null },
    );
  }
  if (doc.status === "void") {
    throw new ApiError(409, `${doc.number} is void and cannot be sent`);
  }
  if (body.to !== undefined && typeof body.to !== "string") {
    throw new ApiError(400, "to must be an email address");
  }

  const result = await sendDocumentCore(db, {
    id: doc.id,
    to: body.to as string | undefined,
    message: typeof body.message === "string" ? body.message : undefined,
  });
  if (!result.ok) throw new ApiError(422, result.error);

  return { sent_to: result.to, document: detail((await getDocument(doc.id, db))!) };
});
