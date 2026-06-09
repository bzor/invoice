import { writeFileSync } from "node:fs";

import { renderDocumentPdf, type PdfData } from "@/lib/pdf/document-pdf";
import type { Client, Contact, DocumentRow, LineItem, Settings } from "@/lib/types";

const settings = {
  business_name: "Bzor Systems",
  business_address: "123 Market Street\nSan Francisco, CA 94103",
  business_email: "kc@bzorsystems.com",
  logo_url: null,
  bank_domestic: "Bank of America\nAcct 000123456\nRouting 021000322",
  bank_international: "",
} as Settings;

const client = {
  name: "Pereira & O'Dell",
  address: "215 2nd Street\nSan Francisco, CA 94105",
} as Client;
const contact = { name: "Erin Davis", email: "erin@pereiraodell.com" } as Contact;

const doc = {
  id: "x",
  type: "invoice",
  number: "INV-0042",
  status: "sent",
  po_number: "PO-99821",
  subject: "Q2 Motion & 3D Production",
  issue_date: "2026-06-09",
  due_date: "2026-07-09",
  currency: "USD",
  discount_type: "amount",
  discount_value: 500,
  notes: "Payment due within 30 days. Thank you for your business.",
  bank_info_mode: "domestic",
  subtotal: 24500,
  discount_total: 500,
  total: 24000,
} as unknown as DocumentRow;

const lineItems: LineItem[] = [
  {
    id: "1",
    title: "BitBio High Res Cell Turntable Animations",
    description: "3 Cells: Neuron, Hepatocyte, Myocyte · 40s 4K renders for conference display",
    quantity: 1,
    unit_price: 18000,
    line_total: 18000,
  },
  { id: "2", title: "Storyboard & Previs", description: "", quantity: 1, unit_price: 4500, line_total: 4500 },
  { id: "3", title: "", description: "Color grading and final delivery", quantity: 2, unit_price: 1000, line_total: 2000 },
].map((x, i) => ({ ...x, document_id: "x", position: i }) as LineItem);

const data: PdfData = { doc, client, contact, lineItems, settings };

void (async () => {
  const buf = await renderDocumentPdf(data);
  writeFileSync("/tmp/sample-invoice.pdf", buf);
  console.log("wrote /tmp/sample-invoice.pdf", buf.length, "bytes");
})();
