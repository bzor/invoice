"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  approveEstimate,
  convertToInvoice,
  declineEstimate,
  markSent,
  voidDocument,
} from "@/lib/actions/documents";
import { sendDocument } from "@/lib/actions/send";
import { Input, Select, Textarea } from "@/components/form";
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
  const [pending, startTransition] = useTransition();
  const [sendOpen, setSendOpen] = useState(false);
  const initialTo = defaultEmail || contacts[0]?.email || "";
  const [to, setTo] = useState(initialTo);
  // "custom" = free-text entry rather than picking a known contact.
  const [custom, setCustom] = useState(
    !contacts.some((c) => c.email === initialTo),
  );
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const basePath = type === "invoice" ? "invoices" : "estimates";
  const isEstimate = type === "estimate";

  function doSend() {
    setFeedback(null);
    startTransition(async () => {
      const res = await sendDocument({ id, to, message });
      if (res.ok) {
        setSendOpen(false);
        setFeedback("Sent ✓");
        router.refresh();
      } else {
        setFeedback(res.error);
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
          onClick={() => setSendOpen((v) => !v)}
          className={buttonClass("primary")}
        >
          Send…
        </button>
      </div>

      {sendOpen && (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
          <label className="text-xs font-medium text-slate-500">To</label>
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
                  className="text-xs font-medium text-slate-500 hover:text-slate-900"
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

      {/* Status-specific actions */}
      <div className="flex flex-wrap gap-2">
        {isEstimate && (
          <>
            <button onClick={copyShare} className={buttonClass("secondary")}>
              {copied ? "Copied!" : "Copy share link"}
            </button>
            {(status === "draft" || status === "sent") && (
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
            {status === "approved" && (
              <form action={convertToInvoice}>
                <input type="hidden" name="id" value={id} />
                <button className={buttonClass("primary")}>
                  Convert to invoice
                </button>
              </form>
            )}
          </>
        )}

        {status === "draft" && (
          <form action={markSent}>
            <input type="hidden" name="id" value={id} />
            <button className={buttonClass("secondary")}>
              Mark as sent
            </button>
          </form>
        )}

        {status !== "void" && (
          <form action={voidDocument}>
            <input type="hidden" name="id" value={id} />
            <button className={buttonClass("danger")}>Void</button>
          </form>
        )}
      </div>

      {feedback && <p className="text-sm text-slate-500">{feedback}</p>}
    </div>
  );
}
