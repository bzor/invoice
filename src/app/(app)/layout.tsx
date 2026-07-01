import { FlashToaster } from "@/components/flash-toaster";
import { MobileNav, Sidebar } from "@/components/sidebar";
import { ToastProvider } from "@/components/toast";
import { requireUser } from "@/lib/auth";
import { readFlash } from "@/lib/flash";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const flash = await readFlash();

  return (
    <ToastProvider>
      <div className="mx-auto flex h-screen max-w-[1440px] flex-col md:flex-row">
        <Sidebar email={user.email ?? ""} />
        <MobileNav email={user.email ?? ""} />
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
          <div className="px-4 py-6 sm:px-8 sm:py-8">{children}</div>
        </main>
      </div>
      <FlashToaster flash={flash} />
    </ToastProvider>
  );
}
