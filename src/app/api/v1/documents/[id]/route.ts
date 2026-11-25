import { ApiError, api, readBody } from "@/lib/api";
import { buildUpdateInput, detail, loadDocument } from "@/lib/api-documents";
import { saveDocumentCore } from "@/lib/core/documents";
import { getDocument } from "@/lib/data";

type Params = { id: string };

/** GET /api/v1/documents/:id — one document, by id or number. */
export const GET = api<Params>(async ({ db, params, url }) =>
  detail(await loadDocument(db, params.id, url)),
);

/**
 * PATCH /api/v1/documents/:id — edit a draft. Only drafts: once a document has
 * gone to a client, changes to it should be made deliberately in the web UI.
 */
export const PATCH = api<Params>(async ({ db, params, url, request }) => {
  const doc = await loadDocument(db, params.id, url);
  if (doc.status !== "draft") {
    throw new ApiError(
      409,
      `${doc.number} is ${doc.status}; only drafts can be edited through the API`,
    );
  }
  const input = await buildUpdateInput(db, doc, await readBody(request));
  await saveDocumentCore(db, input);
  return detail((await getDocument(doc.id, db))!);
});
