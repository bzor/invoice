import { ClientForm } from "@/components/client-form";
import { Card, PageHeader } from "@/components/ui";

export default function NewClientPage() {
  return (
    <div className="max-w-2xl">
      <PageHeader title="New client" />
      <Card className="p-6">
        <ClientForm />
      </Card>
    </div>
  );
}
