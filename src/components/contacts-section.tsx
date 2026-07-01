"use client";

import { useState } from "react";

import { deleteContact, saveContact } from "@/app/(app)/clients/actions";
import { Field, Input } from "@/components/form";
import { buttonClass } from "@/components/ui";
import type { Contact } from "@/lib/types";

function ContactForm({
  clientId,
  contact,
  onDone,
}: {
  clientId: string;
  contact?: Contact;
  onDone: () => void;
}) {
  return (
    <form
      action={saveContact}
      onSubmit={onDone}
      className="space-y-3 border border-line bg-canvas p-4"
    >
      <input type="hidden" name="client_id" value={clientId} />
      {contact && <input type="hidden" name="id" value={contact.id} />}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Name">
          <Input name="name" defaultValue={contact?.name} required autoFocus />
        </Field>
        <Field label="Title">
          <Input name="title" defaultValue={contact?.title} />
        </Field>
        <Field label="Email">
          <Input type="email" name="email" defaultValue={contact?.email} />
        </Field>
        <Field label="Phone">
          <Input name="phone" defaultValue={contact?.phone} />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm text-muted">
        <input
          type="checkbox"
          name="is_primary"
          defaultChecked={contact?.is_primary}
          className="border-line"
        />
        Primary contact
      </label>

      <div className="flex gap-2">
        <button type="submit" className={buttonClass("primary")}>
          {contact ? "Save" : "Add contact"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className={buttonClass("secondary")}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function ContactsSection({
  clientId,
  contacts,
}: {
  clientId: string;
  contacts: Contact[];
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {contacts.length === 0 && !adding && (
        <p className="text-sm text-faint">No contacts yet.</p>
      )}

      <ul className="divide-y divide-line border-b border-line">
        {contacts.map((c) =>
          editingId === c.id ? (
            <li key={c.id} className="py-3">
              <ContactForm
                clientId={clientId}
                contact={c}
                onDone={() => setEditingId(null)}
              />
            </li>
          ) : (
            <li
              key={c.id}
              className="flex items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">
                  {c.name}
                  {c.is_primary && (
                    <span className="ml-2 border border-line px-1.5 py-0.5 font-grotesk text-[10px] uppercase tracking-wider text-muted">
                      Primary
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-muted">
                  {[c.title, c.email, c.phone].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <div className="flex items-center gap-2 pl-3">
                <button
                  onClick={() => setEditingId(c.id)}
                  className="font-grotesk text-xs uppercase tracking-wider text-muted hover:text-ink"
                >
                  Edit
                </button>
                <form action={deleteContact}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="client_id" value={clientId} />
                  <button
                    type="submit"
                    className="font-grotesk text-xs uppercase tracking-wider text-alert hover:opacity-70"
                  >
                    Delete
                  </button>
                </form>
              </div>
            </li>
          ),
        )}
      </ul>

      {adding ? (
        <ContactForm clientId={clientId} onDone={() => setAdding(false)} />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className={buttonClass("secondary")}
        >
          + Add contact
        </button>
      )}
    </div>
  );
}
