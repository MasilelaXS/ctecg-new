import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Modal,
  Pressable,
  Dimensions,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { Colors, Typography, Spacing } from '../constants/Design';

interface TopNavigationProps {
  title: string;
  subtitle?: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  showProfileDropdown?: boolean;
}

export default function TopNavigation({ 
  title, 
  subtitle, 
  showBackButton = false,
  onBackPress,
  showProfileDropdown: externalShowProfile = true
}: TopNavigationProps) {
  const { user, logout, linkedAccounts, switchToAccount, loadLinkedAccounts } = useAuth();
  const navigation = useNavigation();
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showSpeedTest, setShowSpeedTest] = useState(false);
  const [speedTestLoading, setSpeedTestLoading] = useState(true);
  const insets = useSafeAreaInsets();

  React.useEffect(() => {
    if (user) {
      loadLinkedAccounts();
    }
  }, [user]);

  const handleLogout = () => {
    setShowProfileDropdown(false);
    logout();
  };

  const handleProfilePress = () => {
    setShowProfileDropdown(false);
    // Navigate to profile screen if needed
  };

  const handleFAQPress = () => {
    setShowProfileDropdown(false);
    navigation.navigate('FAQ' as never);
  };

  const handleSpeedTestPress = () => {
    setShowProfileDropdown(false);
    setShowSpeedTest(true);
  };

  const handleLinkAccountPress = () => {
    setShowProfileDropdown(false);
    navigation.navigate('LinkAccount' as never);
  };

  const handleSwitchAccount = async (account: any) => {
    setShowProfileDropdown(false);
    try {
      await switchToAccount(account.account_id);
    } catch (error: any) {
      console.error('Failed to switch account:', error);
    }
  };

  const otherAccounts = linkedAccounts.filter(
    (account: any) => account.client_code !== user?.invoicingid
  );

  // Helper function to mask email
  const maskEmail = (email: string | undefined) => {
    if (!email) return '';
    const [localPart, domain] = email.split('@');
    if (!domain) return email;
    const maskedLocal = localPart.charAt(0) + '***';
    const domainParts = domain.split('.');
    const maskedDomain = domainParts[0].charAt(0) + '***.' + domainParts.slice(1).join('.');
    return `${maskedLocal}@${maskedDomain}`;
  };

  // Get display name
  const getDisplayName = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user?.firstName) {
      return user.firstName;
    }
    return user?.invoicingid || 'Guest';
  };

  return (
    <>
      <SafeAreaView edges={['top']} style={styles.container}>
        <View style={styles.header}>
          {showBackButton && (
            <TouchableOpacity 
              style={styles.backButton}
              onPress={onBackPress}
            >
              <Ionicons name="arrow-back" size={24} color={Colors.text} />
            </TouchableOpacity>
          )}
          
          <View style={[styles.titleContainer, showBackButton && styles.titleWithBack]}>
            <Text style={styles.title}>{title}</Text>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
          
          <TouchableOpacity 
            style={styles.profileButton}
            onPress={() => setShowProfileDropdown(true)}
          >
            <View style={styles.profileIcon}>
              <Text style={styles.profileInitial}>
                {user?.firstName?.charAt(0) || user?.invoicingid?.charAt(0) || 'U'}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Profile Dropdown Modal */}
      <Modal
        visible={showProfileDropdown}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowProfileDropdown(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setShowProfileDropdown(false)}
        >
          <View style={[styles.dropdown, { marginTop: insets.top + 60 }]}>
            <View style={styles.userInfo}>
              <View style={styles.profileIconLarge}>
                <Text style={styles.profileInitialLarge}>
                  {user?.firstName?.charAt(0) || user?.invoicingid?.charAt(0) || 'U'}
                </Text>
              </View>
              <View style={styles.userDetails}>
                <Text style={styles.userName} numberOfLines={1}>
                  {getDisplayName()}
                </Text>
                <Text style={styles.userEmail} numberOfLines={1}>
                  {maskEmail(user?.email)}
                </Text>
                {/* Only show account ID if we're showing a name (not the invoicingid as display name) */}
                {user?.invoicingid && user?.firstName && (
                  <Text style={styles.userAccountId}>
                    {user.invoicingid}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.divider} />

            {/* Accounts Section */}
            {otherAccounts.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Ionicons name="people-outline" size={16} color={Colors.textSecondary} />
                  <Text style={styles.sectionHeaderText}>Switch Account</Text>
                </View>
                
                {otherAccounts.map((account: any, index: number) => (
                  <TouchableOpacity 
                    key={index}
                    style={styles.accountItem}
                    onPress={() => handleSwitchAccount(account)}
                  >
                    <View style={styles.accountItemContent}>
                      <Text style={styles.accountItemId}>{account.client_code}</Text>
                      <Text style={styles.accountItemName} numberOfLines={1}>
                        {account.account_name || account.customer_name}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                ))}
                
                <View style={styles.divider} />
              </>
            )}

            <TouchableOpacity 
              style={styles.dropdownItem}
              onPress={handleLinkAccountPress}
            >
              <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
              <Text style={[styles.dropdownItemText, { color: Colors.primary }]}>Add New Account</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity 
              style={styles.dropdownItem}
              onPress={handleFAQPress}
            >
              <Ionicons name="help-circle-outline" size={20} color={Colors.text} />
              <Text style={styles.dropdownItemText}>FAQ</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.dropdownItem}
              onPress={handleSpeedTestPress}
            >
              <Ionicons name="speedometer-outline" size={20} color={Colors.text} />
              <Text style={styles.dropdownItemText}>Speed Test</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.dropdownItem}
              onPress={handleLogout}
            >
              <Ionicons name="log-out-outline" size={20} color={Colors.error} />
              <Text style={[styles.dropdownItemText, { color: Colors.error }]}>
                Sign Out
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Speed Test WebView Modal */}
      <Modal
        visible={showSpeedTest}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSpeedTest(false)}
      >
        <View style={styles.speedTestContainer}>
          {/* Header */}
          <View style={styles.speedTestHeader}>
            <TouchableOpacity
              style={styles.speedTestCloseButton}
              onPress={() => setShowSpeedTest(false)}
            >
              <Ionicons name="close" size={28} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.speedTestTitle}>Speed Test</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Info Banner */}
          <View style={styles.speedTestBanner}>
            <Ionicons name="speedometer" size={20} color={Colors.primary} />
            <Text style={styles.speedTestBannerText}>
              Testing your CTECG line? Connect to your Wi‑Fi first.
            </Text>
          </View>

          {/* Loading Indicator */}
          {speedTestLoading && (
            <View style={styles.speedTestLoadingOverlay}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.speedTestLoadingText}>Loading speed test...</Text>
            </View>
          )}

          {/* WebView */}
          <WebView
            source={{ uri: 'https://wifiman.com/' }}
            style={styles.webView}
            onLoadStart={() => setSpeedTestLoading(true)}
            onLoadEnd={() => setSpeedTestLoading(false)}
            javaScriptEnabled={true}
            domStorageEnabled={true}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 60,
    backgroundColor: '#FFFFFF',
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: Typography.xl,
    fontWeight: Typography.weights.bold,
    color: '#1A1A1A',
  },
  subtitle: {
    fontSize: Typography.sm,
    color: '#666666',
    marginTop: 2,
  },
  profileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: 20,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  profileIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitial: {
    fontSize: Typography.md,
    fontWeight: Typography.weights.bold,
    color: 'white',
    textTransform: 'uppercase',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingRight: Spacing.md,
  },
  dropdown: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: Spacing.md,
    minWidth: 250,
    maxWidth: Dimensions.get('window').width - 32,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingBottom: Spacing.md,
  },
  profileIconLarge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitialLarge: {
    fontSize: Typography.lg,
    fontWeight: Typography.weights.bold,
    color: 'white',
    textTransform: 'uppercase',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: Typography.md,
    fontWeight: Typography.weights.semibold,
    color: Colors.text,
  },
  userEmail: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
    marginTop: 2,
  },
  userAccountId: {
    fontSize: Typography.xs,
    color: Colors.primary,
    fontWeight: Typography.weights.medium,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  sectionHeaderText: {
    fontSize: Typography.xs,
    fontWeight: Typography.weights.semibold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    marginBottom: Spacing.xs,
  },
  accountItemContent: {
    flex: 1,
  },
  accountItemId: {
    fontSize: Typography.sm,
    fontWeight: Typography.weights.bold,
    color: Colors.primary,
    marginBottom: 2,
  },
  accountItemName: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderRadius: 8,
  },
  dropdownItemText: {
    fontSize: Typography.md,
    color: Colors.text,
    flex: 1,
  },
  backButton: {
    padding: Spacing.xs,
    marginRight: Spacing.sm,
  },
  titleWithBack: {
    flex: 1,
  },
  speedTestContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  speedTestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  speedTestCloseButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedTestTitle: {
    fontSize: Typography.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
  },
  speedTestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    backgroundColor: '#FFF0F0',
    gap: Spacing.xs,
  },
  speedTestBannerText: {
    fontSize: Typography.sm,
    color: Colors.primary,
    fontWeight: '600',
  },
  speedTestLoadingOverlay: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    gap: Spacing.md,
  },
  speedTestLoadingText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
  webView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});
