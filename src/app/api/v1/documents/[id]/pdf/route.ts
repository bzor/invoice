import { ApiError, api } from "@/lib/api";
import { loadDocument } from "@/lib/api-documents";
import { getPdfData } from "@/lib/data";
import { renderDocumentPdf } from "@/lib/pdf/document-pdf";

/** GET /api/v1/documents/:id/pdf — the rendered PDF (same template as email). */
export const GET = api<{ id: string }>(async ({ db, params, url }) => {
  const doc = await loadDocument(db, params.id, url);
  const data = await getPdfData(doc.id, db);
  if (!data) throw new ApiError(404, "Document not found");

  const pdf = await renderDocumentPdf(data);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${doc.number}.pdf"`,
    },
  });
});
