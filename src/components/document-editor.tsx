"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Field, Input, Select, Textarea } from "@/components/form";
import { buttonClass } from "@/components/ui";
import { CURRENCIES, NET_TERMS } from "@/lib/currencies";
import { addDays, formatDate, today } from "@/lib/dates";
import {
  saveDocument,
  type DocumentInput,
  type LineInput,
} from "@/lib/actions/documents";
import { computeTotals, formatMoney } from "@/lib/money";
import type {
  BankInfoMode,
  DiscountType,
  DocType,
  DocumentWithRelations,
} from "@/lib/types";
import type { EditorClient } from "@/lib/data";

type Row = LineInput & { key: string };

let keySeq = 0;
const newRow = (li?: Partial<LineInput>): Row => ({
  key: `r${keySeq++}`,
  description: li?.description ?? "",
  quantity: li?.quantity ?? 1,
  unit_price: li?.unit_price ?? 0,
});

export function DocumentEditor({
  type,
  clients,
  doc,
  defaultClientId,
  settingsDefaults,
}: {
  type: DocType;
  clients: EditorClient[];
  doc?: DocumentWithRelations;
  defaultClientId?: string;
  settingsDefaults: { net_terms: number; notes: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const label = type === "invoice" ? "Invoice" : "Estimate";

  const [clientId, setClientId] = useState(
    doc?.client_id ?? defaultClientId ?? "",
  );
  const selectedClient = clients.find((c) => c.id === clientId);

  const [contactId, setContactId] = useState(doc?.contact_id ?? "");
  const [currency, setCurrency] = useState(
    doc?.currency ?? selectedClient?.currency ?? "USD",
  );
  const [issueDate, setIssueDate] = useState(doc?.issue_date ?? today());
  const [netTerms, setNetTerms] = useState<number | "">(
    doc?.net_terms ?? selectedClient?.default_net_terms ?? settingsDefaults.net_terms,
  );
  const [poNumber, setPoNumber] = useState(doc?.po_number ?? "");
  const [subject, setSubject] = useState(doc?.subject ?? "");
  const [notes, setNotes] = useState(doc?.notes ?? settingsDefaults.notes);
  const [bankMode, setBankMode] = useState<BankInfoMode>(
    doc?.bank_info_mode ?? "none",
  );
  const [discountType, setDiscountType] = useState<DiscountType>(
    doc?.discount_type ?? "amount",
  );
  const [discountValue, setDiscountValue] = useState<number>(
    doc?.discount_value ?? 0,
  );
  const [rows, setRows] = useState<Row[]>(
    doc?.line_items?.length
      ? doc.line_items.map((li) => newRow(li))
      : [newRow()],
  );

  const totals = useMemo(
    () => computeTotals({ lineItems: rows, discountType, discountValue }),
    [rows, discountType, discountValue],
  );

  const dueDate =
    netTerms === "" ? null : addDays(issueDate, Number(netTerms));

  function onPickClient(id: string) {
    setClientId(id);
    const c = clients.find((x) => x.id === id);
    if (c) {
      setCurrency(c.currency);
      if (c.default_net_terms != null) setNetTerms(c.default_net_terms);
      if (!notes.trim() && c.default_notes) setNotes(c.default_notes);
      setContactId("");
    }
  }

  function updateRow(key: string, patch: Partial<LineInput>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((rs) => [...rs, newRow()]);
  }
  function removeRow(key: string) {
    setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== key) : rs));
  }

  function submit() {
    setError(null);
    if (!clientId) {
      setError("Select a client.");
      return;
    }
    const payload: DocumentInput = {
      id: doc?.id,
      type,
      client_id: clientId,
      contact_id: contactId || null,
      po_number: poNumber,
      subject,
      issue_date: issueDate,
      net_terms: netTerms === "" ? null : Number(netTerms),
      due_date: dueDate,
      currency,
      discount_type: discountType,
      discount_value: Number(discountValue) || 0,
      notes,
      bank_info_mode: bankMode,
      line_items: rows
        .filter((r) => r.description.trim() || r.unit_price || r.quantity !== 1)
        .map((r) => ({
          description: r.description,
          quantity: Number(r.quantity) || 0,
          unit_price: Number(r.unit_price) || 0,
        })),
    };

    startTransition(async () => {
      try {
        const res = await saveDocument(payload);
        router.push(`/${type === "invoice" ? "invoices" : "estimates"}/${res.id}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  const money = (n: number) => formatMoney(n, currency);

  return (
    <div className="space-y-6">
      {/* Header fields */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Client">
            <Select
              value={clientId}
              onChange={(e) => onPickClient(e.target.value)}
            >
              <option value="">— Select client —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Contact">
            <Select
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              disabled={!selectedClient}
            >
              <option value="">— None —</option>
              {selectedClient?.contacts.map((ct) => (
                <option key={ct.id} value={ct.id}>
                  {ct.name}
                  {ct.is_primary ? " (primary)" : ""}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Subject" className="sm:col-span-2">
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={`${label} subject`}
            />
          </Field>

          <Field label="PO number">
            <Input
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
            />
          </Field>

          <Field label="Currency">
            <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Issue date">
            <Input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
            />
          </Field>

          <Field label="Payment terms">
            <Select
              value={netTerms}
              onChange={(e) =>
                setNetTerms(e.target.value === "" ? "" : Number(e.target.value))
              }
            >
              <option value="">— None —</option>
              {NET_TERMS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-slate-400">
              Due {formatDate(dueDate)}
            </p>
          </Field>
        </div>
      </div>

      {/* Line items */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="mb-3 grid grid-cols-12 gap-3 text-xs font-medium uppercase tracking-wide text-slate-400">
          <div className="col-span-6">Description</div>
          <div className="col-span-2 text-right">Qty</div>
          <div className="col-span-2 text-right">Price</div>
          <div className="col-span-2 text-right">Total</div>
        </div>
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.key} className="grid grid-cols-12 items-center gap-3">
              <Input
                className="col-span-6"
                value={r.description}
                placeholder="Item description"
                onChange={(e) => updateRow(r.key, { description: e.target.value })}
              />
              <Input
                type="number"
                step="any"
                className="col-span-2 text-right"
                value={r.quantity}
                onChange={(e) =>
                  updateRow(r.key, { quantity: Number(e.target.value) })
                }
              />
              <Input
                type="number"
                step="any"
                className="col-span-2 text-right"
                value={r.unit_price}
                onChange={(e) =>
                  updateRow(r.key, { unit_price: Number(e.target.value) })
                }
              />
              <div className="col-span-1 text-right text-sm tnum text-slate-700">
                {money((Number(r.quantity) || 0) * (Number(r.unit_price) || 0))}
              </div>
              <button
                type="button"
                onClick={() => removeRow(r.key)}
                className="col-span-1 text-right text-slate-300 hover:text-red-500"
                aria-label="Remove line"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addRow}
          className="mt-3 text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          + Add line
        </button>

        {/* Totals */}
        <div className="mt-6 flex justify-end">
          <div className="w-64 space-y-2 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span className="tnum">{money(totals.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-slate-600">Discount</span>
                <Select
                  value={discountType}
                  onChange={(e) =>
                    setDiscountType(e.target.value as DiscountType)
                  }
                  className="w-16! px-1.5! py-1! text-xs"
                >
                  <option value="amount">{currency}</option>
                  <option value="percent">%</option>
                </Select>
              </div>
              <Input
                type="number"
                step="any"
                className="w-24! text-right"
                value={discountValue}
                onChange={(e) => setDiscountValue(Number(e.target.value))}
              />
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900">
              <span>Total</span>
              <span className="tnum">{money(totals.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Notes + bank info */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <Field label="Notes (shown on document)">
          <Textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Thank-you note, terms, etc."
          />
        </Field>

        <Field label="Bank details" className="mt-4">
          <div className="flex gap-4 text-sm text-slate-700">
            {(["none", "domestic", "international"] as BankInfoMode[]).map((m) => (
              <label key={m} className="flex items-center gap-2 capitalize">
                <input
                  type="radio"
                  name="bank_mode"
                  checked={bankMode === m}
                  onChange={() => setBankMode(m)}
                />
                {m}
              </label>
            ))}
          </div>
        </Field>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={pending}
          className={buttonClass("primary")}
        >
          {pending ? "Saving…" : doc ? "Save changes" : `Create ${label.toLowerCase()}`}
        </button>
        <button
          onClick={() => router.back()}
          className={buttonClass("secondary")}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
