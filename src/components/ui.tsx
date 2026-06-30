import Link from "next/link";

import type { DocStatus } from "@/lib/types";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex items-end justify-between gap-4">
      <div>
        <h1 className="font-grotesk text-5xl font-semibold uppercase leading-none tracking-tight text-ink">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 font-grotesk text-xs uppercase tracking-wider text-muted">
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`border border-line bg-surface ${className}`}>{children}</div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="border border-dashed border-line bg-surface px-6 py-12 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {hint && <p className="mt-1 text-sm text-faint">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-1.5 px-4 py-2 font-grotesk text-xs font-medium uppercase tracking-wider transition disabled:opacity-60";

const VARIANTS = {
  primary: "bg-ink text-surface hover:opacity-85",
  secondary: "border border-line text-ink hover:bg-hover",
  danger: "border border-line text-alert hover:bg-hover",
} as const;

type Variant = keyof typeof VARIANTS;

export function buttonClass(variant: Variant = "primary") {
  return `${BUTTON_BASE} ${VARIANTS[variant]}`;
}

export function LinkButton({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: React.ReactNode;
  variant?: Variant;
}) {
  return (
    <Link href={href} className={buttonClass(variant)}>
      {children}
    </Link>
  );
}

// Status reads by label + weight, not colored pills. Color is spent only where
// it must be noticed: alert (overdue/declined) and accent (approved/paid).
const STATUS_STYLES: Record<DocStatus, string> = {
  draft: "text-faint",
  sent: "text-ink",
  approved: "text-accent",
  declined: "text-alert",
  partial: "text-ink",
  paid: "text-accent",
  overdue: "text-alert",
  void: "text-faint line-through",
};

const STATUS_DOT: Partial<Record<DocStatus, string>> = {
  overdue: "bg-alert",
  partial: "bg-ink",
};

export function StatusBadge({
  status,
  size = "md",
}: {
  status: DocStatus;
  size?: "sm" | "md";
}) {
  const textClass = size === "sm" ? "text-[10px]" : "text-[11px]";
  const dot = STATUS_DOT[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-grotesk font-medium uppercase tracking-wider ${textClass} ${STATUS_STYLES[status]}`}
    >
      {dot && <span className={`inline-block size-1.5 ${dot}`} aria-hidden />}
      {status}
    </span>
  );
}
