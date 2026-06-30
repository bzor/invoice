"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_SECTIONS = [
  [{ href: "/", label: "Home", exact: true }],
  [
    { href: "/invoices", label: "Invoices" },
    { href: "/estimates", label: "Estimates" },
  ],
  [
    { href: "/clients", label: "Clients" },
    { href: "/reports", label: "Reports" },
  ],
  [{ href: "/settings", label: "Settings" }],
];

export function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-line bg-canvas">
      <div className="flex flex-1 flex-col justify-start">
        <div className="px-0 py-5">
        <Image
          src="/img/logo.png"
          alt="Bzor Invoice"
          width={986}
          height={318}
          priority
          unoptimized
          className="h-auto w-full"
        />
      </div>

        <nav className="space-y-5">
        {NAV_SECTIONS.map((section, i) => (
          <div key={i} className="space-y-1">
            {section.map((item) => {
              const active =
                "exact" in item && item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block border-l-2 px-3 py-1 font-grotesk text-base uppercase tracking-wide transition ${
                    active
                      ? "border-ink font-medium text-ink"
                      : "border-transparent font-normal text-muted hover:border-line hover:text-ink"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
        </nav>
      </div>

      <div className="border-t border-line p-3">
        <p className="truncate px-2 pb-2 text-xs text-faint">{email}</p>
        <form action="/sign-out" method="post">
          <button
            type="submit"
            className="w-full px-3 py-2 text-left text-sm font-medium text-muted transition hover:bg-hover hover:text-ink"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
