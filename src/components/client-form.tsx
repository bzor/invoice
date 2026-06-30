import { saveClient } from "@/app/(app)/clients/actions";
import { Field, Input, Select, Textarea } from "@/components/form";
import { buttonClass, LinkButton } from "@/components/ui";
import { CURRENCIES, NET_TERMS } from "@/lib/currencies";
import type { Client } from "@/lib/types";

export function ClientForm({ client }: { client?: Client }) {
  return (
    <form action={saveClient} className="space-y-5">
      {client && <input type="hidden" name="id" value={client.id} />}

      <Field label="Name">
        <Input name="name" defaultValue={client?.name} required autoFocus />
      </Field>

      <Field label="Address">
        <Textarea
          name="address"
          rows={3}
          defaultValue={client?.address}
          placeholder="Street, city, country"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Default currency">
          <Select name="currency" defaultValue={client?.currency ?? "USD"}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Default payment terms">
          <Select
            name="default_net_terms"
            defaultValue={client?.default_net_terms ?? ""}
          >
            <option value="">— None —</option>
            {NET_TERMS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Default invoice notes">
        <Textarea
          name="default_notes"
          rows={2}
          defaultValue={client?.default_notes}
          placeholder="Optional — prefilled on new documents for this client"
        />
      </Field>

      <div className="flex gap-2 border-t border-line pt-6">
        <button type="submit" className={buttonClass("primary")}>
          {client ? "Save changes" : "Create client"}
        </button>
        <LinkButton
          href={client ? `/clients/${client.id}` : "/clients"}
          variant="secondary"
        >
          Cancel
        </LinkButton>
      </div>
    </form>
  );
}
