"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  approveEstimate,
  convertToInvoice,
  declineEstimate,
  duplicateDocument,
  markSent,
  voidDocument,
} from "@/lib/actions/documents";
import { sendDocument, sendReminder } from "@/lib/actions/send";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Input, Select, Textarea } from "@/components/form";
import { useToast } from "@/components/toast";
import { buttonClass } from "@/components/ui";
import { siteUrl } from "@/lib/env";
import type { DocStatus, DocType } from "@/lib/types";

export function DocumentActions({
  id,
  type,
  status,
  shareToken,
  defaultEmail,
  contacts,
}: {
  id: string;
  type: DocType;
  status: DocStatus;
  shareToken: string;
  defaultEmail: string;
  contacts: { name: string; email: string }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [dupPending, startDuplicate] = useTransition();
  const [remindPending, startRemind] = useTransition();
  const [sendOpen, setSendOpen] = useState(false);
  const initialTo = defaultEmail || contacts[0]?.email || "";
  const [to, setTo] = useState(initialTo);
  // "custom" = free-text entry rather than picking a known contact.
  const [custom, setCustom] = useState(
    !contacts.some((c) => c.email === initialTo),
  );
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const basePath = type === "invoice" ? "invoices" : "estimates";
  const isEstimate = type === "estimate";
  const showTransitions =
    status === "draft" ||
    (isEstimate && (status === "sent" || status === "approved"));
  // Invoices with an outstanding balance can be reminded.
  const canRemind =
    type === "invoice" &&
    (status === "sent" || status === "partial" || status === "overdue");

  function doSend() {
    startTransition(async () => {
      const res = await sendDocument({ id, to, message });
      if (res.ok) {
        setSendOpen(false);
        toast("Sent");
        router.refresh();
      } else {
        toast(res.error, "error");
      }
    });
  }

  function doDuplicate() {
    startDuplicate(async () => {
      const res = await duplicateDocument(id);
      toast("Duplicated — opening new draft");
      router.push(
        `/${res.type === "invoice" ? "invoices" : "estimates"}/${res.id}`,
      );
    });
  }

  function doRemind() {
    startRemind(async () => {
      const res = await sendReminder(id);
      if (res.ok) {
        toast("Reminder sent");
        router.refresh();
      } else {
        toast(res.error, "error");
      }
    });
  }

  async function copyShare() {
    await navigator.clipboard.writeText(`${siteUrl()}/share/${shareToken}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSendOpen((v) => !v)}
          className={buttonClass("primary")}
        >
          Send…
        </button>
        {canRemind && (
          <button
            onClick={doRemind}
            disabled={remindPending}
            className={buttonClass("secondary")}
          >
            {remindPending ? "Sending…" : "Send reminder"}
          </button>
        )}
        <a
          href={`/documents/${id}/pdf?download=1`}
          className={buttonClass("secondary")}
        >
          Download PDF
        </a>
        <a href={`/${basePath}/${id}/edit`} className={buttonClass("secondary")}>
          Edit
        </a>
        <button
          onClick={doDuplicate}
          disabled={dupPending}
          className={buttonClass("secondary")}
        >
          {dupPending ? "Duplicating…" : "Duplicate"}
        </button>
        {isEstimate && (
          <button onClick={copyShare} className={buttonClass("secondary")}>
            {copied ? "Copied!" : "Copy share link"}
          </button>
        )}
      </div>

      {sendOpen && (
        <div className="space-y-2 border border-line bg-surface p-4">
          <label className="font-grotesk text-xs font-medium uppercase tracking-wider text-muted">To</label>
          {contacts.length > 0 && !custom ? (
            <Select
              value={to}
              onChange={(e) => {
                if (e.target.value === "__custom__") {
                  setCustom(true);
                  setTo("");
                } else {
                  setTo(e.target.value);
                }
              }}
            >
              {contacts.map((c) => (
                <option key={c.email} value={c.email}>
                  {c.name} — {c.email}
                </option>
              ))}
              <option value="__custom__">Other email…</option>
            </Select>
          ) : (
            <>
              <Input
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="recipient@example.com"
                autoFocus
              />
              {contacts.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setCustom(false);
                    setTo(contacts[0].email);
                  }}
                  className="text-xs font-medium text-muted hover:text-ink"
                >
                  ← Choose from contacts
                </button>
              )}
            </>
          )}
          <Textarea
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Optional message…"
          />
          <div className="flex gap-2">
            <button
              onClick={doSend}
              disabled={pending}
              className={buttonClass("primary")}
            >
              {pending ? "Sending…" : "Send email"}
            </button>
            <button
              onClick={() => setSendOpen(false)}
              className={buttonClass("secondary")}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Status transitions — moving the document through its lifecycle */}
      {showTransitions && (
        <div className="flex flex-wrap gap-2 border-t border-line pt-3">
          {isEstimate && status === "approved" && (
            <form action={convertToInvoice}>
              <input type="hidden" name="id" value={id} />
              <button className={buttonClass("primary")}>
                Convert to invoice
              </button>
            </form>
          )}

          {status === "draft" && (
            <form action={markSent}>
              <input type="hidden" name="id" value={id} />
              <button className={buttonClass("secondary")}>Mark as sent</button>
            </form>
          )}

          {isEstimate && (status === "draft" || status === "sent") && (
            <>
              <form action={approveEstimate}>
                <input type="hidden" name="id" value={id} />
                <button className={buttonClass("secondary")}>
                  Mark approved
                </button>
              </form>
              <form action={declineEstimate}>
                <input type="hidden" name="id" value={id} />
                <button className={buttonClass("secondary")}>
                  Mark declined
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {/* Destructive — kept quiet and separate */}
      {status !== "void" && (
        <div className="flex justify-end border-t border-line pt-3">
          <form action={voidDocument}>
            <input type="hidden" name="id" value={id} />
            <ConfirmSubmit
              message="Void this document? This cannot be undone."
              className={buttonClass("danger")}
            >
              Void
            </ConfirmSubmit>
          </form>
        </div>
      )}
    </div>
  );
}
