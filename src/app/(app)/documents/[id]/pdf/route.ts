import { requireUser } from "@/lib/auth";
import { getPdfData } from "@/lib/data";
import { renderDocumentPdf } from "@/lib/pdf/document-pdf";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireUser();
  const { id } = await params;
  const data = await getPdfData(id);
  if (!data) return new Response("Not found", { status: 404 });

  const pdf = await renderDocumentPdf(data);
  const download = new URL(request.url).searchParams.get("download") === "1";
  const filename = `${data.doc.number}.pdf`;

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
    },
  });
}
