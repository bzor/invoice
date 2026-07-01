"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

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

function isActive(pathname: string, item: { href: string; exact?: boolean }) {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

/** The nav links + sign-out, shared by the desktop rail and the mobile drawer. */
function NavBody({
  email,
  pathname,
  onNavigate,
}: {
  email: string;
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      <nav className="space-y-5">
        {NAV_SECTIONS.map((section, i) => (
          <div key={i} className="space-y-1">
            {section.map((item) => {
              const active = isActive(pathname, item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
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

      <div className="mt-auto border-t border-line p-3">
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
    </>
  );
}

/** Desktop rail — hidden below md, where MobileNav takes over. */
export function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-line bg-canvas md:flex">
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
      <NavBody email={email} pathname={pathname} />
    </aside>
  );
}

/** Mobile top bar + slide-in drawer — shown only below md. */
export function MobileNav({ email }: { email: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Lock body scroll while the drawer is open. (Nav links close the drawer
  // themselves via onNavigate, so no route-change effect is needed.)
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-canvas px-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="-ml-1 flex size-9 items-center justify-center text-ink"
        >
          <span className="flex flex-col gap-[5px]">
            <span className="block h-0.5 w-6 bg-ink" />
            <span className="block h-0.5 w-6 bg-ink" />
            <span className="block h-0.5 w-6 bg-ink" />
          </span>
        </button>
        <Image
          src="/img/logo.png"
          alt="Bzor Invoice"
          width={986}
          height={318}
          priority
          unoptimized
          className="h-6 w-auto"
        />
      </header>

      {open && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink/30"
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[80%] flex-col border-r border-line bg-canvas">
            <div className="flex items-center justify-between px-4 py-4">
              <Image
                src="/img/logo.png"
                alt="Bzor Invoice"
                width={986}
                height={318}
                unoptimized
                className="h-7 w-auto"
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="flex size-9 items-center justify-center text-2xl leading-none text-muted"
              >
                ×
              </button>
            </div>
            <NavBody
              email={email}
              pathname={pathname}
              onNavigate={() => setOpen(false)}
            />
          </aside>
        </div>
      )}
    </div>
  );
}
