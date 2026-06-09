// Hand-maintained DB types mirroring supabase/migrations.
// Regenerate with `supabase gen types typescript` once the CLI is linked.

export type DocType = "estimate" | "invoice";
export type DocStatus =
  | "draft"
  | "sent"
  | "approved"
  | "declined"
  | "partial"
  | "paid"
  | "overdue"
  | "void";
export type BankInfoMode = "none" | "domestic" | "international";
export type DiscountType = "amount" | "percent";

export interface Settings {
  id: number;
  business_name: string;
  business_address: string;
  business_email: string;
  logo_url: string | null;
  base_currency: string;
  bank_domestic: string;
  bank_international: string;
  default_notes: string;
  default_net_terms: number;
  invoice_prefix: string;
  estimate_prefix: string;
  invoice_counter: number;
  estimate_counter: number;
  number_padding: number;
  updated_at: string;
}

export interface Client {
  id: string;
  name: string;
  address: string;
  currency: string;
  default_net_terms: number | null;
  default_notes: string;
  created_at: string;
}

export interface Contact {
  id: string;
  client_id: string;
  name: string;
  email: string;
  phone: string;
  title: string;
  is_primary: boolean;
  notes: string;
  created_at: string;
}

export interface DocumentRow {
  id: string;
  type: DocType;
  number: string;
  status: DocStatus;
  client_id: string;
  contact_id: string | null;
  po_number: string;
  subject: string;
  issue_date: string;
  due_date: string | null;
  net_terms: number | null;
  currency: string;
  discount_type: DiscountType;
  discount_value: number;
  notes: string;
  bank_info_mode: BankInfoMode;
  base_currency: string;
  fx_rate: number;
  subtotal: number;
  discount_total: number;
  total: number;
  source_estimate_id: string | null;
  share_token: string;
  approved_at: string | null;
  declined_at: string | null;
  sent_at: string | null;
  pdf_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface LineItem {
  id: string;
  document_id: string;
  position: number;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface Payment {
  id: string;
  invoice_id: string;
  date: string;
  amount: number;
  method: string;
  note: string;
  created_at: string;
}

type Row<T> = T;
type Insert<T> = Partial<T>;
type Update<T> = Partial<T>;

interface TableShape<T> {
  Row: Row<T>;
  Insert: Insert<T>;
  Update: Update<T>;
  Relationships: [];
}

export interface Database {
  public: {
    Tables: {
      settings: TableShape<Settings>;
      clients: TableShape<Client>;
      contacts: TableShape<Contact>;
      documents: TableShape<DocumentRow>;
      line_items: TableShape<LineItem>;
      payments: TableShape<Payment>;
    };
    Views: Record<string, never>;
    Functions: {
      next_document_number: {
        Args: { p_type: DocType };
        Returns: string;
      };
      get_shared_document: {
        Args: { p_token: string };
        Returns: SharedDocumentPayload | null;
      };
      respond_to_estimate: {
        Args: { p_token: string; p_approve: boolean };
        Returns: { ok: boolean; status?: string; error?: string };
      };
    };
    Enums: {
      doc_type: DocType;
      doc_status: DocStatus;
      bank_info_mode: BankInfoMode;
      discount_type: DiscountType;
    };
    CompositeTypes: Record<string, never>;
  };
}

// Convenience composites used across the app.
export interface DocumentWithRelations extends DocumentRow {
  client: Client | null;
  contact: Contact | null;
  line_items: LineItem[];
  payments?: Payment[];
}

export interface SharedDocumentPayload {
  document: DocumentRow;
  line_items: LineItem[];
  client: Client | null;
  business: {
    business_name: string;
    business_address: string;
    logo_url: string | null;
    bank_domestic: string;
    bank_international: string;
  };
}
