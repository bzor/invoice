import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

const FIELD =
  "w-full border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition placeholder:text-faint focus:border-ink";

export function Label({
  children,
  htmlFor,
}: {
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block font-grotesk text-xs uppercase tracking-wider text-muted"
    >
      {children}
    </label>
  );
}

export function Field({
  label,
  children,
  className = "",
}: {
  label?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && <Label>{label}</Label>}
      {children}
    </div>
  );
}

// Suppress password-manager / browser autofill on app data-entry fields.
// `autoComplete="off"` alone is widely ignored, so we pair it with the
// per-manager opt-out attributes (1Password, LastPass, Bitwarden/Dashlane).
// Spread before {...props} so any single field can still override.
const NO_AUTOFILL = {
  autoComplete: "off",
  "data-1p-ignore": "true",
  "data-lpignore": "true",
  "data-form-type": "other",
} as const;

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...NO_AUTOFILL}
      {...props}
      className={`${FIELD} ${props.className ?? ""}`}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...NO_AUTOFILL}
      {...props}
      className={`${FIELD} ${props.className ?? ""}`}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...NO_AUTOFILL}
      {...props}
      className={`${FIELD} ${props.className ?? ""}`}
    >
      {props.children}
    </select>
  );
}
