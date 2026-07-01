/* eslint-disable @next/next/no-img-element */
import { saveSettings } from "@/app/(app)/settings/actions";
import { Field, Input, Select, Textarea } from "@/components/form";
import { PageHeader, buttonClass } from "@/components/ui";
import { CURRENCIES, NET_TERMS } from "@/lib/currencies";
import { getSettings } from "@/lib/data";

export const dynamic = "force-dynamic";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="border-b border-line pb-2 font-grotesk text-xs uppercase tracking-wider text-muted">
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" />

      <form action={saveSettings} className="space-y-10">
        <Section title="Business">
          <div className="space-y-4">
            <Field label="Business name">
              <Input name="business_name" defaultValue={settings.business_name} />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Email">
                <Input
                  type="email"
                  name="business_email"
                  defaultValue={settings.business_email}
                />
              </Field>
              <Field label="Base currency (reports)">
                <Select name="base_currency" defaultValue={settings.base_currency}>
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Address">
              <Textarea
                name="business_address"
                rows={3}
                defaultValue={settings.business_address}
              />
            </Field>
            <Field label="Logo">
              <div className="flex items-center gap-4">
                {settings.logo_url && (
                  <img
                    src={settings.logo_url}
                    alt="Logo"
                    className="h-10 object-contain"
                  />
                )}
                <Input type="file" name="logo" accept="image/*" />
              </div>
            </Field>
          </div>
        </Section>

        <Section title="Payment details">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Domestic bank info">
              <Textarea
                name="bank_domestic"
                rows={5}
                defaultValue={settings.bank_domestic}
                placeholder="Account name, number, routing…"
              />
            </Field>
            <Field label="International bank info">
              <Textarea
                name="bank_international"
                rows={5}
                defaultValue={settings.bank_international}
                placeholder="IBAN, SWIFT/BIC…"
              />
            </Field>
          </div>
        </Section>

        <Section title="Defaults">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Default payment terms">
              <Select
                name="default_net_terms"
                defaultValue={settings.default_net_terms}
              >
                {NET_TERMS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Default invoice notes" className="mt-4">
            <Textarea
              name="default_notes"
              rows={2}
              defaultValue={settings.default_notes}
            />
          </Field>
        </Section>

        <Section title="Numbering">
          <p className="-mt-1 mb-4 text-xs text-faint">
            Next number is the prefix + counter, zero-padded. e.g.{" "}
            {settings.invoice_prefix}-
            {String(settings.invoice_counter).padStart(settings.number_padding, "0")}
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="Invoice prefix">
              <Input name="invoice_prefix" defaultValue={settings.invoice_prefix} />
            </Field>
            <Field label="Next invoice #">
              <Input
                type="number"
                name="invoice_counter"
                defaultValue={settings.invoice_counter}
              />
            </Field>
            <Field label="Padding">
              <Input
                type="number"
                name="number_padding"
                defaultValue={settings.number_padding}
              />
            </Field>
            <Field label="Estimate prefix">
              <Input
                name="estimate_prefix"
                defaultValue={settings.estimate_prefix}
              />
            </Field>
            <Field label="Next estimate #">
              <Input
                type="number"
                name="estimate_counter"
                defaultValue={settings.estimate_counter}
              />
            </Field>
          </div>
        </Section>

        <div className="border-t border-line pt-6">
          <button className={buttonClass("primary")}>Save settings</button>
        </div>
      </form>
    </div>
  );
}
