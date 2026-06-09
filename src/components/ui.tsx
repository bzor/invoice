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
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 className="font-title text-[60px] uppercase text-slate-900">{title}</h1>
        {subtitle && (
          <p className="mt-[-10px] text-xs font-semibold text-slate-500">{subtitle}</p>
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
    <div
      className={`rounded-xl border border-slate-200 bg-white ${className}`}
    >
      {children}
    </div>
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
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {hint && <p className="mt-1 text-sm text-slate-400">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:opacity-60";

const VARIANTS = {
  primary: "bg-black text-white hover:bg-slate-800",
  secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200",
  danger: "bg-red-50 text-red-600 hover:bg-red-100",
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

const STATUS_STYLES: Record<DocStatus, string> = {
  draft: "bg-slate-100 text-slate-600",
  sent: "bg-blue-100 text-blue-700",
  approved: "bg-emerald-100 text-emerald-700",
  declined: "bg-red-100 text-red-700",
  partial: "bg-amber-100 text-amber-700",
  paid: "bg-emerald-100 text-emerald-700",
  overdue: "bg-red-100 text-red-700",
  void: "bg-slate-100 text-slate-400 line-through",
};

export function StatusBadge({
  status,
  size = "md",
}: {
  status: DocStatus;
  size?: "sm" | "md";
}) {
  const sizeClass =
    size === "sm" ? "px-1.5 py-0 text-[10px]" : "px-2.5 py-0.5 text-xs";
  return (
    <span
      className={`inline-flex font-medium capitalize ${sizeClass} ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}
