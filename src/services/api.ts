import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { uploadAsync, FileSystemUploadType } from 'expo-file-system/legacy';
import { 
  ApiResponse, 
  User, 
  AuthResponse, 
  CustomerData, 
  UsageSummary, 
  DetailedUsageData,
  DetailedBillingData,
  SupportTicket, 
  TicketMessage, 
  OutageReport, 
  Payment, 
  Invoice, 
  Notification,
  DashboardData,
  CheckUserResponse,
  EmailDisplay,
  OutagesResponse,
  ReportIssueRequest,
  ReportIssueResponse,
  SupportIssueQuota
} from '../types/api';

// const API_BASE_URL = 'http://192.168.1.128:8500/api'; // Local development
const API_BASE_URL = 'https://app.ctecg.co.za/api'; // Production

class ApiService {
  private authToken: string | null = null;
  private onAuthFailure: (() => void) | null = null;

  setAuthToken(token: string | null) {
    this.authToken = token;
  }

  setAuthFailureCallback(callback: (() => void) | null) {
    this.onAuthFailure = callback;
  }

  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
      console.log('📡 API Request with token:', {
        endpoint,
        tokenLength: this.authToken.length,
        tokenPrefix: this.authToken.substring(0, 20),
        hasToken: !!this.authToken
      });
    } else {
      console.log('📡 API Request without token:', endpoint);
    }

    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
        cache: 'no-store', // CRITICAL: Disable HTTP caching to prevent user switching
      });
      
      clearTimeout(timeoutId);

      console.log('API Response status:', response.status, endpoint);
      
      const responseText = await response.text();
      console.log('Raw response:', responseText.substring(0, 500)); // Log first 500 chars
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError);
        console.error('Response was:', responseText);
        throw new Error(`Invalid JSON response from server: ${responseText.substring(0, 100)}`);
      }
      
      if (!response.ok) {
        console.error('API Error response:', data);
        
        // Handle 401 Unauthorized - but only if we actually sent a token
        // (don't trigger logout on login failures)
        if (response.status === 401 && this.authToken && this.onAuthFailure) {
          console.log('🔴 Token expired/invalid, triggering logout');
          this.onAuthFailure();
        }
        
        // Create error with details
        const error: any = new Error(data.message || `HTTP ${response.status}`);
        error.details = data.details;
        error.code = response.status;
        throw error;
      }

      return data;
    } catch (error) {
      console.error('API Request failed:', { endpoint, error });
      throw error;
    }
  }

  // New Authentication Flow
  async checkUser(invoicingId: string): Promise<ApiResponse<CheckUserResponse>> {
    return this.makeRequest<CheckUserResponse>('/auth.php?action=verify-client-code', {
      method: 'POST',
      body: JSON.stringify({
        client_code: invoicingId,
      }),
    });
  }

  async register(userData: {
    invoicingid: string;
    password: string;
    selected_email: string;
    selected_phone: string;
  }): Promise<ApiResponse<AuthResponse>> {
    return this.makeRequest<AuthResponse>('/auth.php?action=register', {
      method: 'POST',
      body: JSON.stringify({
        client_code: userData.invoicingid,
        password: userData.password,
        selected_email: userData.selected_email,
        selected_phone: userData.selected_phone
      }),
    });
  }

  async login(invoicingId: string, password: string, deviceInfo?: { deviceName?: string; deviceModel?: string; osName?: string; osVersion?: string }): Promise<ApiResponse<AuthResponse>> {
    return this.makeRequest<AuthResponse>('/auth.php?action=login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: invoicingId,
        password,
        device_info: deviceInfo,
      }),
    });
  }

  async verifyOTP(email: string, otpCode: string): Promise<ApiResponse<{ message: string }>> {
    return this.makeRequest<{ message: string }>('/auth.php?action=verify-otp', {
      method: 'POST',
      body: JSON.stringify({
        email,
        otp_code: otpCode,
      }),
    });
  }

  async resendOTP(email: string): Promise<ApiResponse<{ message: string }>> {
    return this.makeRequest<{ message: string }>('/auth.php?action=resend-otp', {
      method: 'POST',
      body: JSON.stringify({
        email,
      }),
    });
  }

  async forgotPassword(identifier: string): Promise<ApiResponse<{ reset_requested: boolean; email_sent: boolean }>> {
    return this.makeRequest<{ reset_requested: boolean; email_sent: boolean }>('/auth.php?action=forgot-password', {
      method: 'POST',
      body: JSON.stringify({
        identifier,
      }),
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<ApiResponse<{ password_reset: boolean }>> {
    return this.makeRequest<{ password_reset: boolean }>('/auth.php?action=reset-password', {
      method: 'POST',
      body: JSON.stringify({
        token,
        new_password: newPassword,
      }),
    });
  }

  async createPassword(userId: number, email: string, password: string): Promise<ApiResponse<{ password_created: boolean }>> {
    return this.makeRequest<{ password_created: boolean }>('/auth.php?action=create-password', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        email,
        password,
      }),
    });
  }

  async forgotEmail(clientCode: string): Promise<ApiResponse<{ email: string; hint: string }>> {
    return this.makeRequest<{ email: string; hint: string }>('/auth.php?action=forgot-email', {
      method: 'POST',
      body: JSON.stringify({
        client_code: clientCode,
      }),
    });
  }

  async getCurrentUser(): Promise<ApiResponse<User>> {
    return this.makeRequest<User>('/auth.php?action=profile', {
      method: 'GET'
    });
  }

  async getOnlineStatus(): Promise<ApiResponse<{ is_online: boolean; last_seen: string | null; status: string; last_activity_seconds_ago?: number }>> {
    return this.makeRequest('/mobile-api.php?endpoint=online-status', {
      method: 'GET'
    });
  }

  // Customer Data
  async getCustomerData(): Promise<ApiResponse<CustomerData>> {
    // Note: customer.php doesn't exist. Use dashboard endpoint instead.
    const dashboardData = await this.getDashboardData();
    if (!dashboardData.success || !dashboardData.data) {
      return {
        success: false,
        message: 'Failed to load customer data',
        timestamp: new Date().toISOString()
      };
    }
    
    // Extract customer data from dashboard response
    const customer = dashboardData.data.customer;
    return {
      success: true,
      message: 'Customer data loaded',
      data: customer as any,
      timestamp: new Date().toISOString()
    };
  }

  async getUsageData(): Promise<ApiResponse<UsageSummary>> {
    // Note: customer.php doesn't exist. Use usage endpoint instead.
    return this.makeRequest<UsageSummary>('/mobile-api.php?endpoint=usage');
  }

  async getDetailedUsageData(): Promise<ApiResponse<DetailedUsageData>> {
    try {
      console.log('getDetailedUsageData called, current authToken:', !!this.authToken);
      
      // If no token is set, try to load it from secure store
      if (!this.authToken) {
        const token = await SecureStore.getItemAsync('auth_token');
        console.log('Loaded token from SecureStore:', !!token);
        if (token) {
          this.setAuthToken(token);
          console.log('Token set, length:', token.length);
        } else {
          console.log('No token found in SecureStore');
          return {
            success: false,
            message: 'Authentication required - no token found',
            timestamp: new Date().toISOString()
          };
        }
      }

      console.log('Making request to usage-detailed endpoint');
      const response = await this.makeRequest<DetailedUsageData>(`/mobile-api.php?endpoint=usage-detailed`, {
        method: 'GET',
      });

      return response;
    } catch (error) {
      console.error('getDetailedUsageData error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to load detailed usage data',
        timestamp: new Date().toISOString()
      };
    }
  }

  async getDetailedBillingData(): Promise<ApiResponse<DetailedBillingData>> {
    try {
      console.log('getDetailedBillingData called, current authToken:', !!this.authToken);
      
      // If no token is set, try to load it from secure store
      if (!this.authToken) {
        const token = await SecureStore.getItemAsync('auth_token');
        console.log('Loaded token from SecureStore:', !!token);
        if (token) {
          this.setAuthToken(token);
          console.log('Token set, length:', token.length);
        } else {
          console.log('No token found in SecureStore');
          return {
            success: false,
            message: 'Authentication required - no token found',
            timestamp: new Date().toISOString()
          };
        }
      }

      console.log('Making request to billing-detailed endpoint');
      const response = await this.makeRequest<DetailedBillingData>(`/mobile-api.php?endpoint=billing-detailed`, {
        method: 'GET',
      });

      return response;
    } catch (error) {
      console.error('getDetailedBillingData error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to load detailed billing data',
        timestamp: new Date().toISOString()
      };
    }
  }

  // Dashboard
  async getDashboardData(): Promise<ApiResponse<DashboardData>> {
    try {
      console.log('getDashboardData called, current authToken:', !!this.authToken);
      
      // If no token is set, try to load it from secure store
      if (!this.authToken) {
        const token = await SecureStore.getItemAsync('auth_token');
        console.log('Loaded token from SecureStore:', !!token);
        if (token) {
          this.setAuthToken(token);
          console.log('Token set, length:', token.length);
        } else {
          console.log('No token found in SecureStore');
          return {
            success: false,
            message: 'Authentication required - no token found',
            timestamp: new Date().toISOString()
          };
        }
      }

      console.log('Making request to dashboard endpoint');
      const response = await this.makeRequest<any>(`/mobile-api.php?endpoint=dashboard`, {
        method: 'GET',
      });

      console.log('Dashboard API Response:', {
        success: response.success,
        hasData: !!response.data,
        dataKeys: response.data ? Object.keys(response.data) : []
      });

      if (response.success && response.data) {
        // Map the API response to our DashboardData interface
        const apiData = response.data;
        
        // Handle email field which can be a string or object
        const displayEmail = this.formatEmailForDisplay(apiData.customer_info?.email);
        
        console.log('Email processing:', {
          originalEmail: apiData.customer_info?.email,
          displayEmail,
          emailType: typeof apiData.customer_info?.email
        });

        console.log('Service status details:', {
          status: apiData.service_status?.status,
          connection: apiData.service_status?.connection,
          location: apiData.service_status?.location,
          isUncapped: apiData.service_status?.is_uncapped
        });
        
        const dashboardData: DashboardData = {
          customer_info: {
            name: apiData.customer_info?.name || '',
            id: apiData.customer_info?.id || '',
            customerid: parseInt(apiData.customer_info?.customerid) || 0,
            status: apiData.customer_info?.status || '',
            service_type: apiData.customer_info?.service_type || '',
            email: displayEmail,
            package_description: apiData.customer_info?.package_description || '',
            package_name: apiData.customer_info?.package_name || '',
            package_code: apiData.customer_info?.package_code || '',
            site_name: apiData.customer_info?.site_name || '',
          },
          customer: {
            customer_number: apiData.customer_info?.id || '',
            name: apiData.customer_info?.name || '',
            email: displayEmail,
            phone: '',
            address: '',
            package_name: apiData.customer_info?.package_name || apiData.service_status?.subscription_plan || '',
            package_speed: `${apiData.service_status?.download_speed_mbps || 0}/${apiData.service_status?.upload_speed_mbps || 0}MBPS`,
            monthly_fee: 0,
            status: apiData.customer_info?.status || '',
            installation_date: '',
            last_payment_date: apiData.billing_summary?.latest_invoice?.date || '',
            balance: parseFloat(apiData.billing_summary?.current_balance || '0'),
            service_type: apiData.customer_info?.service_type || '',
            customerid: apiData.customer_info?.customerid || 0
          },
          usage: {
            current_month: {
              download_gb: apiData.usage_summary?.download_gb || 0,
              upload_gb: apiData.usage_summary?.upload_gb || 0,
              total_gb: apiData.usage_summary?.total_gb || 0,
              days_remaining: 30,
              daily_average: (apiData.usage_summary?.total_gb || 0) / 30,
              period: apiData.usage_summary?.period || 'Current Month'
            },
            previous_month: {
              download_gb: 0,
              upload_gb: 0,
              total_gb: 0
            },
            package_details: {
              name: apiData.customer_info?.package_name || apiData.service_status?.subscription_plan || '',
              speed: apiData.service_status?.plan || `${apiData.service_status?.download_speed_mbps || 0}/${apiData.service_status?.upload_speed_mbps || 0}MBPS`,
              limit_gb: apiData.service_status?.limit_gb_numeric || 0,
              monthly_fee: 0,
              subscription_plan: apiData.service_status?.subscription_plan || '',
              subscription_limit: apiData.service_status?.subscription_limit || 'N/A',
              download_speed_mbps: apiData.service_status?.download_speed_mbps || 0,
              upload_speed_mbps: apiData.service_status?.upload_speed_mbps || 0,
              is_uncapped: apiData.service_status?.is_uncapped || false
            }
          },
          service: {
            status: apiData.service_status?.status || '',
            connection: apiData.service_status?.connection || '',
            ip_address: apiData.service_status?.ip_address || '',
            plan: apiData.service_status?.plan || `${apiData.service_status?.download_speed_mbps || 0}/${apiData.service_status?.upload_speed_mbps || 0}MBPS`,
            location: apiData.service_status?.location || ''
          },
          billing: {
            current_balance: apiData.billing_summary?.current_balance || '0.00',
            latest_invoice: apiData.billing_summary?.latest_invoice || null,
            next_billing_date: apiData.billing_summary?.next_billing_date || ''
          },
          alerts: {
            open_tickets: apiData.alerts?.open_tickets || 0,
            service_issues: apiData.alerts?.service_issues || 0,
            unpaid_invoices: apiData.alerts?.unpaid_invoices || 0,
            connection_status: apiData.alerts?.connection_status || apiData.service_status?.connection || ''
          },
          recent_payments: apiData.billing_summary?.recent_invoices || [],
          outstanding_invoices: [], // Not provided in current API response
          active_tickets: apiData.maintenance?.recent_tickets || [],
          current_outages: [], // Not provided in current API response
          unread_notifications: 0 // Not provided in current API response
        };

        return {
          success: true,
          message: 'Dashboard data loaded',
          data: dashboardData,
          timestamp: new Date().toISOString()
        };
      } else {
        return {
          success: false,
          message: response.message || 'Failed to fetch dashboard data',
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      };
    }
  }

  // Utility methods for formatting data
  formatEmailForDisplay(emailData: any): EmailDisplay {
    if (typeof emailData === 'object' && emailData !== null) {
      // Handle new email object structure from API
      if (emailData.primary_email) {
        return {
          primary_email: emailData.primary_email,
          email_count: emailData.email_count || 1,
          all_emails: emailData.all_emails || [emailData.primary_email],
          display_text: emailData.display_text || emailData.primary_email,
          has_email: emailData.has_email !== undefined ? emailData.has_email : true
        };
      }
      if (emailData.all_emails && Array.isArray(emailData.all_emails) && emailData.all_emails.length > 0) {
        const primaryEmail = emailData.all_emails[0];
        return {
          primary_email: primaryEmail,
          email_count: emailData.all_emails.length,
          all_emails: emailData.all_emails,
          display_text: emailData.all_emails.length > 1 ? `${primaryEmail} (+${emailData.all_emails.length - 1} more)` : primaryEmail,
          has_email: true
        };
      }
    }
    if (typeof emailData === 'string' && emailData.trim()) {
      // Handle legacy string format or comma-separated emails
      const emails = emailData.split(',').map(email => email.trim()).filter(email => email);
      const primaryEmail = emails[0];
      return {
        primary_email: primaryEmail,
        email_count: emails.length,
        all_emails: emails,
        display_text: emails.length > 1 ? `${primaryEmail} (+${emails.length - 1} more)` : primaryEmail,
        has_email: true
      };
    }
    
    // Return empty structure if no valid email data
    return {
      primary_email: null,
      email_count: 0,
      all_emails: [],
      display_text: 'No email',
      has_email: false
    };
  }

  formatConnectionStatus(serviceStatus: any): string {
    if (serviceStatus?.connection_details?.message) {
      return serviceStatus.connection_details.message;
    }
    return serviceStatus?.connection || 'Unknown';
  }

  formatUsageForDisplay(usage: any) {
    return {
      download: `${usage.download_gb?.toFixed(2) || '0.00'} GB`,
      upload: `${usage.upload_gb?.toFixed(2) || '0.00'} GB`,
      total: `${usage.total_gb?.toFixed(2) || '0.00'} GB`,
      formattedTotal: usage.formatted_total || `${usage.total_gb?.toFixed(2) || '0.00'} GB`
    };
  }

  formatSpeedForDisplay(packageDetails: any) {
    if (packageDetails.download_speed_mbps && packageDetails.upload_speed_mbps) {
      return `${packageDetails.download_speed_mbps}/${packageDetails.upload_speed_mbps}MBPS`;
    }
    return packageDetails.speed || 'N/A';
  }

  formatSubscriptionLimit(packageDetails: any) {
    if (packageDetails.is_uncapped) {
      return 'Unlimited';
    }
    return packageDetails.subscription_limit || `${packageDetails.limit_gb} GB`;
  }
  async getSupportTickets(): Promise<ApiResponse<SupportTicket[]>> {
    return this.makeRequest<SupportTicket[]>('/support.php?action=list');
  }

  async createSupportTicket(ticketData: {
    subject: string;
    description: string;
    category: string;
    priority: string;
  }): Promise<ApiResponse<SupportTicket>> {
    return this.makeRequest<SupportTicket>('/support.php?action=create', {
      method: 'POST',
      body: JSON.stringify(ticketData),
    });
  }

  async getTicketMessages(ticketId: number): Promise<ApiResponse<TicketMessage[]>> {
    return this.makeRequest<TicketMessage[]>(`/support.php?action=messages&ticket_id=${ticketId}`);
  }

  async addTicketMessage(ticketId: number, message: string): Promise<ApiResponse<TicketMessage>> {
    return this.makeRequest<TicketMessage>('/support.php?action=message', {
      method: 'POST',
      body: JSON.stringify({
        ticket_id: ticketId,
        message,
      }),
    });
  }

  // Outages
  async getOutages(): Promise<ApiResponse<OutagesResponse>> {
    return this.makeRequest<OutagesResponse>('/mobile-api.php?endpoint=outages');
  }

  async getOutageNotifications(): Promise<ApiResponse<any>> {
    return this.makeRequest<any>('/mobile-api.php?endpoint=outage-notifications');
  }

  async markNotificationRead(notificationId: number): Promise<ApiResponse<any>> {
    return this.makeRequest('/mobile-api.php?endpoint=mark-notification-read', {
      method: 'POST',
      body: JSON.stringify({ notification_id: notificationId }),
    });
  }

  async dismissNotification(notificationId: number): Promise<ApiResponse<any>> {
    return this.makeRequest('/mobile-api.php?endpoint=dismiss-notification', {
      method: 'POST',
      body: JSON.stringify({ notification_id: notificationId }),
    });
  }

  // Payments
  async getPayments(): Promise<ApiResponse<Payment[]>> {
    return this.makeRequest<Payment[]>('/payment.php?action=list');
  }

  async initiatePayment(paymentData: {
    amount: number;
    method: string;
    description: string;
  }): Promise<ApiResponse<any>> {
    return this.makeRequest('/payment.php?action=initiate', {
      method: 'POST',
      body: JSON.stringify(paymentData),
    });
  }

  // Invoices
  async getInvoices(): Promise<ApiResponse<Invoice[]>> {
    // Note: customer.php doesn't exist. Use billing endpoint instead.
    const billingData = await this.makeRequest<any>('/mobile-api.php?endpoint=billing');
    if (billingData.success && billingData.data?.invoices) {
      return {
        success: true,
        message: 'Invoices loaded',
        data: billingData.data.invoices,
        timestamp: new Date().toISOString()
      };
    }
    return {
      success: false,
      message: 'Failed to load invoices',
      timestamp: new Date().toISOString()
    };
  }

  async getInvoice(invoiceId: number): Promise<ApiResponse<Invoice>> {
    // Note: customer.php doesn't exist. Get from billing data.
    const invoices = await this.getInvoices();
    if (invoices.success && invoices.data) {
      const invoice = invoices.data.find((inv: any) => inv.id === invoiceId);
      if (invoice) {
        return {
          success: true,
          message: 'Invoice loaded',
          data: invoice,
          timestamp: new Date().toISOString()
        };
      }
    }
    return {
      success: false,
      message: 'Invoice not found',
      timestamp: new Date().toISOString()
    };
  }

  // Notifications
  async getNotifications(): Promise<ApiResponse<Notification[]>> {
    return this.makeRequest<Notification[]>('/notifications.php?action=list');
  }

  async markNotificationAsRead(notificationId: number): Promise<ApiResponse<any>> {
    return this.makeRequest('/notifications.php?action=mark-read', {
      method: 'PUT',
      body: JSON.stringify({
        notification_id: notificationId,
      }),
    });
  }

  async updateNotificationSettings(settings: {
    push_outages?: boolean;
    push_payments?: boolean;
    push_support?: boolean;
    push_account?: boolean;
    push_usage_alerts?: boolean;
    email_notifications?: boolean;
    usage_alert_threshold?: number;
  }): Promise<ApiResponse<any>> {
    return this.makeRequest('/notifications.php?action=settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }
  // Debug endpoints
  async testDatabase(): Promise<any> {
    return this.makeRequest('/debug.php?action=test-database');
  }

  async testToken(): Promise<any> {
    return this.makeRequest('/debug.php?action=test-token');
  }

  async listTokens(): Promise<any> {
    return this.makeRequest('/debug.php?action=list-tokens');
  }

  async testAuth(): Promise<any> {
    const url = `${API_BASE_URL}/test-auth.php`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'text/plain',
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      const text = await response.text();
      console.log('Test Auth Response:', text);
      return { response: text };
    } catch (error) {
      console.error('Test Auth failed:', error);
      throw error;
    }
  }

  // Report Issue (Support)
  async reportIssue(issueData: ReportIssueRequest): Promise<ApiResponse<ReportIssueResponse>> {
    return this.makeRequest<ReportIssueResponse>('/mobile-api.php?action=report-issue', {
      method: 'POST',
      body: JSON.stringify(issueData),
    });
  }

  async getSupportIssueQuota(): Promise<ApiResponse<SupportIssueQuota>> {
    return this.makeRequest<SupportIssueQuota>('/mobile-api.php?endpoint=support-issue-quota', {
      method: 'GET',
    });
  }

  // Account Linking Methods
  async requestAccountLink(targetInvoicingId: string): Promise<ApiResponse<any>> {
    return this.makeRequest<any>('/mobile-api.php?endpoint=account-link-request', {
      method: 'POST',
      body: JSON.stringify({ target_invoicing_id: targetInvoicingId }),
    });
  }

  async sendAccountLinkOTP(targetInvoicingId: string, selectedEmail: string): Promise<ApiResponse<any>> {
    return this.makeRequest<any>('/mobile-api.php?endpoint=account-link-send-otp', {
      method: 'POST',
      body: JSON.stringify({ 
        target_invoicing_id: targetInvoicingId,
        selected_email: selectedEmail 
      }),
    });
  }

  async verifyAccountLinkOTP(targetInvoicingId: string, otpCode: string): Promise<ApiResponse<any>> {
    return this.makeRequest<any>('/mobile-api.php?endpoint=account-link-verify', {
      method: 'POST',
      body: JSON.stringify({ 
        target_invoicing_id: targetInvoicingId,
        otp_code: otpCode 
      }),
    });
  }

  async getLinkedAccounts(): Promise<ApiResponse<any>> {
    return this.makeRequest<any>('/mobile-api.php?endpoint=linked-accounts');
  }

  async switchAccount(accountId: number): Promise<ApiResponse<any>> {
    return this.makeRequest<any>('/mobile-api.php?endpoint=account-switch', {
      method: 'POST',
      body: JSON.stringify({ account_id: accountId }),
    });
  }

  async unlinkAccount(targetUserId: number): Promise<ApiResponse<any>> {
    return this.makeRequest<any>('/mobile-api.php?endpoint=account-unlink', {
      method: 'POST',
      body: JSON.stringify({ target_user_id: targetUserId }),
    });
  }

  // Payment Methods (used by BillingScreen)
  async getPaymentInfo(): Promise<ApiResponse<any>> {
    // Returns payment configuration info - currently a stub
    return {
      success: true,
      data: { enabled: true, provider: 'yoco' },
      timestamp: new Date().toISOString()
    };
  }

  async createPayment(paymentData: { amount: number; description?: string; email?: string }): Promise<ApiResponse<{
    checkout_id: string;
    redirect_url: string;
    payment_reference: string;
    amount: number;
  }>> {
    // Wrapper for createYocoCheckout used by BillingScreen
    return this.createYocoCheckout(
      paymentData.amount,
      paymentData.description || 'CTECG Account Payment',
      { email: paymentData.email }
    );
  }

  // Yoco Payment Methods
  async createYocoCheckout(amount: number, description: string, metadata?: any): Promise<ApiResponse<{
    checkout_id: string;
    redirect_url: string;
    payment_reference: string;
    amount: number;
  }>> {
    return this.makeRequest('/mobile-api.php?endpoint=yoco-create-checkout', {
      method: 'POST',
      body: JSON.stringify({ amount, description, metadata }),
    });
  }

  async getYocoPaymentStatus(paymentReference: string): Promise<ApiResponse<{
    reference: string;
    status: string;
    amount: number;
    description: string;
    created_at: string;
    completed_at: string | null;
    failure_reason: string | null;
  }>> {
    return this.makeRequest(`/mobile-api.php?endpoint=yoco-payment-status&payment_reference=${paymentReference}`, {
      method: 'GET',
    });
  }

  async getYocoPaymentHistory(limit: number = 10): Promise<ApiResponse<{
    payments: Array<{
      payment_reference: string;
      amount: number;
      description: string;
      status: string;
      created_at: string;
      completed_at: string | null;
    }>;
    count: number;
  }>> {
    return this.makeRequest(`/mobile-api.php?endpoint=yoco-payment-history&limit=${limit}`, {
      method: 'GET',
    });
  }

  // Push Notification APIs
  async updateFcmToken(fcmToken: string): Promise<ApiResponse<{ message: string; user_id: number }>> {
    return this.makeRequest('/mobile-api.php?endpoint=update-fcm-token', {
      method: 'POST',
      body: JSON.stringify({ fcm_token: fcmToken }),
    });
  }

  // Advertisement APIs
  async getActiveAd(placement: string): Promise<ApiResponse<{
    id: number;
    title: string;
    image_url: string; // First image for backward compatibility
    link_url: string;
    placement: string;
    images: Array<{
      id: number;
      image_url: string;
      display_order: number;
    }>;
  } | null>> {
    return this.makeRequest(`/admin-api.php/ads/active?placement=${placement}`, {
      method: 'GET',
    });
  }

  async trackAdClick(adId: number): Promise<ApiResponse<{ message: string }>> {
    return this.makeRequest(`/admin-api.php/ads/${adId}/click`, {
      method: 'POST',
      body: JSON.stringify({
        invoicing_id: this.authToken ? 'authenticated' : null,
      }),
    });
  }

  async trackAdView(adId: number): Promise<ApiResponse<{ message: string }>> {
    return this.makeRequest(`/admin-api.php/ads/${adId}/view`, {
      method: 'POST',
      body: JSON.stringify({
        invoicing_id: this.authToken ? 'authenticated' : null,
      }),
    });
  }

  // Debit Order APIs
  async submitDebitOrder(data: {
    account_holder: string;
    bank_name: string;
    account_number: string;
    account_type: string;
    branch_name: string;
    branch_code: string;
    deduction_date: string;
    terms_accepted: boolean;
    confirmation_file?: any;
  }): Promise<boolean> {
    try {
      const url = `${API_BASE_URL}/mobile-api.php?endpoint=submit-debit-order`;
      
      console.log('Submitting debit order to:', url);
      console.log('Has file:', !!data.confirmation_file);
      
      // Prepare form fields
      const formFields: Record<string, string> = {
        account_holder: data.account_holder,
        bank_name: data.bank_name,
        account_number: data.account_number,
        account_type: data.account_type,
        branch_name: data.branch_name,
        branch_code: data.branch_code,
        deduction_date: data.deduction_date,
        terms_accepted: data.terms_accepted ? '1' : '0',
      };

      let result;
      
      if (data.confirmation_file) {
        // Upload with file using legacy uploadAsync
        console.log('Uploading with file from:', data.confirmation_file.uri);
        
        const uploadResult = await uploadAsync(url, data.confirmation_file.uri, {
          httpMethod: 'POST',
          uploadType: FileSystemUploadType.MULTIPART,
          fieldName: 'confirmation_file',
          parameters: formFields,
          headers: this.authToken ? {
            'Authorization': `Bearer ${this.authToken}`,
          } : {},
        });
        
        console.log('Upload response status:', uploadResult.status);
        console.log('Upload response body:', uploadResult.body);
        
        if (uploadResult.status !== 200) {
          throw new Error(`Server returned status ${uploadResult.status}`);
        }
        
        result = JSON.parse(uploadResult.body);
      } else {
        // Submit without file using regular fetch
        console.log('Submitting without file attachment');
        const formData = new FormData();
        Object.entries(formFields).forEach(([key, value]) => {
          formData.append(key, value);
        });
        
        const response = await fetch(url, {
          method: 'POST',
          headers: this.authToken ? {
            'Authorization': `Bearer ${this.authToken}`,
          } : {},
          body: formData,
        });
        
        const responseText = await response.text();
        console.log('Response:', responseText);
        
        if (!response.ok) {
          throw new Error(`Server returned status ${response.status}`);
        }
        
        result = JSON.parse(responseText);
      }

      if (!result.success) {
        throw new Error(result.message || 'Failed to submit debit order application');
      }

      console.log('✓ Debit order submitted successfully');
      return true;
      
    } catch (error) {
      console.error('Submit debit order error:', error);
      throw error;
    }
  }
}

export const apiService = new ApiService();
