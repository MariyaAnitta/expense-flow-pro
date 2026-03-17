export type ExpenseSource = 'receipt' | 'credit_card_statement' | 'bank_statement' | 'telegram' | 'whatsapp' | 'email' | 'web_upload' | 'forwarded_email';

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

  // Shared Pool Audit
  usage_history?: UsageLog[];
  reconciled_by?: string;
  reconciled_at?: string;
  source_url?: string;
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

  // Accountant/Admin verification fields
  accountant_category?: string;
  is_verified?: boolean;
  verified_amount?: number;

  // Shared Pool Audit
  usage_history?: UsageLog[];
  reconciled_by?: string;
  reconciled_at?: string;
  card_digits?: string; // Extracted last 4 digits
  source_url?: string;
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
  matched_receipts?: Expense[]; // New field for audit logging
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
  user_id?: string;
}

export interface AppSettings {
  audit_threshold: number;
  custom_expense_heads: string[];
  updated_at?: string;
}

export interface BankMapping {
  id: string;
  user_id: string;
  card_digits: string;
  bank_name: string;
  created_at?: string;
}

export enum AppTab {
  DASHBOARD = 'dashboard',
  EXTRACT = 'extract',
  TRAVEL = 'travel',
  RECONCILE = 'reconcile',
  REPORTS = 'reports',
  RESOLVE = 'resolve',
  ACCOUNT_MASTER = 'account_master',
  SYSTEM_SETTINGS = 'system_settings',
  BANK_REGISTRY = 'bank_registry'
}

export interface UsageLog {
  user: string;
  date: string;
  action: string;
  target_id?: string;
}