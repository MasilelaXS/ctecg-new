// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp?: string;
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
    id: string;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    invoicingid?: string;
  };
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
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  invoicingid?: string;
}

// Check User Response Type
export interface CheckUserResponse {
  user_exists: boolean;
  needs_registration: boolean;
  invoicingid: string;
  customer_data: {
    name: string;
    email: string;
  };
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
  customer: {
    customer_number: string;
    name: string;
    email: string;
    phone: string;
    address: string;
    package_name: string;
    package_speed: string;
    monthly_fee: number;
    status: string;
    installation_date: string;
    last_payment_date: string;
    balance: number;
  };
  usage: {
    current_month: {
      download_gb: number;
      upload_gb: number;
      total_gb: number;
      days_remaining: number;
      daily_average: number;
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
    };
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

export interface SimpleDashboardData {
  speed: string;
  used: string;
  status: string;
  package?: string;
  package1?: string;
  package2?: string;
  subscription?: string;
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

// Billing Types
export interface CustomerBilling {
  currentBalance: number;
  nextPaymentDate: string;
  recentInvoices: AzotelInvoice[];
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
