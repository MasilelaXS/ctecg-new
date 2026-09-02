import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import * as Location from 'expo-location';
import { AppState, Platform } from 'react-native';
import { User } from '../types/api';
import { apiService } from '../services/api';
import { isApiError } from '../services/ApiError';
import PushNotificationService from '../services/PushNotificationService';

const getLoginLocation = async () => {
  try {
    let permission = await Location.getForegroundPermissionsAsync();
    if (permission.status === Location.PermissionStatus.UNDETERMINED && permission.canAskAgain) {
      permission = await Location.requestForegroundPermissionsAsync();
    }

    if (permission.status !== Location.PermissionStatus.GRANTED) {
      return {
        permissionStatus: permission.status,
        source: 'unavailable' as const,
      };
    }

    const location = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
    ]);

    if (!location) {
      return { permissionStatus: permission.status, source: 'timeout' as const };
    }

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracyMeters: location.coords.accuracy ?? undefined,
      capturedAt: new Date(location.timestamp).toISOString(),
      permissionStatus: permission.status,
      source: 'device_gps' as const,
    };
  } catch {
    return { permissionStatus: 'error', source: 'unavailable' as const };
  }
};

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  linkedAccounts: any[];
  currentAccount: any | null;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  loadLinkedAccounts: () => Promise<void>;
  switchToAccount: (accountId: number) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

// Get device-specific identifier to prevent iCloud/Google sync conflicts
const getDeviceId = async (): Promise<string> => {
  // For Android, use androidId which is unique per device per app install
  // For iOS, use identifierForVendor which is unique per device per vendor
  if (Platform.OS === 'android') {
    const androidId = await Application.getAndroidId();
    if (androidId) {
      return androidId;
    }
  } else if (Platform.OS === 'ios') {
    const iosId = await Application.getIosIdForVendorAsync();
    if (iosId) {
      return iosId;
    }
  }
  
  // Fallback: Generate a UUID and store it (will be unique for this app installation)
  const storedUuid = await AsyncStorage.getItem('device_uuid_persistent');
  if (storedUuid) {
    return storedUuid;
  }
  
  // Generate new UUID
  const newUuid = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  await AsyncStorage.setItem('device_uuid_persistent', newUuid);
  return newUuid;
};

// Storage keys will be initialized with device-specific ID
let TOKEN_KEY: string;
let USER_KEY: string;
let LINKED_ACCOUNTS_KEY: string;
let CURRENT_ACCOUNT_KEY: string;
let DEVICE_ID: string;

// Initialize device-specific storage keys
const initializeStorageKeys = async () => {
  if (!DEVICE_ID) {
    DEVICE_ID = await getDeviceId();
    TOKEN_KEY = `auth_token_${DEVICE_ID}`;
    USER_KEY = `user_data_${DEVICE_ID}`;
    LINKED_ACCOUNTS_KEY = `linked_accounts_${DEVICE_ID}`;
    CURRENT_ACCOUNT_KEY = `current_account_${DEVICE_ID}`;
    apiService.setAppIdentity(DEVICE_ID, Platform.OS === 'ios' ? 'ios' : 'android');
    
  }
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [linkedAccounts, setLinkedAccounts] = useState<any[]>([]);
  const [currentAccount, setCurrentAccount] = useState<any | null>(null);

  const isAuthenticated = !!user;

  useEffect(() => {
    if (!isAuthenticated) return;
    let requestInFlight = false;
    let stopped = false;
    let heartbeatDelayMs = 30_000;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const scheduleHeartbeat = () => {
      if (stopped || AppState.currentState !== 'active') return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        await sendHeartbeat();
        scheduleHeartbeat();
      }, heartbeatDelayMs);
    };

    const sendHeartbeat = async () => {
      if (stopped || AppState.currentState !== 'active' || requestInFlight) return;
      requestInFlight = true;
      try {
        const response = await apiService.heartbeat();
        const serverInterval = response.data?.heartbeat_interval_seconds;
        if (typeof serverInterval === 'number' && Number.isFinite(serverInterval) && serverInterval >= 15 && serverInterval <= 300) {
          heartbeatDelayMs = serverInterval * 1000;
        }
      } catch {
        // Presence is best effort and must never interrupt normal app use.
      } finally {
        requestInFlight = false;
      }
    };

    void sendHeartbeat().finally(scheduleHeartbeat);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void sendHeartbeat().finally(scheduleHeartbeat);
      } else if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    });

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      subscription.remove();
    };
  }, [isAuthenticated]);

  const clearStoredAuth = async () => {
    // Invalidate the in-memory session first. Navigation is derived from
    // `user`, so this must not wait for SecureStore or cache I/O.
    apiService.setAuthToken(null);
    apiService.setAccountScope(null);
    setUser(null);
    setLinkedAccounts([]);
    setCurrentAccount(null);
    setIsLoading(false);

    try {
      await initializeStorageKeys();
      const allKeys = await AsyncStorage.getAllKeys().catch(() => [] as string[]);
      const privateKeys = allKeys.filter((key) =>
        key === USER_KEY || key === LINKED_ACCOUNTS_KEY || key === CURRENT_ACCOUNT_KEY
        || key.startsWith('dashboard_data') || key.startsWith('billing_data')
        || key.startsWith('usage_data') || key.startsWith('cached_customer_data')
        || key.startsWith('cached_profile_data') || key.startsWith('cached_service_data')
        || key.startsWith('chat_reactions_')
      );
      await Promise.all([
        SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {}),
        AsyncStorage.multiRemove(privateKeys).catch(() => {}),
        apiService.clearCachedAccountData().catch(() => {}),
      ]);
    } catch (error) {
      console.error('Error clearing stored auth:', error);
      apiService.setAuthToken(null);
      apiService.setAccountScope(null);
    }
  };

  const logout = async () => {
    try {
      await initializeStorageKeys();
      try {
        await apiService.logout();
      } catch {
        // Local cleanup must still complete while offline.
      }
      await clearStoredAuth();
    } catch (error) {
      console.error('Logout error:', error);
      // Even if there's an error, reset the state
      setUser(null);
      setIsLoading(false);
      apiService.setAuthToken(null);
    }
  };

  // Load stored authentication data on app start
  useEffect(() => {
    void loadStoredAuth();
    
    // Set up auth failure callback for automatic logout on token expiration
    apiService.setAuthFailureCallback(() => {
      console.log('🔴 Auth failure detected, clearing local authentication');
      void clearStoredAuth();
    });

    // Cleanup callback on unmount
    return () => {
      apiService.setAuthFailureCallback(null);
    };
  }, []);

  const loadStoredAuth = async () => {
    try {
      await initializeStorageKeys();
      const [token, userData] = await Promise.all([
        SecureStore.getItemAsync(TOKEN_KEY),
        AsyncStorage.getItem(USER_KEY)
      ]);

      if (token && userData) {
        const parsedUser = JSON.parse(userData) as User;
        
        // Set the token first so we can make the validation request
        apiService.setAuthToken(token);
        apiService.setAccountScope(parsedUser.invoicingid || null);
        
        // Validate the token by trying to get current user
        try {
          const response = await apiService.getCurrentUser();
          
          if (response.success && response.data) {
            // Token is valid, set user state
            setUser(response.data);
            apiService.setAccountScope(response.data.invoicingid || null);
            // Update stored user data with fresh data
            await AsyncStorage.setItem(USER_KEY, JSON.stringify(response.data));
            console.log('Auth validated successfully for user:', response.data.invoicingid);
            // Ensure push token is registered on app start
            registerForPushNotifications();
          } else {
            // Token is invalid, clear stored auth
            console.log('Stored token is invalid, clearing auth');
            await clearStoredAuth();
          }
        } catch (validationError) {
          const temporaryFailure = isApiError(validationError)
            && (validationError.kind === 'network' || validationError.kind === 'timeout'
              || (validationError.status !== undefined && validationError.status >= 500));
          if (temporaryFailure) {
            // A server outage or lost connection must not invalidate a valid
            // local session. Protected API calls will still be authorized by
            // the backend when connectivity returns.
            setUser(parsedUser);
          } else {
            await clearStoredAuth();
          }
        }
      }
    } catch (error) {
      console.error('Error loading stored auth:', error);
      await clearStoredAuth();
    } finally {
      setIsLoading(false);
    }
  };

  // Register for push notifications and send token to server
  const registerForPushNotifications = async () => {
    try {
      const fcmToken = await PushNotificationService.registerForPushNotifications();
      
      if (fcmToken) {
        console.log('📱 FCM Token obtained, sending to server...');
        const response = await apiService.updateFcmToken(fcmToken);
        
        if (response.success) {
          console.log('✅ FCM token saved to server');
        } else {
          console.warn('⚠️ Failed to save FCM token:', response.message);
        }
      } else {
        console.log('📱 No FCM token obtained (possibly simulator or permission denied)');
      }
    } catch (error) {
      console.error('Push notification registration error:', error);
      // Don't throw - push notifications are not critical for app function
    }
  };

  const login = async (identifier: string, password: string) => {
    try {
      await initializeStorageKeys();
      // Location is optional security metadata. Authentication must continue if
      // permission is denied, GPS is unavailable, or acquisition times out.
      const securityLocation = await getLoginLocation();
      const deviceInfo = {
        deviceName: Device.deviceName || undefined,
        deviceModel: Device.modelName || undefined,
        osName: Platform.OS === 'ios' ? 'iOS' : 'Android',
        osVersion: Platform.Version?.toString() || undefined,
        location: securityLocation,
      };

      const response = await apiService.login(identifier, password, deviceInfo);
      
      if (response.success && response.data) {
        // Check if user needs to create a password
        if (response.data.requires_password_creation) {
          const error: any = new Error('Password creation required');
          error.requiresPasswordCreation = true;
          error.userId = response.data.user_id;
          error.email = response.data.email;
          throw error;
        }
        
        const { token, user: userData, accounts } = response.data;
        
        // Combine user data with accounts
        const userWithAccounts = {
          ...userData,
          accounts: accounts?.map(acc => ({
            ...acc,
            is_selected: acc.is_primary // Auto-select primary account
          })) || []
        };
        
        // Store token securely and user data
        await Promise.all([
          SecureStore.setItemAsync(TOKEN_KEY, token),
          AsyncStorage.setItem(USER_KEY, JSON.stringify(userWithAccounts))
        ]);
        
        setUser(userWithAccounts);
        apiService.setAuthToken(token);
        apiService.setAccountScope(
          userWithAccounts.invoicingid
          || accounts?.find((account) => account.is_primary)?.client_code
          || identifier,
        );
        
        // Register for push notifications after successful login
        registerForPushNotifications();
      } else {
        throw new Error(response.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      
      // Pass through error with additional context
      if (error && typeof error === 'object') {
        const err = error as any;
        if (err.details?.requires_verification) {
          err.requiresVerification = true;
          err.userId = err.details.user_id;
          err.email = err.details.email;
          err.hasValidOTP = err.details.has_valid_otp;
        }
      }
      
      throw error;
    }
  };

  const refreshUser = async () => {
    try {
      await initializeStorageKeys();
      
      const response = await apiService.getCurrentUser();
      
      if (response.success && response.data) {
        console.log('✅ refreshUser - Got user data:', {
          userId: response.data.id,
          invoicingId: response.data.invoicingid,
          deviceId: DEVICE_ID
        });
        setUser(response.data);
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(response.data));
      }
    } catch (error) {
      console.error('Refresh user error:', error);
      // If refresh fails, logout user
      await logout();
    }
  };

  const loadLinkedAccounts = async () => {
    try {
      await initializeStorageKeys();
      const response = await apiService.getLinkedAccounts();
      
      if (response.success && response.data) {
        const accounts = response.data.accounts || [];
        setLinkedAccounts(accounts);
        await AsyncStorage.setItem(LINKED_ACCOUNTS_KEY, JSON.stringify(accounts));
      }
    } catch (error) {
      // A 401 is handled centrally and immediately returns the app to Login.
      // Do not present it as a linked-account loading failure as well.
      if (!isApiError(error) || error.status !== 401) {
        console.error('Load linked accounts error:', error);
      }
    }
  };

  const switchToAccount = async (accountId: number) => {
    try {
      await initializeStorageKeys();
      const response = await apiService.switchAccount(accountId);
      
      if (response.success && response.data) {
        const { token, user: userData, switched_to } = response.data;
        
        // CRITICAL: Store the new token for the switched account
        // This ensures each account has its own isolated session
        if (token) {
          await SecureStore.setItemAsync(TOKEN_KEY, token);
          apiService.setAuthToken(token);
          console.log('✅ New token stored for switched account');
          // Move this live session to the newly selected account immediately;
          // do not leave the previous account online until the next timer tick.
          await apiService.heartbeat().catch(() => {
            // The regular foreground heartbeat will retry without making a
            // successful account switch appear to fail.
          });
        }
        apiService.setAccountScope(
          userData.invoicingid || switched_to?.invoicing_id || switched_to?.client_code || null,
        );
        
        // Update user data with switched account
        setUser(userData);
        setCurrentAccount(switched_to);
        
        await Promise.all([
          AsyncStorage.setItem(USER_KEY, JSON.stringify(userData)),
          AsyncStorage.setItem(CURRENT_ACCOUNT_KEY, JSON.stringify(switched_to))
        ]);
        
        // Refresh linked accounts with new token
        await loadLinkedAccounts();
        
        console.log('✅ Account switched successfully:', {
          userId: userData.id,
          invoicingId: userData.invoicingid,
          hasNewToken: !!token
        });
      }
    } catch (error) {
      console.error('Switch account error:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    linkedAccounts,
    currentAccount,
    login,
    logout,
    refreshUser,
    loadLinkedAccounts,
    switchToAccount,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}
