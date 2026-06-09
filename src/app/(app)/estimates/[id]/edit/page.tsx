import { EditorPage } from "@/components/editor-page";

export const dynamic = "force-dynamic";

export default async function EditEstimatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditorPage type="estimate" docId={id} />;
}
