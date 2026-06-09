import { today } from "@/lib/dates";
import type { DocStatus, DocumentRow } from "@/lib/types";

/**
 * Display status. Stored status is authoritative for draft/sent/approved/
 * declined/void/paid; "overdue" and "partial" are derived from payments + due
 * date so lists and badges stay accurate without a cron job.
 */
export function effectiveStatus(
  doc: Pick<DocumentRow, "type" | "status" | "total" | "due_date">,
  paidAmount: number,
): DocStatus {
  if (doc.type === "estimate") return doc.status;
  if (doc.status === "draft" || doc.status === "void") return doc.status;

  const due = Number(doc.total) - paidAmount;
  if (due <= 0.005) return "paid";
  if (doc.due_date && doc.due_date < today()) return "overdue";
  if (paidAmount > 0.005) return "partial";
  return doc.status;
}
