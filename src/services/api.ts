import AsyncStorage from '@react-native-async-storage/async-storage';
import { uploadAsync, FileSystemUploadType } from 'expo-file-system/legacy';
import { ApiError } from './ApiError';
import { logger } from '../utils/logger';
import { accountCache } from './accountCache';
import { 
  ApiResponse, 
  User, 
  AuthResponse, 
  UsageSummary, 
  DetailedUsageData,
  DetailedBillingData,
  OutageReport, 
  Invoice, 
  DashboardData,
  CheckUserResponse,
  EmailDisplay,
  OutagesResponse,
  ReportIssueRequest,
  ReportIssueResponse,
  SupportIssueQuota,
  SupportTicket,
  TicketConversation,
  CreateChatTicketRequest,
  SendMessageRequest,
  ChatSettings,
  TicketAttachment,
  TowerNotification
} from '../types/api';

const PRODUCTION_API_BASE_URL = 'https://app.ctecg.co.za/api';
const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

// EXPO_PUBLIC_* values are public application configuration, never secrets.
// Local development can override the API host in .env.local while production
// builds safely retain the deployed API URL.
const safeConfiguredApiBaseUrl = configuredApiBaseUrl
  && (__DEV__ || configuredApiBaseUrl.toLowerCase().startsWith('https://'))
  ? configuredApiBaseUrl
  : null;
export const API_BASE_URL = (safeConfiguredApiBaseUrl || PRODUCTION_API_BASE_URL).replace(/\/+$/, '');
const DEBUG_STORAGE_KEY = 'debug_api_logs';
let debugApi = __DEV__;

interface ApiRequestOptions extends RequestInit {
  timeoutMs?: number;
  retry?: boolean;
  dedupe?: boolean;
}

class ApiService {
  private authToken: string | null = null;
  private appInstanceId: string | null = null;
  private appPlatform: 'ios' | 'android' | null = null;
  private accountScope: string | null = null;
  private onAuthFailure: (() => void) | null = null;
  private authFailureNotified = false;
  private authGeneration = 0;
  private inFlightGets = new Map<string, Promise<ApiResponse<unknown>>>();

  setAuthToken(token: string | null) {
    if (this.authToken !== token) {
      this.authGeneration += 1;
      this.inFlightGets.clear();
    }
    this.authToken = token;
    if (token) {
      this.authFailureNotified = false;
    }
  }

  getAuthToken() {
    return this.authToken;
  }

  setAccountScope(accountScope: string | null) {
    this.accountScope = accountScope?.trim() || null;
  }

  async clearCachedAccountData() {
    await accountCache.clearAll();
  }

  private async cacheSuccessfulResponse<T>(
    resource: string,
    response: ApiResponse<T>,
    accountScope: string | null,
  ): Promise<ApiResponse<T>> {
    if (response.success && response.data && accountScope) {
      await accountCache.set(accountScope, resource, response.data).catch(() => {});
    }
    return { ...response, meta: { source: 'network' } };
  }

  private async cachedFallback<T>(
    resource: string,
    error: unknown,
    accountScope: string | null,
  ): Promise<ApiResponse<T> | null> {
    const mayUseCache = error instanceof ApiError
      && (error.kind === 'network' || error.kind === 'timeout'
        || error.status === 502 || error.status === 503 || error.status === 504);
    if (!mayUseCache || !accountScope) return null;
    const cached = await accountCache.get<T>(accountScope, resource);
    if (!cached) return null;
    return {
      success: true,
      data: cached.data,
      message: 'Showing saved data while the service is unavailable.',
      timestamp: new Date().toISOString(),
      meta: { source: 'cache', cached_at: cached.savedAt },
    };
  }

  setAppIdentity(instanceId: string, platform: 'ios' | 'android') {
    this.appInstanceId = instanceId;
    this.appPlatform = platform;
  }

  setAuthFailureCallback(callback: (() => void) | null) {
    this.onAuthFailure = callback;
  }

  getDebugApiLogging() {
    return debugApi;
  }

  setDebugApiLogging(value: boolean) {
    debugApi = value;
    AsyncStorage.setItem(DEBUG_STORAGE_KEY, value ? '1' : '0');
  }

  async loadDebugApiLogging() {
    const stored = await AsyncStorage.getItem(DEBUG_STORAGE_KEY);
    if (stored !== null) {
      debugApi = stored === '1';
    }
    await this.refreshDebugApiLogging();
  }

  async refreshDebugApiLogging() {
    try {
      const response = await this.getAppConfig();
      if (response.success && response.data) {
        this.setDebugApiLogging(!!response.data.debug_api);
      }
    } catch {
      // Ignore config fetch errors to avoid blocking UI
    }
  }

  async getAppConfig(): Promise<ApiResponse<{
    debug_api: boolean;
    outages_enabled: boolean;
    support_chat_enabled: boolean;
    notifications_enabled: boolean;
    payments_enabled: boolean;
    payment_provider: 'yoco';
  }>> {
    return this.makeRequest('/mobile-api.php?endpoint=app-config', {
      method: 'GET',
    });
  }

  private makeRequest<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<ApiResponse<T>> {
    const method = (options.method || 'GET').toUpperCase();
    const shouldDedupe = method === 'GET' && options.dedupe !== false;
    const key = `${this.authGeneration}:${method}:${endpoint}`;
    const existing = shouldDedupe ? this.inFlightGets.get(key) : undefined;
    if (existing) return existing as Promise<ApiResponse<T>>;

    const request = this.requestWithRetry<T>(endpoint, options);
    if (shouldDedupe) {
      this.inFlightGets.set(key, request as Promise<ApiResponse<unknown>>);
      void request.finally(() => this.inFlightGets.delete(key)).catch(() => {});
    }
    return request;
  }

  private async requestWithRetry<T>(endpoint: string, options: ApiRequestOptions): Promise<ApiResponse<T>> {
    const method = (options.method || 'GET').toUpperCase();
    const maxAttempts = method === 'GET' && options.retry !== false ? 2 : 1;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.performRequest<T>(endpoint, options);
      } catch (error) {
        const retryable = error instanceof ApiError
          && (error.kind === 'network' || error.kind === 'timeout' || error.status === 502 || error.status === 504);
        if (!retryable || attempt === maxAttempts) throw error;
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
    throw new ApiError('Unable to complete the request.', { kind: 'network' });
  }

  private async performRequest<T>(
    endpoint: string,
    options: ApiRequestOptions,
  ): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`;
    const method = (options.method || 'GET').toUpperCase();
    // Capture the credential used by this request. A delayed response from an
    // older request must never invalidate a newer login session.
    const requestAuthToken = this.authToken;
    const timeoutMs = options.timeoutMs ?? (method === 'GET' ? 15_000 : 30_000);
    const { timeoutMs: _timeoutMs, retry: _retry, dedupe: _dedupe, ...fetchOptions } = options;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (requestAuthToken) {
      headers['Authorization'] = `Bearer ${requestAuthToken}`;
    }
    if (this.appInstanceId) {
      headers['X-App-Instance-ID'] = this.appInstanceId;
    }
    if (this.appPlatform) {
      headers['X-App-Platform'] = this.appPlatform;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      
      if (debugApi) {
        logger.debug('API request', { endpoint, method });
      }

      const response = await fetch(url, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
        cache: 'no-store', // CRITICAL: Disable HTTP caching to prevent user switching
      });
      
      if (debugApi) {
        logger.debug('API response', { endpoint, status: response.status });
      }
      
      const responseText = await response.text();
      
      let data: ApiResponse<T> & { details?: unknown };
      try {
        data = JSON.parse(responseText) as ApiResponse<T> & { details?: unknown };
      } catch (parseError) {
        throw new ApiError('The server returned an invalid response. Please try again.', {
          kind: 'invalid-response', status: response.status, cause: parseError,
        });
      }
      
      if (!response.ok) {
        if (debugApi) logger.warn('API error response', { endpoint, status: response.status });
        
        // Handle 401 Unauthorized - but only if we actually sent a token
        // (don't trigger logout on login failures)
        if (
          response.status === 401
          && requestAuthToken
          && requestAuthToken === this.authToken
          && this.onAuthFailure
          && !this.authFailureNotified
          && endpoint !== '/auth.php?action=logout'
        ) {
          this.authFailureNotified = true;
          console.log('🔴 Token expired/invalid, clearing local authentication');
          this.onAuthFailure();
        }
        
        // Create error with details
        throw new ApiError(data.message || data.error || `HTTP ${response.status}`, {
          kind: 'http', status: response.status, details: data.details,
        });
      }

      return data;
    } catch (cause) {
      if (cause instanceof ApiError) throw cause;
      const timedOut = cause instanceof Error && cause.name === 'AbortError';
      const error = new ApiError(
        timedOut
          ? 'The service took too long to respond. Please try again.'
          : 'The service could not be reached. Please try again.',
        { kind: timedOut ? 'timeout' : 'network', cause },
      );
      if (debugApi) logger.error('API request failed', { endpoint, error });
      throw error;
    } finally {
      clearTimeout(timeoutId);
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

  async login(invoicingId: string, password: string, deviceInfo?: {
    deviceName?: string;
    deviceModel?: string;
    osName?: string;
    osVersion?: string;
    appInstanceId?: string;
    location?: {
      latitude?: number;
      longitude?: number;
      accuracyMeters?: number;
      capturedAt?: string;
      permissionStatus: string;
      source: 'device_gps' | 'timeout' | 'unavailable';
    };
  }): Promise<ApiResponse<AuthResponse>> {
    return this.makeRequest<AuthResponse>('/auth.php?action=login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: invoicingId,
        password,
        device_info: {
          ...deviceInfo,
          appInstanceId: this.appInstanceId || deviceInfo?.appInstanceId,
        },
      }),
    });
  }

  async verifyOTP(email: string, otpCode: string): Promise<ApiResponse<{ verified: boolean; token: string }>> {
    return this.makeRequest<{ verified: boolean; token: string }>('/auth.php?action=verify-otp', {
      method: 'POST',
      body: JSON.stringify({
        email,
        otp_code: otpCode,
        device_info: {
          appInstanceId: this.appInstanceId,
          osName: this.appPlatform,
        },
      }),
    });
  }

  async heartbeat(): Promise<ApiResponse<{ online: boolean; server_time: string; presence_window_seconds: number; heartbeat_interval_seconds: number }>> {
    return this.makeRequest('/mobile-api.php?endpoint=heartbeat', {
      method: 'GET',
      retry: false,
      dedupe: false,
      timeoutMs: 10_000,
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

  async resetPassword(token: string, newPassword: string, identifier: string): Promise<ApiResponse<{ password_reset: boolean }>> {
    return this.makeRequest<{ password_reset: boolean }>('/auth.php?action=reset-password', {
      method: 'POST',
      body: JSON.stringify({
        token,
        new_password: newPassword,
        identifier,
      }),
    });
  }

  async createPassword(userId: number, email: string, resetCode: string, password: string): Promise<ApiResponse<{ password_created: boolean }>> {
    return this.makeRequest<{ password_created: boolean }>('/auth.php?action=create-password', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        email,
        reset_code: resetCode,
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

  async getOnlineStatus(): Promise<ApiResponse<{ is_online: boolean | null; last_seen: string | null; status: string; last_activity_seconds_ago?: number }>> {
    return this.makeRequest('/mobile-api.php?endpoint=online-status', {
      method: 'GET',
      timeoutMs: 12_000,
    });
  }

  async getUsageData(): Promise<ApiResponse<UsageSummary>> {
    // Note: customer.php doesn't exist. Use usage endpoint instead.
    return this.makeRequest<UsageSummary>('/mobile-api.php?endpoint=usage');
  }

  async getDetailedUsageData(): Promise<ApiResponse<DetailedUsageData>> {
    const accountScope = this.accountScope;
    try {
      if (!this.authToken) {
        return { success: false, message: 'Authentication required', timestamp: new Date().toISOString() };
      }

      const response = await this.makeRequest<DetailedUsageData>(`/mobile-api.php?endpoint=usage-detailed`, {
        method: 'GET',
        // This read depends on live Azotel usage data. Allow a bounded window
        // for mobile latency, but do not duplicate the expensive backend work
        // through the generic GET retry policy.
        timeoutMs: 30_000,
        retry: false,
      });

      return await this.cacheSuccessfulResponse('usage-detailed', response, accountScope);
    } catch (error) {
      logger.error('Detailed usage request failed', error);
      const cached = await this.cachedFallback<DetailedUsageData>('usage-detailed', error, accountScope);
      if (cached) return cached;
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to load detailed usage data',
        timestamp: new Date().toISOString()
      };
    }
  }

  async getDetailedBillingData(): Promise<ApiResponse<DetailedBillingData>> {
    const accountScope = this.accountScope;
    try {
      if (!this.authToken) {
        return { success: false, message: 'Authentication required', timestamp: new Date().toISOString() };
      }

      const response = await this.makeRequest<DetailedBillingData>(`/mobile-api.php?endpoint=billing-detailed`, {
        method: 'GET',
      });

      return await this.cacheSuccessfulResponse('billing-detailed', response, accountScope);
    } catch (error) {
      logger.error('Detailed billing request failed', error);
      const cached = await this.cachedFallback<DetailedBillingData>('billing-detailed', error, accountScope);
      if (cached) return cached;
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to load detailed billing data',
        timestamp: new Date().toISOString()
      };
    }
  }

  // Dashboard
  async getDashboardData(): Promise<ApiResponse<DashboardData>> {
    const accountScope = this.accountScope;
    try {
      if (!this.authToken) {
        return { success: false, message: 'Authentication required', timestamp: new Date().toISOString() };
      }

      const response = await this.makeRequest<any>(`/mobile-api.php?endpoint=dashboard`, {
        method: 'GET',
      });

      if (response.success && response.data) {
        // Map the API response to our DashboardData interface
        const apiData = response.data;
        
        // Handle email field which can be a string or object
        const displayEmail = this.formatEmailForDisplay(apiData.customer_info?.email);
        
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
            packages: Array.isArray(apiData.customer_info?.packages) ? apiData.customer_info.packages : [],
            total_subscription_amount: Number(apiData.customer_info?.total_subscription_amount || 0),
          },
          customer: {
            customer_number: apiData.customer_info?.id || '',
            name: apiData.customer_info?.name || '',
            email: displayEmail,
            package_name: apiData.customer_info?.package_name || apiData.service_status?.subscription_plan || '',
            package_speed: `${apiData.service_status?.download_speed_mbps || 0}/${apiData.service_status?.upload_speed_mbps || 0}MBPS`,
            status: apiData.customer_info?.status || '',
            account_type: apiData.customer_info?.account_type || '',
            status_reason: apiData.customer_info?.status_reason || null,
            balance: parseFloat(apiData.billing_summary?.current_balance || '0'),
            service_type: apiData.customer_info?.service_type || '',
            customerid: apiData.customer_info?.customerid || 0
          },
          usage: {
            current_month: {
              download_gb: apiData.usage_summary?.download_gb || 0,
              upload_gb: apiData.usage_summary?.upload_gb || 0,
              total_gb: apiData.usage_summary?.total_gb || 0,
              period: apiData.usage_summary?.period || 'Current Month'
            },
            package_details: {
              name: apiData.customer_info?.package_name || apiData.service_status?.subscription_plan || '',
              speed: apiData.service_status?.plan || `${apiData.service_status?.download_speed_mbps || 0}/${apiData.service_status?.upload_speed_mbps || 0}MBPS`,
              limit_gb: apiData.service_status?.limit_gb_numeric || 0,
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
          active_tickets: apiData.maintenance?.recent_tickets || [],
        };

        const result: ApiResponse<DashboardData> = {
          success: true,
          message: 'Dashboard data loaded',
          data: dashboardData,
          timestamp: new Date().toISOString()
        };
        return await this.cacheSuccessfulResponse('dashboard', result, accountScope);
      } else {
        return {
          success: false,
          message: response.message || 'Failed to fetch dashboard data',
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      const cached = await this.cachedFallback<DashboardData>('dashboard', error, accountScope);
      if (cached) return cached;
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
    if (!usage) {
      return {
        download: '0.00 GB',
        upload: '0.00 GB',
        total: '0.00 GB',
        formattedTotal: '0.00 GB'
      };
    }

    return {
      download: `${usage.download_gb?.toFixed(2) || '0.00'} GB`,
      upload: `${usage.upload_gb?.toFixed(2) || '0.00'} GB`,
      total: `${usage.total_gb?.toFixed(2) || '0.00'} GB`,
      formattedTotal: usage.formatted_total || `${usage.total_gb?.toFixed(2) || '0.00'} GB`
    };
  }

  formatSpeedForDisplay(packageDetails: any) {
    if (!packageDetails) {
      return 'N/A';
    }

    if (packageDetails.download_speed_mbps && packageDetails.upload_speed_mbps) {
      return `${packageDetails.download_speed_mbps}/${packageDetails.upload_speed_mbps}MBPS`;
    }
    return packageDetails.speed || 'N/A';
  }

  formatSubscriptionLimit(packageDetails: any) {
    if (!packageDetails) {
      return 'N/A';
    }

    if (packageDetails.is_uncapped) {
      return 'Unlimited';
    }
    return packageDetails.subscription_limit || `${packageDetails.limit_gb} GB`;
  }
  // Outages
  async getOutages(): Promise<ApiResponse<OutagesResponse>> {
    return this.makeRequest<OutagesResponse>('/mobile-api.php?endpoint=outages');
  }

  async getOutageNotifications(): Promise<ApiResponse<any>> {
    return this.makeRequest<any>('/mobile-api.php?endpoint=outage-notifications');
  }

  async getTowerNotifications(): Promise<ApiResponse<{ notifications: TowerNotification[]; count: number; enabled: boolean }>> {
    return this.makeRequest('/mobile-api.php?endpoint=tower-notifications');
  }

  async markTowerNotificationRead(ticketId: number): Promise<ApiResponse<{ ticket_id: number }>> {
    return this.makeRequest('/mobile-api.php?endpoint=mark-tower-notification-read', {
      method: 'POST',
      body: JSON.stringify({ ticket_id: ticketId }),
    });
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

  async logout(): Promise<void> {
    await this.makeRequest('/auth.php?action=logout', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  // Report Issue (Support)
  async reportIssue(issueData: ReportIssueRequest): Promise<ApiResponse<ReportIssueResponse>> {
    return this.makeRequest<ReportIssueResponse>('/mobile-api.php?endpoint=report-issue', {
      method: 'POST',
      body: JSON.stringify(issueData),
    });
  }

  async getSupportIssueQuota(): Promise<ApiResponse<SupportIssueQuota>> {
    return this.makeRequest<SupportIssueQuota>('/mobile-api.php?endpoint=support-issue-quota', {
      method: 'GET',
    });
  }

  // =====================================================
  // CHAT SUPPORT METHODS (NEW)
  // =====================================================
  
  /**
   * Get chat support settings
   */
  async getChatSettings(): Promise<ApiResponse<ChatSettings>> {
    return this.makeRequest<ChatSettings>('/mobile-api.php?endpoint=chat-settings', {
      method: 'GET',
    });
  }

  /**
   * Get all user tickets (conversations)
   */
  async getChatTickets(): Promise<ApiResponse<{ tickets: SupportTicket[] }>> {
    return this.makeRequest<{ tickets: SupportTicket[] }>('/mobile-api.php?endpoint=chat-tickets', {
      method: 'GET',
    });
  }

  /**
   * Create new support ticket (start conversation)
   */
  async createChatTicket(data: CreateChatTicketRequest): Promise<ApiResponse<{ ticket: SupportTicket }>> {
    return this.makeRequest<{ ticket: SupportTicket }>('/mobile-api.php?endpoint=chat-create-ticket', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Get ticket conversation (all messages)
   */
  async getChatTicketMessages(ticketId: number, options?: { limit?: number; beforeMessageId?: number | null }): Promise<ApiResponse<TicketConversation>> {
    const safeLimit = Math.max(10, Math.min(200, Math.floor(options?.limit ?? 25)));
    const beforeMessageId = options?.beforeMessageId && options.beforeMessageId > 0
      ? `&before_message_id=${Math.floor(options.beforeMessageId)}`
      : '';
    return this.makeRequest<TicketConversation>(`/mobile-api.php?endpoint=chat-messages&ticket_id=${ticketId}&limit=${safeLimit}${beforeMessageId}`, {
      method: 'GET',
    });
  }

  /**
   * Send message to ticket
   */
  async sendChatMessage(data: SendMessageRequest): Promise<ApiResponse<{ message_id: number; created_at: string }>> {
    return this.makeRequest<{ message_id: number; created_at: string }>('/mobile-api.php?endpoint=chat-send-message', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Edit authored message within allowed window
   */
  async updateChatMessage(ticketId: number, messageId: number, message: string): Promise<ApiResponse<{ message_id: number; message: string }>> {
    return this.makeRequest<{ message_id: number; message: string }>('/mobile-api.php?endpoint=chat-edit-message', {
      method: 'POST',
      body: JSON.stringify({
        ticket_id: ticketId,
        message_id: messageId,
        message,
      }),
    });
  }

  /**
   * Delete an authored message from ticket
   */
  async deleteChatMessage(ticketId: number, messageId: number): Promise<ApiResponse<{ message_id: number }>> {
    return this.makeRequest<{ message_id: number }>('/mobile-api.php?endpoint=chat-delete-message', {
      method: 'POST',
      body: JSON.stringify({
        ticket_id: ticketId,
        message_id: messageId,
      }),
    });
  }

  /**
   * Add or remove reaction on a ticket message
   */
  async reactChatMessage(ticketId: number, messageId: number, reaction: string): Promise<ApiResponse<{ message_id: number; reaction: string | null }>> {
    return this.makeRequest<{ message_id: number; reaction: string | null }>('/mobile-api.php?endpoint=chat-react-message', {
      method: 'POST',
      body: JSON.stringify({
        ticket_id: ticketId,
        message_id: messageId,
        reaction,
      }),
    });
  }

  /**
   * Upload file attachment to ticket
   */
  async uploadChatAttachment(ticketId: number, fileUri: string, fileName: string, messageText?: string): Promise<ApiResponse<{ attachment: TicketAttachment; message_id?: number }>> {
    try {
      const extension = fileName.split('.').pop()?.toLowerCase() || '';
      let mimeType = 'application/octet-stream';
      if (extension === 'pdf') {
        mimeType = 'application/pdf';
      } else if (extension === 'png') {
        mimeType = 'image/png';
      } else if (extension === 'jpg' || extension === 'jpeg') {
        mimeType = 'image/jpeg';
      }

      const uploadResponse = await uploadAsync(`${API_BASE_URL}/mobile-api.php?endpoint=chat-upload`, fileUri, {
        httpMethod: 'POST',
        uploadType: FileSystemUploadType.MULTIPART,
        fieldName: 'file',
        mimeType,
        parameters: {
          ticket_id: ticketId.toString(),
          message: (messageText || '').trim(),
        },
        headers: {
          ...(this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {}),
        },
      });

      const data = JSON.parse(uploadResponse.body) as ApiResponse<{ attachment: TicketAttachment; message_id?: number }>;
      return data;
    } catch (error) {
      console.error('Upload failed:', error);
      throw error;
    }
  }

  /**
   * Close/resolve ticket
   */
  async closeChatTicket(ticketId: number): Promise<ApiResponse<null>> {
    return this.makeRequest<null>('/mobile-api.php?endpoint=chat-close-ticket', {
      method: 'POST',
      body: JSON.stringify({ ticket_id: ticketId }),
    });
  }

  /**
   * Update typing indicator
   */
  async updateTypingIndicator(ticketId: number): Promise<ApiResponse<{ success: boolean }>> {
    return this.makeRequest<{ success: boolean }>('/support-chat-api.php?action=update_typing', {
      method: 'POST',
      body: JSON.stringify({ ticket_id: ticketId }),
    });
  }

  /**
   * Get typing indicators for a ticket
   */
  async getTypingIndicator(ticketId: number, userType: string): Promise<ApiResponse<{ typing: any[] }>> {
    return this.makeRequest<{ typing: any[] }>(`/support-chat-api.php?action=get_typing&ticket_id=${ticketId}&user_type=${userType}`);
  }

  /**
   * Submit ticket rating
   */
  async submitTicketRating(data: { ticket_id: number; rating: number; feedback: string | null }): Promise<ApiResponse<{ rating_id: number; rating: number }>> {
    return this.makeRequest<{ rating_id: number; rating: number }>('/support-chat-api.php?action=submit_rating', {
      method: 'POST',
      body: JSON.stringify({ ticket_id: data.ticket_id, rating: data.rating, feedback: data.feedback }),
    });
  }

  /**
   * Get ticket rating
   */
  async getTicketRating(ticketId: number): Promise<ApiResponse<{ rating: any | null }>> {
    return this.makeRequest<{ rating: any | null }>(`/support-chat-api.php?action=get_rating&ticket_id=${ticketId}`);
  }

  // Account Linking Methods
  async requestAccountLink(targetInvoicingId: string): Promise<ApiResponse<any>> {
    return this.makeRequest<any>('/mobile-api.php?endpoint=account-link-request', {
      method: 'POST',
      body: JSON.stringify({ target_invoicing_id: targetInvoicingId }),
    });
  }

  async sendAccountLinkOTP(targetInvoicingId: string, selectedEmail: string, targetAccount?: { name?: string; customer_id?: string | number }): Promise<ApiResponse<any>> {
    return this.makeRequest<any>('/mobile-api.php?endpoint=account-link-send-otp', {
      method: 'POST',
      body: JSON.stringify({ 
        target_invoicing_id: targetInvoicingId,
        selected_email: selectedEmail,
        customer_name: targetAccount?.name ?? '',
        customer_id: targetAccount?.customer_id ?? ''
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
      body: JSON.stringify({ linked_user_id: targetUserId }),
    });
  }

  // Payment Methods (used by BillingScreen)
  async getPaymentInfo(): Promise<ApiResponse<{ enabled: boolean; provider: 'yoco' }>> {
    const response = await this.getAppConfig();
    return {
      ...response,
      data: response.data
        ? { enabled: response.data.payments_enabled, provider: response.data.payment_provider }
        : undefined,
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
    return this.makeRequest(`/mobile-api.php?endpoint=yoco-payment-status&payment_reference=${encodeURIComponent(paymentReference)}`, {
      method: 'GET',
    });
  }

  async getYocoPaymentHistory(limit: number = 10): Promise<ApiResponse<{
    payments: Array<{
      invoice_reference: string;
      amount: number;
      status: string;
      created_at: string;
      paid_at: string | null;
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
      body: JSON.stringify({}),
    });
  }

  async trackAdView(adId: number): Promise<ApiResponse<{ message: string }>> {
    return this.makeRequest(`/admin-api.php/ads/${adId}/view`, {
      method: 'POST',
      body: JSON.stringify({}),
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
        const uploadResult = await uploadAsync(url, data.confirmation_file.uri, {
          httpMethod: 'POST',
          uploadType: FileSystemUploadType.MULTIPART,
          fieldName: 'confirmation_file',
          parameters: formFields,
          headers: this.authToken ? {
            'Authorization': `Bearer ${this.authToken}`,
          } : {},
        });
        
        if (uploadResult.status !== 200) {
          throw new Error(`Server returned status ${uploadResult.status}`);
        }
        
        result = JSON.parse(uploadResult.body);
      } else {
        // Submit without file using regular fetch
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
        if (!response.ok) {
          throw new Error(`Server returned status ${response.status}`);
        }
        
        result = JSON.parse(responseText);
      }

      if (!result.success) {
        throw new Error(result.message || 'Failed to submit debit order application');
      }

      return true;
      
    } catch (error) {
      console.error('Submit debit order error:', error);
      throw error;
    }
  }
}

export const apiService = new ApiService();
