"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { StatusBadge } from "@/components/ui";
import type { DocumentListItem } from "@/lib/data";
import { formatDate, today } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { effectiveStatus } from "@/lib/status";
import type { DocStatus, DocType } from "@/lib/types";

// Shared column template — header and rows use the same grid so columns line up.
const COLS = "sm:grid-cols-[9rem_0.7fr_1fr_7rem_8rem_7rem]";

const paidOf = (payments: { amount: number }[]) =>
  payments.reduce((s, p) => s + Number(p.amount), 0);

function daysOverdue(dueDate: string | null): number | null {
  if (!dueDate) return null;
  const d = Math.floor((Date.parse(today()) - Date.parse(dueDate)) / 86400000);
  return d > 0 ? d : null;
}

// Status tabs offered per document type (derived status, so overdue/paid work).
const FILTERS: Record<DocType, DocStatus[]> = {
  invoice: ["draft", "sent", "partial", "overdue", "paid"],
  estimate: ["draft", "sent", "approved", "declined"],
};

type Sort = "newest" | "oldest" | "amount-desc" | "amount-asc";

export function DocumentsTable({
  docs,
  type,
}: {
  docs: DocumentListItem[];
  type: DocType;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<DocStatus | "all">("all");
  const [sort, setSort] = useState<Sort>("newest");

  // Compute effective status once per doc.
  const withStatus = useMemo(
    () =>
      docs.map((d) => ({ d, s: effectiveStatus(d, paidOf(d.payments)) })),
    [docs],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: withStatus.length };
    for (const { s } of withStatus) c[s] = (c[s] ?? 0) + 1;
    return c;
  }, [withStatus]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = withStatus.filter(({ d, s }) => {
      if (status !== "all" && s !== status) return false;
      if (!q) return true;
      return (
        d.number.toLowerCase().includes(q) ||
        (d.client?.name ?? "").toLowerCase().includes(q) ||
        (d.subject ?? "").toLowerCase().includes(q)
      );
    });
    return [...list].sort((a, b) => {
      switch (sort) {
        case "oldest":
          return a.d.issue_date.localeCompare(b.d.issue_date);
        case "amount-desc":
          return Number(b.d.total) - Number(a.d.total);
        case "amount-asc":
          return Number(a.d.total) - Number(b.d.total);
        default:
          return b.d.issue_date.localeCompare(a.d.issue_date);
      }
    });
  }, [withStatus, query, status, sort]);

  const tabs: (DocStatus | "all")[] = ["all", ...FILTERS[type]];

  return (
    <div>
      {/* Toolbar — filter tabs, search, sort */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-grotesk text-xs uppercase tracking-wider">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setStatus(t)}
              className={`transition ${
                status === t ? "text-ink" : "text-muted hover:text-ink"
              }`}
            >
              {t === "all" ? "All" : t}
              <span className="ml-1 tnum text-faint">{counts[t] ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="w-44 border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none transition placeholder:text-faint focus:border-ink"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="border border-line bg-surface px-2 py-1.5 font-grotesk text-xs uppercase tracking-wider text-muted outline-none focus:border-ink"
            aria-label="Sort"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="amount-desc">Amount ↓</option>
            <option value="amount-asc">Amount ↑</option>
          </select>
        </div>
      </div>

      <div
        className={`hidden border-b border-line pb-2 font-grotesk text-xs uppercase tracking-wider text-muted sm:grid sm:gap-x-6 ${COLS}`}
      >
        <span>Number</span>
        <span>Client</span>
        <span>Subject</span>
        <span>Issued</span>
        <span className="text-right">Total</span>
        <span className="text-right">Status</span>
      </div>

      {rows.length === 0 ? (
        <p className="py-10 text-sm text-faint">No matching documents.</p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map(({ d, s }) => {
            const href = `/${d.type === "invoice" ? "invoices" : "estimates"}/${d.id}`;
            return (
              <li key={d.id}>
                <Link
                  href={href}
                  className={`-mx-2 grid grid-cols-[auto_1fr_auto] items-center gap-x-6 px-2 py-3 text-sm transition hover:bg-hover ${COLS}`}
                >
                  <span className="font-medium tnum text-ink">{d.number}</span>
                  <span className="truncate text-muted">{d.client?.name ?? "—"}</span>
                  <span className="hidden truncate text-muted sm:block">
                    {d.subject || "—"}
                  </span>
                  <span className="hidden tnum text-muted sm:block">
                    {formatDate(d.issue_date)}
                  </span>
                  <span className="text-right tnum text-ink">
                    {formatMoney(Number(d.total), d.currency)}
                  </span>
                  <span className="hidden flex-col items-end gap-0.5 justify-self-end sm:flex">
                    <StatusBadge status={s} size="sm" />
                    {s === "overdue" && daysOverdue(d.due_date) != null && (
                      <span className="text-[10px] tnum text-alert">
                        {daysOverdue(d.due_date)}d overdue
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
