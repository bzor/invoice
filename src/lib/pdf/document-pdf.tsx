import {
  Document,
  Font,
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

const CDN = "https://cdn.jsdelivr.net/fontsource/fonts";

Font.register({
  family: "Inter",
  fonts: [
    { src: `${CDN}/inter@latest/latin-400-normal.ttf`, fontWeight: 400 },
    { src: `${CDN}/inter@latest/latin-500-normal.ttf`, fontWeight: 500 },
    { src: `${CDN}/inter@latest/latin-600-normal.ttf`, fontWeight: 600 },
  ],
});
Font.register({
  family: "Familjen Grotesk",
  fonts: [
    { src: `${CDN}/familjen-grotesk@latest/latin-400-normal.ttf`, fontWeight: 400 },
    { src: `${CDN}/familjen-grotesk@latest/latin-600-normal.ttf`, fontWeight: 600 },
  ],
});
// Don't break words across lines.
Font.registerHyphenationCallback((word) => [word]);

export type PdfData = {
  doc: DocumentRow;
  client: Client | null;
  contact: Contact | null;
  lineItems: LineItem[];
  settings: Settings;
};

const C = {
  ink: "#0f172a",
  c800: "#1e293b",
  c600: "#475569",
  c500: "#64748b",
  c400: "#94a3b8",
  c300: "#cbd5e1",
  c200: "#e2e8f0",
  c100: "#f1f5f9",
};

const s = StyleSheet.create({
  page: {
    flexDirection: "column",
    paddingHorizontal: 54,
    paddingTop: 52,
    paddingBottom: 48,
    fontFamily: "Inter",
    fontSize: 9.5,
    color: C.ink,
  },
  row: { flexDirection: "row" },
  between: { flexDirection: "row", justifyContent: "space-between" },
  label: {
    fontFamily: "Familjen Grotesk",
    fontWeight: 500,
    fontSize: 7,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: C.c400,
  },
  logo: { height: 26, marginBottom: 8, objectFit: "contain" },
  bizName: { fontFamily: "Familjen Grotesk", fontWeight: 600, fontSize: 11 },
  bizNameLg: { fontFamily: "Familjen Grotesk", fontWeight: 600, fontSize: 15 },
  bizMeta: { fontSize: 8.5, color: C.c500, lineHeight: 1.45 },
  wordmark: {
    fontFamily: "Familjen Grotesk",
    fontWeight: 600,
    fontSize: 34,
    textTransform: "uppercase",
    letterSpacing: -0.5,
  },
  ruleDark: { height: 1, backgroundColor: C.ink },
  ruleMid: { height: 1, backgroundColor: C.c200 },
  ruleLight: { height: 1, backgroundColor: C.c100 },
  metaVal: { marginTop: 4, fontSize: 9.5 },
  // line items
  liHead: { flexDirection: "row", paddingBottom: 6 },
  liRow: { flexDirection: "row", paddingVertical: 8 },
  cIndex: { width: 22, fontFamily: "Familjen Grotesk", fontSize: 8, color: C.c300 },
  cDesc: { flex: 1, paddingRight: 8 },
  cQty: { width: 44, textAlign: "right", color: C.c500 },
  cPrice: { width: 78, textAlign: "right", color: C.c500 },
  cAmount: { width: 86, textAlign: "right", fontWeight: 500 },
  liTitle: { fontSize: 9.5, color: C.c800 },
  liDesc: { marginTop: 2, fontSize: 8, color: C.c400, lineHeight: 1.35 },
  // totals
  totalsWrap: { marginTop: 18, flexDirection: "row", justifyContent: "flex-end" },
  totals: { width: 220 },
  totalLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2.5,
    fontSize: 9.5,
    color: C.c500,
  },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  totalAmt: {
    fontFamily: "Familjen Grotesk",
    fontWeight: 600,
    fontSize: 17,
    color: C.ink,
  },
  footerBody: { marginTop: 6, fontSize: 8, color: C.c600, lineHeight: 1.5 },
  thanks: {
    marginTop: 26,
    textAlign: "center",
    fontFamily: "Familjen Grotesk",
    fontSize: 7,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: C.c300,
  },
});

// Estimate page height so the sheet grows vertically as one continuous page,
// with a minimum of a full US Letter page (792pt).
function estimateHeight(d: PdfData): number {
  const hasFooter = !!(footerBank(d) || d.doc.notes);
  let h = 52 + 48; // vertical padding
  h += 110; // masthead
  h += 22 + 56; // rule + meta row
  h += 80; // billed-to / subject
  h += 22; // line-item header + rule
  for (const li of d.lineItems) {
    h += 28;
    if (li.title && li.description) h += 16;
  }
  h += 90; // totals
  h += hasFooter ? 120 : 50; // footer
  return Math.max(792, Math.ceil(h));
}

function footerBank(d: PdfData): string {
  const { doc, settings } = d;
  return doc.bank_info_mode === "domestic"
    ? settings.bank_domestic
    : doc.bank_info_mode === "international"
      ? settings.bank_international
      : "";
}

export function DocumentPDF(data: PdfData) {
  const { doc, client, contact, lineItems, settings } = data;
  const money = (n: number) => formatMoney(n, doc.currency);
  const qty = (n: number) =>
    new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);
  const typeLabel = doc.type === "invoice" ? "Invoice" : "Estimate";
  const isInvoice = doc.type === "invoice";
  const metaFields: [string, string][] = [
    [`${typeLabel} No.`, doc.number],
    ["Issued", formatDate(doc.issue_date)],
    ...(isInvoice
      ? ([["Due", doc.due_date ? formatDate(doc.due_date) : "—"]] as [
          string,
          string,
        ][])
      : []),
    ["Currency", doc.currency],
  ];
  const metaW = `${100 / metaFields.length}%`;
  const bank = footerBank(data);
  const height = estimateHeight(data);

  return (
    <Document title={`${typeLabel} ${doc.number}`}>
      <Page size={[612, height]} style={s.page}>
        {/* Masthead */}
        <View style={s.between}>
          <View style={{ maxWidth: "55%" }}>
            {settings.logo_url ? (
              <>
                <Image src={settings.logo_url} style={s.logo} />
                <Text style={s.bizName}>{settings.business_name}</Text>
              </>
            ) : (
              <Text style={s.bizNameLg}>{settings.business_name}</Text>
            )}
            <Text style={[s.bizMeta, { marginTop: 6 }]}>
              {settings.business_address}
            </Text>
            {settings.business_email ? (
              <Text style={s.bizMeta}>{settings.business_email}</Text>
            ) : null}
          </View>
          <Text style={s.wordmark}>{typeLabel}</Text>
        </View>

        <View style={[s.ruleDark, { marginTop: 22 }]} />

        {/* Meta row */}
        <View style={[s.row, { marginTop: 16 }]}>
          {metaFields.map(([l, v]) => (
            <View key={l} style={{ width: metaW }}>
              <Text style={s.label}>{l}</Text>
              <Text style={s.metaVal}>{v}</Text>
            </View>
          ))}
        </View>

        {/* Billed to + subject */}
        <View style={[s.row, { marginTop: 24 }]}>
          <View style={{ width: "50%", paddingRight: 16 }}>
            <Text style={s.label}>
              {isInvoice ? "Billed to" : "Prepared for"}
            </Text>
            <Text style={{ marginTop: 4, fontWeight: 500 }}>
              {client?.name ?? "—"}
            </Text>
            <Text style={[s.bizMeta, { marginTop: 3 }]}>{client?.address}</Text>
          </View>
          <View style={{ width: "50%" }}>
            {doc.subject ? (
              <>
                <Text style={s.label}>Subject</Text>
                <Text style={{ marginTop: 4 }}>{doc.subject}</Text>
              </>
            ) : null}
            {doc.po_number ? (
              <View style={{ marginTop: doc.subject ? 12 : 0 }}>
                <Text style={s.label}>PO Number</Text>
                <Text style={{ marginTop: 4 }}>{doc.po_number}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Line items */}
        <View style={{ marginTop: 28 }}>
          <View style={s.liHead}>
            <Text style={[s.cIndex, s.label]}>{""}</Text>
            <Text style={[s.cDesc, s.label]}>Description</Text>
            <Text style={[s.cQty, s.label]}>Qty</Text>
            <Text style={[s.cPrice, s.label]}>Price</Text>
            <Text style={[s.cAmount, s.label]}>Amount</Text>
          </View>
          <View style={s.ruleDark} />
          {lineItems.map((li, i) => (
            <View key={li.id}>
              <View style={s.liRow}>
                <Text style={s.cIndex}>{String(i + 1).padStart(2, "0")}</Text>
                <View style={s.cDesc}>
                  <Text style={s.liTitle}>{li.title || li.description}</Text>
                  {li.title && li.description ? (
                    <Text style={s.liDesc}>{li.description}</Text>
                  ) : null}
                </View>
                <Text style={s.cQty}>{qty(Number(li.quantity))}</Text>
                <Text style={s.cPrice}>{money(Number(li.unit_price))}</Text>
                <Text style={s.cAmount}>{money(Number(li.line_total))}</Text>
              </View>
              <View style={s.ruleLight} />
            </View>
          ))}

          {/* Totals */}
          <View style={s.totalsWrap}>
            <View style={s.totals}>
              <View style={s.totalLine}>
                <Text>Subtotal</Text>
                <Text>{money(Number(doc.subtotal))}</Text>
              </View>
              {Number(doc.discount_total) > 0 ? (
                <View style={s.totalLine}>
                  <Text>
                    Discount
                    {doc.discount_type === "percent"
                      ? ` (${qty(Number(doc.discount_value))}%)`
                      : ""}
                  </Text>
                  <Text>−{money(Number(doc.discount_total))}</Text>
                </View>
              ) : null}
              <View style={[s.ruleDark, { marginVertical: 7 }]} />
              <View style={s.totalRow}>
                <Text style={s.label}>{isInvoice ? "Total Due" : "Total"}</Text>
                <Text style={s.totalAmt}>{money(Number(doc.total))}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Spacer pushes the footer to the bottom of the page */}
        <View style={{ flexGrow: 1 }} />

        {/* Footer */}
        <View>
          {bank || doc.notes ? (
            <>
              <View style={s.ruleMid} />
              <View style={[s.row, { marginTop: 14 }]}>
                {bank ? (
                  <View style={{ width: "50%", paddingRight: 20 }}>
                    <Text style={s.label}>Payment details</Text>
                    <Text style={s.footerBody}>{bank}</Text>
                  </View>
                ) : null}
                {doc.notes ? (
                  <View style={{ width: "50%" }}>
                    <Text style={s.label}>Notes</Text>
                    <Text style={s.footerBody}>{doc.notes}</Text>
                  </View>
                ) : null}
              </View>
            </>
          ) : null}
          <Text style={s.thanks}>{settings.business_name} — Thank you</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderDocumentPdf(data: PdfData): Promise<Buffer> {
  return renderToBuffer(<DocumentPDF {...data} />);
}
