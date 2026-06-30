import { FlashToaster } from "@/components/flash-toaster";
import { Sidebar } from "@/components/sidebar";
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
      <div className="mx-auto flex h-screen max-w-[1440px]">
        <Sidebar email={user.email ?? ""} />
        <main className="flex-1 overflow-y-auto">
          <div className="px-8 py-8">{children}</div>
        </main>
      </div>
      <FlashToaster flash={flash} />
    </ToastProvider>
  );
}
