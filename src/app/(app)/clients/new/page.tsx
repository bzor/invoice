import { ClientForm } from "@/components/client-form";
import { PageHeader } from "@/components/ui";

export default function NewClientPage() {
  return (
    <div className="max-w-2xl">
      <PageHeader title="New client" />
      <ClientForm />
    </div>
  );
}
