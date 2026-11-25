import { ApiError, api, isIsoDate, readBody } from "@/lib/api";
import { detail, loadDocument } from "@/lib/api-documents";
import { recordPaymentCore } from "@/lib/core/payments";
import { amountPaid, getDocument } from "@/lib/data";
import { round2 } from "@/lib/money";

/**
 * POST /api/v1/documents/:id/payments — record a payment on a sent invoice.
 * Body: { amount, date?, method?, note?, allow_overpayment? }
 */
export const POST = api<{ id: string }>(async ({ db, params, url, request }) => {
  const doc = await loadDocument(db, params.id, url);
  const body = await readBody(request);

  if (doc.type !== "invoice") {
    throw new ApiError(409, "Payments can only be recorded on invoices");
  }
  if (doc.status === "draft" || doc.status === "void") {
    throw new ApiError(409, `${doc.number} is ${doc.status}; it cannot take payments`);
  }
  const amount = body.amount;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(400, "amount must be a positive number");
  }
  if (body.date !== undefined && !isIsoDate(body.date)) {
    throw new ApiError(400, "date must be YYYY-MM-DD");
  }

  // A payment larger than the balance is far more often a typo or the wrong
  // invoice than a real overpayment, so make the caller say it is intended.
  const balance = round2(Number(doc.total) - amountPaid(doc.payments));
  if (amount > balance + 0.005 && body.allow_overpayment !== true) {
    throw new ApiError(
      409,
      `amount ${amount} exceeds the balance due of ${balance} ${doc.currency}`,
      { balance_due: Math.max(0, balance) },
    );
  }

  await recordPaymentCore(db, {
    invoice_id: doc.id,
    amount,
    date: body.date as string | undefined,
    method: typeof body.method === "string" ? body.method : "",
    note: typeof body.note === "string" ? body.note : "",
  });
  return Response.json(detail((await getDocument(doc.id, db))!), { status: 201 });
});
