import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import { Platform } from 'react-native';
import { User } from '../types/api';
import { apiService } from '../services/api';
import PushNotificationService from '../services/PushNotificationService';

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
    const androidId = Application.androidId;
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
    
    console.log('🔐 Auth storage initialized for device:', {
      deviceId: DEVICE_ID,
      deviceName: Device.deviceName,
      modelName: Device.modelName,
      osName: Device.osName,
      platform: Platform.OS
    });
  }
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [linkedAccounts, setLinkedAccounts] = useState<any[]>([]);
  const [currentAccount, setCurrentAccount] = useState<any | null>(null);

  const isAuthenticated = !!user;

  const clearStoredAuth = async () => {
    try {
      await initializeStorageKeys();
      await Promise.all([
        SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {}), // Ignore errors if keys don't exist
        AsyncStorage.removeItem(USER_KEY).catch(() => {}),
      ]);
      apiService.setAuthToken(null);
      setUser(null);
    } catch (error) {
      console.error('Error clearing stored auth:', error);
    }
  };

  const logout = async () => {
    try {
      await initializeStorageKeys();
      console.log('🔴 Logging out - clearing all cached data');
      
      // Clear stored authentication data
      await Promise.all([
        SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {}),
        AsyncStorage.removeItem(USER_KEY).catch(() => {}),
        // Clear any potential cached user-specific data
        AsyncStorage.removeItem('dashboard_data').catch(() => {}),
        AsyncStorage.removeItem('billing_data').catch(() => {}),
        AsyncStorage.removeItem('usage_data').catch(() => {}),
        AsyncStorage.removeItem('cached_customer_data').catch(() => {})
      ]);
      
      // Reset state
      setUser(null);
      setIsLoading(false);
      
      // Clear API service token
      apiService.setAuthToken(null);
      
      console.log('✅ Logout complete - all data cleared');
    } catch (error) {
      console.error('Logout error:', error);
      // Even if there's an error, reset the state
      setUser(null);
      setIsLoading(false);
      apiService.setAuthToken(null);
    }
  };

  // Migrate old storage to device-specific storage (one-time migration)
  const migrateOldStorage = async () => {
    try {
      await initializeStorageKeys();
      console.log('🔄 Checking for old storage to migrate...');
      
      // Check if old storage exists (without device ID)
      const [oldToken, oldUserData, oldLinkedAccounts, oldCurrentAccount] = await Promise.all([
        SecureStore.getItemAsync('auth_token').catch(() => null),
        AsyncStorage.getItem('user_data').catch(() => null),
        AsyncStorage.getItem('linked_accounts').catch(() => null),
        AsyncStorage.getItem('current_account').catch(() => null)
      ]);

      // If old storage exists, migrate to device-specific keys
      if (oldToken || oldUserData || oldLinkedAccounts || oldCurrentAccount) {
        console.log('📦 Migrating old storage to device-specific keys...');
        
        // Check if device-specific storage already exists
        const [newToken, newUserData] = await Promise.all([
          SecureStore.getItemAsync(TOKEN_KEY).catch(() => null),
          AsyncStorage.getItem(USER_KEY).catch(() => null)
        ]);

        // Only migrate if device-specific storage is empty (first launch after update)
        if (!newToken && !newUserData) {
          const migrationPromises = [];
          
          if (oldToken) {
            migrationPromises.push(SecureStore.setItemAsync(TOKEN_KEY, oldToken));
          }
          if (oldUserData) {
            migrationPromises.push(AsyncStorage.setItem(USER_KEY, oldUserData));
          }
          if (oldLinkedAccounts) {
            migrationPromises.push(AsyncStorage.setItem(LINKED_ACCOUNTS_KEY, oldLinkedAccounts));
          }
          if (oldCurrentAccount) {
            migrationPromises.push(AsyncStorage.setItem(CURRENT_ACCOUNT_KEY, oldCurrentAccount));
          }
          
          await Promise.all(migrationPromises);
          console.log('✅ Migration complete - data copied to device-specific storage');
        } else {
          console.log('⏭️ Device-specific storage already exists, skipping migration');
        }

        // CRITICAL: Delete old storage to prevent cloud sync conflicts
        console.log('🧹 Cleaning up old non-device-specific storage...');
        await Promise.all([
          SecureStore.deleteItemAsync('auth_token').catch(() => {}),
          AsyncStorage.removeItem('user_data').catch(() => {}),
          AsyncStorage.removeItem('linked_accounts').catch(() => {}),
          AsyncStorage.removeItem('current_account').catch(() => {})
        ]);
        console.log('✅ Old storage cleaned up');
      } else {
        console.log('✅ No old storage found - using device-specific storage');
      }
    } catch (error) {
      console.error('⚠️ Migration error (will use device-specific storage):', error);
    }
  };

  // Load stored authentication data on app start
  useEffect(() => {
    // First migrate old storage, then load auth
    migrateOldStorage().then(() => {
      loadStoredAuth();
    });
    
    // Set up auth failure callback for automatic logout on token expiration
    apiService.setAuthFailureCallback(() => {
      console.log('🔴 Auth failure detected, logging out automatically');
      logout();
    });

    // Cleanup callback on unmount
    return () => {
      apiService.setAuthFailureCallback(null);
    };
  }, []);

  const loadStoredAuth = async () => {
    trawait initializeStorageKeys();
      y {
      const [token, userData] = await Promise.all([
        SecureStore.getItemAsync(TOKEN_KEY),
        AsyncStorage.getItem(USER_KEY)
      ]);

      console.log('Loading stored auth:', {
        hasToken: !!token,
        tokenLength: token?.length,
        hasUserData: !!userData,
        deviceId: DEVICE_ID
      });

      if (token && userData) {
        const parsedUser = JSON.parse(userData);
        
        // Set the token first so we can make the validation request
        apiService.setAuthToken(token);
        
        // Validate the token by trying to get current user
        try {
          const response = await apiService.getCurrentUser();
          
          if (response.success && response.data) {
            // Token is valid, set user state
            setUser(response.data);
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
          console.log('Token validation failed, clearing auth:', validationError);
          await clearStoredAuth();
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
    trawait initializeStorageKeys();
      y {
      // Gather device information
      const deviceInfo = {
        deviceName: Device.deviceName || undefined,
        deviceModel: Device.modelName || undefined,
        osName: Platform.OS === 'ios' ? 'iOS' : 'Android',
        osVersion: Platform.Version?.toString() || undefined,
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
        
        console.log('Login successful:', {
          hasToken: !!token,
          tokenLength: token?.length,
          userEmail: userData.email,
          accountsCount: accounts?.length || 0
        });
        
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

  consawait initializeStorageKeys();
      t refreshUser = async () => {
    try {
      const response = await apiService.getCurrentUser();
      
      if (response.success && response.data) {
        setUser(response.data);
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(response.data));
      }
    } catch (error) {
      console.error('Refresh user error:', error);
      // If refresh fails, logout user
      await logout();
    }
  };

  consawait initializeStorageKeys();
      t loadLinkedAccounts = async () => {
    try {
      const response = await apiService.getLinkedAccounts();
      
      if (response.success && response.data) {
        const accounts = response.data.accounts || [];
        setLinkedAccounts(accounts);
        await AsyncStorage.setItem(LINKED_ACCOUNTS_KEY, JSON.stringify(accounts));
      }
    } catch (error) {
      console.error('Load linked accounts error:', error);
    }
  };

  const switchToAccount = async (accountId: number) => {
    try {
      await initializeStorageKeys();
      console.log('🔄 Switching account - clearing cached data for account:', accountId);
      
      // Clear all cached data before switching
      await Promise.all([
        AsyncStorage.removeItem('dashboard_data').catch(() => {}),
        AsyncStorage.removeItem('billing_data').catch(() => {}),
        AsyncStorage.removeItem('usage_data').catch(() => {}),
        AsyncStorage.removeItem('cached_customer_data').catch(() => {}),
        AsyncStorage.removeItem('cached_profile_data').catch(() => {}),
        AsyncStorage.removeItem('cached_service_data').catch(() => {}),
      ]);
      
      const response = await apiService.switchAccount(accountId);
      
      if (response.success && response.data) {
        const { token, user: userData, switched_to } = response.data;
        
        // CRITICAL: Store the new token for the switched account
        // This ensures each account has its own isolated session
        if (token) {
          await SecureStore.setItemAsync(TOKEN_KEY, token);
          apiService.setAuthToken(token);
          console.log('✅ New token stored for switched account');
        }
        
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
