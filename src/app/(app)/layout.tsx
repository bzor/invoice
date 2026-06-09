import { Sidebar } from "@/components/sidebar";
import { requireUser } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="mx-auto flex h-screen max-w-[1200px]">
      <Sidebar email={user.email ?? ""} />
      <main className="flex-1 overflow-y-auto">
        <div className="px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
