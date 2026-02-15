import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';
import CustomButton from '../components/CustomButton';
import OnlineStatusIndicator from '../components/OnlineStatusIndicator';
import { showToast } from '../components/Toast';
import { Colors, Typography, CommonStyles, Spacing } from '../constants/Design';

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { user, logout, linkedAccounts, currentAccount, loadLinkedAccounts, switchToAccount } = useAuth();

  useEffect(() => {
    loadLinkedAccounts();
  }, []);

  const handleLogout = () => {
    logout();
  };

  const handleLinkAccount = () => {
    navigation.navigate('LinkAccount' as never);
  };

  const handleSwitchAccount = async (account: any) => {
    try {
      await switchToAccount(account.account_id);
      showToast.success('Success', `Switched to ${account.client_code}`);
    } catch (error: any) {
      showToast.error('Error', error.message || 'Failed to switch account');
    }
  };

  const isCurrentAccount = (account: any) => {
    return account.is_current || user?.invoicingid === account.client_code;
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Profile" subtitle="Manage your account" variant="primary" />
      
      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.userInfo}>
          <Text style={styles.userName}>
            {user?.firstName} {user?.lastName}
          </Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          <Text style={styles.userAccount}>{user?.invoicingid}</Text>
          <View style={styles.statusContainer}>
            <OnlineStatusIndicator size="medium" showText={true} autoRefresh={true} />
          </View>
        </View>

        {/* Linked Accounts Section */}
        {linkedAccounts && linkedAccounts.length > 0 && (
          <View style={styles.linkedAccountsSection}>
            <Text style={styles.sectionTitle}>Linked Accounts</Text>
            <Text style={styles.sectionSubtitle}>
              Switch between your linked accounts
            </Text>
            
            <View style={styles.accountsList}>
              {linkedAccounts.map((account, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.accountCard,
                    isCurrentAccount(account) && styles.accountCardActive
                  ]}
                  onPress={() => !isCurrentAccount(account) && handleSwitchAccount(account)}
                  disabled={isCurrentAccount(account)}
                >
                  <View style={styles.accountCardContent}>
                    <View style={styles.accountCardLeft}>
                      <Text style={[
                        styles.accountCardId,
                        isCurrentAccount(account) && styles.accountCardIdActive
                      ]}>
                        {account.client_code}
                      </Text>
                      <Text style={[
                        styles.accountCardName,
                        isCurrentAccount(account) && styles.accountCardNameActive
                      ]} numberOfLines={1}>
                        {account.account_name || account.customer_name || 'Account'}
                      </Text>
                    </View>
                    {isCurrentAccount(account) && (
                      <View style={styles.currentBadge}>
                        <Text style={styles.currentBadgeText}>Current</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Link New Account Button */}
        <CustomButton
          title="+ Link Another Account"
          onPress={handleLinkAccount}
          variant="outline"
          size="large"
          style={styles.linkButton}
        />
        
        <CustomButton
          title="Sign Out"
          onPress={handleLogout}
          variant="outline"
          size="large"
          style={styles.logoutButton}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    ...CommonStyles.safeArea,
  },
  content: {
    flex: 1,
    padding: Spacing.md,
  },
  contentContainer: {
    paddingBottom: Spacing.xl * 2,
  },
  userInfo: {
    alignItems: 'center',
    marginVertical: Spacing.xl,
  },
  userName: {
    fontSize: Typography.xl,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  userEmail: {
    fontSize: Typography.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  userAccount: {
    fontSize: Typography.md,
    color: Colors.primary,
    fontWeight: Typography.weights.semibold,
  },
  statusContainer: {
    marginTop: Spacing.md,
  },
  linkedAccountsSection: {
    marginVertical: Spacing.lg,
  },
  sectionTitle: {
    fontSize: Typography.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  sectionSubtitle: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  accountsList: {
    marginBottom: Spacing.md,
  },
  accountCard: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  accountCardActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  accountCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accountCardLeft: {
    flex: 1,
  },
  accountCardId: {
    fontSize: Typography.md,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  accountCardIdActive: {
    color: Colors.white,
  },
  accountCardName: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
  accountCardNameActive: {
    color: Colors.white,
    opacity: 0.9,
  },
  currentBadge: {
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 12,
  },
  currentBadgeText: {
    fontSize: Typography.xs,
    fontWeight: Typography.weights.semibold,
    color: Colors.primary,
  },
  linkButton: {
    marginBottom: Spacing.md,
  },
  logoutButton: {
    marginTop: Spacing.md,
  },
});
