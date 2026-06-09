import { notFound } from "next/navigation";

import { ClientForm } from "@/components/client-form";
import { Card, PageHeader } from "@/components/ui";
import { getClient } from "@/lib/data";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();

  return (
    <div className="max-w-2xl">
      <PageHeader title={`Edit ${client.name}`} />
      <Card className="p-6">
        <ClientForm client={client} />
      </Card>
    </div>
  );
}
