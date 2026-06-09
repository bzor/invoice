"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Dashboard", exact: true },
  { href: "/clients", label: "Clients" },
  { href: "/estimates", label: "Estimates" },
  { href: "/invoices", label: "Invoices" },
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "Settings" },
];

export function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 shrink-0 flex-col bg-white">
      <div className="flex flex-1 flex-col justify-center">
        <div className="px-0 py-5">
        <Image
          src="/img/bzor-logomark.png"
          alt="Bzor Invoice"
          width={1107}
          height={430}
          priority
          className="h-auto w-full"
        />
      </div>

        <nav className="space-y-1">
        {NAV.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-3 py-0.5 text-base font-normal uppercase tracking-wide transition ${
                active
                  ? "bg-black text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
        </nav>
      </div>

      <div className="border-t border-slate-200 p-3">
        <p className="truncate px-2 pb-2 text-xs text-slate-400">{email}</p>
        <form action="/sign-out" method="post">
          <button
            type="submit"
            className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
