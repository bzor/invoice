import { api } from "@/lib/api";
import { detail, loadDocument } from "@/lib/api-documents";
import { duplicateDocumentCore } from "@/lib/core/documents";
import { getDocument } from "@/lib/data";

/** POST /api/v1/documents/:id/duplicate — new draft copy, dated today. */
export const POST = api<{ id: string }>(async ({ db, params, url }) => {
  const src = await loadDocument(db, params.id, url);
  const { id } = await duplicateDocumentCore(db, src.id);
  return Response.json(detail((await getDocument(id, db))!), { status: 201 });
});
