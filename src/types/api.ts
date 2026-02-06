// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp?: string;
  // Additional properties for error handling
  error_code?: string;
  requires_email_input?: boolean;
}

// Email Format Types
export interface EmailDisplay {
  primary_email: string | null;
  email_count: number;
  all_emails: string[];
  display_text: string;
  has_email: boolean;
}

// Authentication Types
export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: number;
    email: string;
    phone: string | null;
    first_name: string;
    last_name: string;
  };
  accounts: {
    id: number;
    client_code: string;
    account_name: string | null;
    customer_name: string;
    is_primary: boolean;
  }[];
  requires_password_creation?: boolean;
  user_id?: number;
  email?: string;
}

// Customer Data Types
export interface CustomerProfile {
  customerId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  packageName: string;
  status: string;
}

export interface CustomerData {
  customerId: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  package: string;
  status: string;
  invoices: AzotelInvoice[];
  maintenance: AzotelMaintenance[];
}

export interface User {
  id: number;
  email: string;
  phone: string | null;
  first_name: string;
  last_name: string;
  firstName?: string;
  lastName?: string;
  invoicingid?: string;
  account_status?: string;
  biometric_enabled?: boolean;
  last_login?: string | null;
  created_at?: string;
  accounts?: UserAccount[];
  selected_account_id?: number;
}

export interface UserAccount {
  id: number;
  client_code: string;
  account_name: string | null;
  customer_name: string;
  is_primary: boolean;
  status?: string;
  linked_at?: string;
  is_selected?: boolean;
}

export interface LinkedAccount {
  user_id: number;
  invoicing_id: string;
  name: string;
  email: string;
  linked_at: string;
}

export interface AccountLinkRequest {
  target_invoicing_id: string;
}

export interface AccountLinkRequestResponse {
  email_options: string[];
  target_account: {
    invoicing_id: string;
    name: string;
  };
}

export interface SendOTPRequest {
  target_invoicing_id: string;
  selected_email: string;
}

export interface SendOTPResponse {
  message: string;
  expires_in_minutes: number;
}

export interface VerifyOTPRequest {
  target_invoicing_id: string;
  otp_code: string;
}

export interface VerifyOTPResponse {
  message: string;
  linked_account: LinkedAccount;
}

// Check User Response Type
export interface CheckUserResponse {
  client_code: string;
  customer_name: string;
  email_options?: string[];
  phone_options?: string[];
  accounts: {
    account_number: string;
    customer_name: string;
    status: string;
    email: string;
  }[];
  user_exists?: boolean;
  user_email?: string;
  message: string;
}

// Azotel API Response Types
export interface AzotelApiResponse {
  success: boolean;
  data: AzotelCustomerData;
  message?: string;
}

export interface AzotelCustomerData {
  customer: AzotelCustomer;
  invoices: AzotelInvoice[];
  maintenance: AzotelMaintenance[];
}

export interface AzotelCustomer {
  customerid: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  package: string;
  status: string;
}

export interface AzotelInvoice {
  invoiceid: string;
  invoiceno: string;
  date: string;
  invoicedate: string;
  amount: number;
  status: string;
  paymentstatus: string;
  description: string;
  duedate: string;
  paymentdate?: string;
  amountpaid?: number;
}

export interface AzotelMaintenance {
  id: string;
  date: string;
  datescheduled: string;
  dateclosed?: string;
  type: string;
  description: string;
  issuedescreption?: string;
  status: string;
  technician: string;
}

// Dashboard Types
export interface DashboardData {
  customer_info: {
    name: string;
    id: string;
    customerid: number;
    status: string;
    account_type?: string; // 'Current' or 'Post'
    status_reason?: string | null; // Suspension reason if applicable
    service_type: string;
    email: EmailDisplay;
    package_description: string;
    package_name: string;
    package_code: string;
    site_name: string;
    packages?: Array<{
      id: string;
      name: string;
      code: string;
      description: string;
      amount: number;
      quantity: number;
    }>;
    total_subscription_amount?: number;
  };
  customer: {
    customer_number: string;
    name: string;
    email: EmailDisplay;
    phone: string;
    address: string;
    package_name: string;
    package_speed: string;
    monthly_fee: number;
    status: string;
    account_type?: string; // 'Current' or 'Post'
    status_reason?: string | null; // Suspension reason if applicable
    installation_date: string;
    last_payment_date: string;
    balance: number;
    service_type: string;
    customerid: number;
  };
  usage: {
    current_month: {
      download_gb: number;
      upload_gb: number;
      total_gb: number;
      days_remaining: number;
      daily_average: number;
      period: string;
    };
    previous_month: {
      download_gb: number;
      upload_gb: number;
      total_gb: number;
    };
    package_details: {
      name: string;
      speed: string;
      limit_gb: number;
      monthly_fee: number;
      subscription_plan?: string;
      subscription_limit?: string;
      download_speed_mbps?: number;
      upload_speed_mbps?: number;
      is_uncapped?: boolean;
    };
  };
  service: {
    status: string;
    account_type?: string; // 'Current' or 'Post'
    status_reason?: string | null; // Suspension reason if applicable
    connection: string;
    ip_address: string;
    plan: string;
    location: string;
  };
  billing: {
    current_balance: string;
    latest_invoice: {
      invoice_number: string;
      amount: string;
      status: string;
      date: string;
      due_date: string;
    } | null;
    next_billing_date: string;
  };
  alerts: {
    open_tickets: number;
    service_issues: number;
    unpaid_invoices: number;
    connection_status: string;
  };
  recent_payments: any[];
  outstanding_invoices: Array<{
    id: number;
    customer_number: string;
    invoice_number: string;
    amount: number;
    status: string;
    due_date: string;
    issue_date: string;
  }>;
  active_tickets: any[];
  current_outages: any[];
  unread_notifications: number;
}

// Usage Data Types
export interface UsageData {
  totalUsed: number;
  totalAllowance: number;
  percentageUsed: number;
  resetDate: string;
  currentSpeed: string;
  current_month?: any;
  previous_month?: any;
  package_details?: any;
}

export interface UsageSummary {
  totalUsed: number;
  totalAllowance: number;
  percentageUsed: number;
  resetDate: string;
  currentSpeed: string;
  dailyUsage: Array<{
    date: string;
    usage: number;
  }>;
}

// Detailed Usage Types for UsageScreen
export interface DetailedUsageData {
  summary: {
    total_usage: {
      download_gb: number;
      upload_gb: number;
      total_gb: number;
      download_bytes: number;
      upload_bytes: number;
      total_bytes: number;
    };
    package_info: {
      name: string;
      code: string;
      package_amount: number;
      total_monthly_amount?: number;
      formatted_total_amount?: string;
      limit_gb: number | null;
      is_uncapped: boolean;
      subscription_limit: string;
      percentage_used: number | null;
      download_speed_mbps: number;
      upload_speed_mbps: number;
      speed_description: string;
    };
    packages?: Array<{
      name: string;
      code: string;
      description: string;
      amount_excl_vat: number;
      amount_incl_vat: number;
      formatted_amount: string;
      traffic_cap: string | null;
      status: string;
    }>;
    billing_period: {
      current_month: string;
      period_start: string;
      period_end: string;
      days_remaining: number;
      days_elapsed: number;
    };
  };
  daily_breakdown: Array<{
    day: number;
    label: string;
    date: string;
    download_mb: number;
    upload_mb: number;
    total_mb: number;
    download_gb: number;
    upload_gb: number;
    total_gb: number;
    has_data: boolean;
  }>;
  usage_trends: {
    weekly_total: {
      download_mb: number;
      upload_mb: number;
      total_mb: number;
    };
    average_daily: {
      download_mb: number;
      upload_mb: number;
      total_mb: number;
    };
  };
  alerts: {
    high_usage: boolean;
    approaching_limit: boolean;
    over_limit: boolean;
    unusual_activity: boolean;
  };
  raw_data: {
    usage_object: {
      captotal: number;
      d1down: number;
      d1up: number;
      d2down: number;
      d2up: number;
      weekdown: number;
      weekup: number;
      w1down: number;
      w1up: number;
      m1down: number;
      m1up: number;
      traffic_cap: string;
      traffic_cap_subscription: string;
      traffic_cap_overage: string;
      capdown: number;
      capup: number;
      blackout: number;
    };
    subscription_details: any;
    debug_info: any;
  };
}

// Billing Types
export interface CustomerBilling {
  currentBalance: number;
  nextPaymentDate: string;
  recentInvoices: AzotelInvoice[];
}

// Detailed Billing Types for BillingScreen
export interface DetailedBillingData {
  account_summary: {
    current_balance: number;
    client_owes_amount: number;
    we_owe_client_amount: number;
    credit_remaining: number;
    prepayment_remaining: number;
    account_status: string;
    last_payment_date: string | null;
    last_payment_amount: number;
  };
  invoices: {
    all_invoices: BillingInvoice[];
    paid_invoices: BillingInvoice[];
    unpaid_invoices: BillingInvoice[];
    overdue_invoices: BillingInvoice[];
    recent_invoices: BillingInvoice[];
  };
  billing_info: {
    package_amount: number;
    billing_cycle: string;
    next_billing_date: string | null;
    estimated_next_amount: number;
    billing_day: string;
    payment_method: string;
    auto_payment_enabled: boolean;
    billing_email: EmailDisplay;
    billing_address: string;
  };
  payment_history: {
    monthly_breakdown: MonthlyBilling[];
    total_paid_this_year: number;
    average_monthly_amount: number;
  };
  alerts: {
    has_overdue: boolean;
    has_unpaid_invoices: boolean;
    client_owes_money: boolean;
    we_owe_client: boolean;
    payment_due_soon: boolean;
    low_credit: boolean;
    auto_payment_failed: boolean;
  };
  raw_data: {
    customer_statement: any;
    subscription_details: any;
  };
}

export interface BillingInvoice {
  invoice_number: string;
  amount: number;
  amount_paid: number;
  outstanding_amount: number;
  status: string;
  invoice_date: string;
  payment_date: string | null;
  due_date: string | null;
  reference: string;
  description: string;
  is_overdue: boolean;
  days_overdue: number;
}

export interface MonthlyBilling {
  month: string;
  month_name: string;
  total_amount: number;
  total_paid: number;
  invoice_count: number;
}

// Support Ticket Types
export interface SupportTicket {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: string;
  updatedAt: string;
  messages: TicketMessage[];
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  sender: 'customer' | 'support';
  message: string;
  timestamp: string;
}

export interface CreateTicketRequest {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

// Report Issue Types (for email support)
export interface ReportIssueRequest {
  subject: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
}

export interface ReportIssueResponse {
  message: string;
  reference?: string;
  priority?: string;
  category?: string;
  support_email?: string;
  quota?: SupportIssueQuota;
}

export interface SupportIssueQuota {
  daily_limit: number;
  used_today: number;
  remaining_today: number;
  reset_at: string;
  limit_reached: boolean;
}

// Outage Types
export interface Outage {
  id: string;
  title: string;
  description: string;
  affectedAreas: string[];
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  startTime: string;
  estimatedResolution?: string;
  updates: OutageUpdate[];
}

export interface OutageUpdate {
  id: string;
  message: string;
  timestamp: string;
}

export interface OutageReport {
  id: string;
  title: string;
  description: string;
  affectedAreas: string[];
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  startTime: string;
  estimatedResolution?: string;
  updates: OutageUpdate[];
}

// Payment Types
export interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  method: string;
  date: string;
  reference: string;
}

// Invoice Types (Additional to AzotelInvoice)
export interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  amount: number;
  status: 'paid' | 'unpaid' | 'overdue' | 'cancelled';
  items: InvoiceItem[];
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

// Notification Types
export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  read: boolean;
  createdAt: string;
}

// Outages Types
export interface OutageUpdate {
  id: string;
  message: string;
  eta_update: string;
  technician_id: number;
  created_at: string;
}

export interface OutageData {
  id: string | number;
  title: string;
  description: string;
  status: 'active' | 'resolved' | 'scheduled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  outage_type: string;
  area: string;
  tower: {
    name: string;
  };
  start_time: string;
  estimated_end_time: string;
  last_updated: string;
  updates: OutageUpdate[];
  latest_update: OutageUpdate;
  updates_count: number;
}

export interface OutagesResponse {
  outages: OutageData[];
  total_count: number;
  site_name: string;
  timestamp: string;
}

// Advertisement Types
export type AdPlacement = 'dashboard_top' | 'dashboard_bottom' | 'usage' | 'billing' | 'modal';

export interface Advertisement {
  id: number;
  title: string;
  image_url: string;
  link_url: string;
  placement: AdPlacement;
}
