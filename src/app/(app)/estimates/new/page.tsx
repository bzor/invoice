import { EditorPage } from "@/components/editor-page";

export const dynamic = "force-dynamic";

export default async function NewEstimatePage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const { client } = await searchParams;
  return <EditorPage type="estimate" defaultClientId={client} />;
}
