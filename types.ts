
export type ExpenseSource = 'receipt' | 'credit_card_statement' | 'bank_statement' | 'telegram' | 'email' | 'web_upload';

export type TravelLogStatus = 'Complete' | 'Open - Awaiting return' | 'Incomplete - Outbound missing';

export interface TravelLog {
  id: string;
  user_id?: string;

  // Locations
  origin_country?: string;
  origin_city?: string;
  destination_country: string;
  destination_city: string;

  // Dates
  start_date: string; // The primary date from the document
  end_date?: string;  // Only if round-trip in one doc
  departure_date?: string | null; // Calculated for trip start
  return_date?: string | null;    // Calculated for trip end

  // Stats
  days_spent: number;
  status: TravelLogStatus;

  // Details
  provider_name: string; // Airline or Hotel
  travel_type: 'flight' | 'accommodation';
  reference_number?: string;
  guest_name?: string; // For hotels
  notes?: string;

  // Audit/Verification
  hotel_verification_status?: 'verified' | 'missing' | 'mismatch' | 'not_required';
  linked_hotel_id?: string;
  linked_flight_id?: string;

  // Linking
  document_id?: string;
  outbound_flight_id?: string;
  return_flight_id?: string;
  uploaded_at?: string;
  updated_at?: string;
}

export interface Expense {
  id: string;
  merchant: string;
  amount: number;
  currency: string;
  date: string;
  time?: string;
  category: string;
  source: ExpenseSource;
  description: string;
  reconciledId?: string;
  confidence: number;
  gmail_message_id?: string;
  card_last_4?: string;
  transaction_type?: string;
  bank?: string;
  account_holder?: string;
  email_subject?: string;
  email_sender?: string;
  created_at?: string;
  user_id?: string;
  statement_id?: string;
  needs_clarification?: boolean;
  clarification_reason?: string;
  user_clarification?: string;
  research_notes?: string;
  company_project?: string;
  expense_type?: string;
  notes?: string;
  main_category?: string;
  reimbursement_status?: string;
  paid_by?: string;
  travel_log_id?: string; // Link to related travel log
  proof_metadata?: {
    type?: 'email' | 'receipt' | 'bank' | 'cross_verified';
    label?: string;
    sources?: string[];
    summary?: string;
  };
}

export interface ReconciliationResult {
  matched: Array<{
    receiptId?: string;
    bankId?: string;
    emailId?: string;
    proofLabel?: string;
    summary?: string;
  }>;
  unmatchedReceipts: string[];
  unmatchedBankTransactions: string[];
  unmatchedEmails: string[];
  mismatches: Array<{
    receiptId?: string;
    bankId?: string;
    emailId?: string;
    reason: string;
  }>;
}

export interface ReconciliationReport {
  id?: string;
  month: string;
  year: number;
  matched_transactions: Expense[];
  mandatory_missing: Expense[];
  optional_missing: Expense[];
  standard_missing: Expense[];
  summary: {
    total_matched: number;
    total_unmatched: number;
    matched_amount: number;
    unmatched_amount: number;
    compliance_score: number;
    mandatory_error_count: number;
    warning_count: number;
    optional_count: number;
  };
  created_at?: string;
  is_local?: boolean;
}

export enum AppTab {
  DASHBOARD = 'dashboard',
  EXTRACT = 'extract',
  TRAVEL = 'travel',
  RECONCILE = 'reconcile',
  REPORTS = 'reports',
  CLARIFY = 'clarify'
}
