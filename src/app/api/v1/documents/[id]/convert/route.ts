import { ApiError, api } from "@/lib/api";
import { detail, loadDocument } from "@/lib/api-documents";
import { convertToInvoiceCore } from "@/lib/core/documents";
import { findInvoiceFromEstimate, getDocument } from "@/lib/data";

/** POST /api/v1/documents/:id/convert — draft invoice from an estimate. */
export const POST = api<{ id: string }>(async ({ db, params, url }) => {
  const est = await loadDocument(db, params.id, url);
  if (est.type !== "estimate") {
    throw new ApiError(409, `${est.number} is an invoice; only estimates convert`);
  }
  // Converting twice would bill the same work twice; `?force=1` to do it anyway.
  const existing = await findInvoiceFromEstimate(est.id, db);
  if (existing && url.searchParams.get("force") !== "1") {
    throw new ApiError(
      409,
      `${est.number} was already converted to invoice ${existing.number}`,
      { invoice: existing },
    );
  }
  const { id } = await convertToInvoiceCore(db, est.id);
  return Response.json(detail((await getDocument(id, db))!), { status: 201 });
});
