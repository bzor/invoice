import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";

import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type {
  Client,
  Contact,
  DocumentRow,
  LineItem,
  Settings,
} from "@/lib/types";

export type PdfData = {
  doc: DocumentRow;
  client: Client | null;
  contact: Contact | null;
  lineItems: LineItem[];
  settings: Settings;
};

const s = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 48,
    fontSize: 10,
    color: "#0f172a",
    fontFamily: "Helvetica",
  },
  row: { flexDirection: "row" },
  between: { flexDirection: "row", justifyContent: "space-between" },
  logo: { height: 36, marginBottom: 8, objectFit: "contain" },
  businessName: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  muted: { color: "#64748b" },
  docType: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  docNumber: { fontSize: 11, color: "#64748b", marginTop: 2 },
  section: { marginTop: 24 },
  label: {
    fontSize: 8,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  metaGrid: { flexDirection: "row", gap: 32, marginTop: 24 },
  tableHead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#0f172a",
    paddingBottom: 6,
    marginTop: 24,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 7,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e2e8f0",
  },
  cDesc: { flex: 1, paddingRight: 8 },
  cQty: { width: 50, textAlign: "right" },
  cPrice: { width: 75, textAlign: "right" },
  cTotal: { width: 80, textAlign: "right" },
  th: { fontSize: 8, color: "#94a3b8", textTransform: "uppercase" },
  totals: { marginTop: 16, alignSelf: "flex-end", width: 220 },
  totalLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  grandTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#0f172a",
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
  },
  notes: { marginTop: 32 },
  bank: {
    marginTop: 16,
    padding: 12,
    backgroundColor: "#f8fafc",
    borderRadius: 4,
  },
  bold: { fontFamily: "Helvetica-Bold" },
  pre: { lineHeight: 1.4 },
});

function MetaBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={s.label}>{label}</Text>
      {children}
    </View>
  );
}

export function DocumentPDF({ doc, client, contact, lineItems, settings }: PdfData) {
  const money = (n: number) => formatMoney(n, doc.currency);
  const typeLabel = doc.type === "invoice" ? "Invoice" : "Estimate";
  const bank =
    doc.bank_info_mode === "domestic"
      ? settings.bank_domestic
      : doc.bank_info_mode === "international"
        ? settings.bank_international
        : "";

  return (
    <Document title={`${typeLabel} ${doc.number}`}>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.between}>
          <View>
            {settings.logo_url ? (
              <Image src={settings.logo_url} style={s.logo} />
            ) : (
              <Text style={s.businessName}>{settings.business_name}</Text>
            )}
            {settings.logo_url && (
              <Text style={s.businessName}>{settings.business_name}</Text>
            )}
            <Text style={[s.muted, s.pre]}>{settings.business_address}</Text>
            {settings.business_email ? (
              <Text style={s.muted}>{settings.business_email}</Text>
            ) : null}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.docType}>{typeLabel}</Text>
            <Text style={s.docNumber}>{doc.number}</Text>
            {doc.po_number ? (
              <Text style={s.docNumber}>PO {doc.po_number}</Text>
            ) : null}
          </View>
        </View>

        {/* Bill to + meta */}
        <View style={s.metaGrid}>
          <View style={{ flex: 1 }}>
            <MetaBlock label="Bill to">
              <Text style={s.bold}>{client?.name ?? "—"}</Text>
              {contact ? <Text>{contact.name}</Text> : null}
              {contact?.email ? <Text style={s.muted}>{contact.email}</Text> : null}
              <Text style={[s.muted, s.pre]}>{client?.address}</Text>
            </MetaBlock>
          </View>
          <MetaBlock label="Issued">
            <Text>{formatDate(doc.issue_date)}</Text>
          </MetaBlock>
          {doc.due_date ? (
            <MetaBlock label="Due">
              <Text>{formatDate(doc.due_date)}</Text>
            </MetaBlock>
          ) : null}
        </View>

        {doc.subject ? (
          <View style={s.section}>
            <Text style={s.label}>Subject</Text>
            <Text style={s.bold}>{doc.subject}</Text>
          </View>
        ) : null}

        {/* Line items */}
        <View style={s.tableHead}>
          <Text style={[s.cDesc, s.th]}>Description</Text>
          <Text style={[s.cQty, s.th]}>Qty</Text>
          <Text style={[s.cPrice, s.th]}>Price</Text>
          <Text style={[s.cTotal, s.th]}>Amount</Text>
        </View>
        {lineItems.map((li) => (
          <View key={li.id} style={s.tableRow} wrap={false}>
            <Text style={s.cDesc}>{li.description}</Text>
            <Text style={s.cQty}>{Number(li.quantity)}</Text>
            <Text style={s.cPrice}>{money(Number(li.unit_price))}</Text>
            <Text style={s.cTotal}>{money(Number(li.line_total))}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={s.totals}>
          <View style={s.totalLine}>
            <Text style={s.muted}>Subtotal</Text>
            <Text>{money(Number(doc.subtotal))}</Text>
          </View>
          {Number(doc.discount_total) > 0 ? (
            <View style={s.totalLine}>
              <Text style={s.muted}>
                Discount
                {doc.discount_type === "percent"
                  ? ` (${Number(doc.discount_value)}%)`
                  : ""}
              </Text>
              <Text>−{money(Number(doc.discount_total))}</Text>
            </View>
          ) : null}
          <View style={s.grandTotal}>
            <Text>Total</Text>
            <Text>{money(Number(doc.total))}</Text>
          </View>
        </View>

        {/* Notes */}
        {doc.notes ? (
          <View style={s.notes}>
            <Text style={s.label}>Notes</Text>
            <Text style={s.pre}>{doc.notes}</Text>
          </View>
        ) : null}

        {/* Bank info */}
        {bank ? (
          <View style={s.bank}>
            <Text style={s.label}>Payment details</Text>
            <Text style={s.pre}>{bank}</Text>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

export async function renderDocumentPdf(data: PdfData): Promise<Buffer> {
  return renderToBuffer(<DocumentPDF {...data} />);
}
