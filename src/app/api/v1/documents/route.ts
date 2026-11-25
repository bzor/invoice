import { ApiError, api, isIsoDate, isUuid, parseDocType, readBody } from "@/lib/api";
import {
  buildCreateInput,
  detail,
  listSummaries,
  outstandingOf,
} from "@/lib/api-documents";
import { saveDocumentCore } from "@/lib/core/documents";
import { getDocument } from "@/lib/data";

const STATUSES = [
  "draft",
  "sent",
  "approved",
  "declined",
  "partial",
  "paid",
  "overdue",
  "void",
];

/**
 * GET /api/v1/documents — list, newest first.
 *   type=invoice|estimate   status=<a,b>|outstanding   client_id=<uuid>
 *   q=<text in number/subject/client/PO>   since= until=<YYYY-MM-DD issue date>
 *   limit=<n, default 50, max 500>
 */
export const GET = api(async ({ db, url }) => {
  const p = url.searchParams;
  let type = parseDocType(p.get("type"));

  const clientId = p.get("client_id") ?? undefined;
  if (clientId && !isUuid(clientId)) throw new ApiError(400, "client_id must be a uuid");
  const since = p.get("since") ?? undefined;
  const until = p.get("until") ?? undefined;
  if ((since && !isIsoDate(since)) || (until && !isIsoDate(until))) {
    throw new ApiError(400, "since / until must be YYYY-MM-DD");
  }

  const statuses = (p.get("status") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const outstanding = statuses.includes("outstanding");
  if (outstanding && statuses.length > 1) {
    throw new ApiError(400, '"outstanding" cannot be combined with other statuses');
  }
  const unknown = statuses.filter((s) => s !== "outstanding" && !STATUSES.includes(s));
  if (unknown.length) {
    throw new ApiError(400, `Unknown status: ${unknown.join(", ")}`, {
      allowed: [...STATUSES, "outstanding"],
    });
  }
  if (outstanding) {
    if (type === "estimate") throw new ApiError(400, "Only invoices can be outstanding");
    type = "invoice";
  }

  const limit = Number(p.get("limit") ?? 50);
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new ApiError(400, "limit must be between 1 and 500");
  }

  let docs = await listSummaries(db, { type, clientId, since, until });
  if (outstanding) docs = outstandingOf(docs);
  else if (statuses.length) docs = docs.filter((d) => statuses.includes(d.status));

  const words = (p.get("q") ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length) {
    docs = docs.filter((d) => {
      const hay = `${d.number} ${d.subject} ${d.po_number} ${d.client?.name ?? ""}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }

  return {
    count: docs.length,
    truncated: docs.length > limit,
    documents: docs.slice(0, limit),
  };
});

/** POST /api/v1/documents — create a draft invoice or estimate. Emails no one. */
export const POST = api(async ({ db, request }) => {
  const input = await buildCreateInput(db, await readBody(request));
  const { id } = await saveDocumentCore(db, input);
  const doc = await getDocument(id, db);
  return Response.json(detail(doc!), { status: 201 });
});
