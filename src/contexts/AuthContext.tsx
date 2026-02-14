import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Device from 'expo-device';
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

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'user_data';
const LINKED_ACCOUNTS_KEY = 'linked_accounts';
const CURRENT_ACCOUNT_KEY = 'current_account';

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [linkedAccounts, setLinkedAccounts] = useState<any[]>([]);
  const [currentAccount, setCurrentAccount] = useState<any | null>(null);

  const isAuthenticated = !!user;

  const clearStoredAuth = async () => {
    try {
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

  // Load stored authentication data on app start
  useEffect(() => {
    loadStoredAuth();
    
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
    try {
      const [token, userData] = await Promise.all([
        SecureStore.getItemAsync(TOKEN_KEY),
        AsyncStorage.getItem(USER_KEY)
      ]);

      console.log('Loading stored auth:', {
        hasToken: !!token,
        tokenLength: token?.length,
        hasUserData: !!userData
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
    try {
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

  const refreshUser = async () => {
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

  const loadLinkedAccounts = async () => {
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
