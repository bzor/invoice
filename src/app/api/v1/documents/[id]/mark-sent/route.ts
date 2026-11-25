import { ApiError, api } from "@/lib/api";
import { detail, loadDocument } from "@/lib/api-documents";
import { markSentCore } from "@/lib/core/documents";
import { getDocument } from "@/lib/data";

/**
 * POST /api/v1/documents/:id/mark-sent — mark a document sent without emailing
 * it, for one delivered another way (a vendor portal, a personal email).
 *
 * Only from the statuses the email send path also advances: a draft, or an
 * approved estimate. Anything further along (partial, paid, void, declined)
 * would be knocked backwards, so it is refused. Already sent is a no-op, which
 * keeps the original sent date and makes a retry harmless.
 */
export const POST = api<{ id: string }>(async ({ db, params, url }) => {
  const doc = await loadDocument(db, params.id, url);

  if (doc.status === "sent") return detail(doc);
  if (doc.status !== "draft" && doc.status !== "approved") {
    throw new ApiError(
      409,
      `${doc.number} is ${doc.status}; only a draft or an approved estimate can be marked sent`,
    );
  }

  await markSentCore(db, doc.id);
  return detail((await getDocument(doc.id, db))!);
});
