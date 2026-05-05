import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import TopNavigation from '../components/TopNavigation';
import Card from '../components/Card';
import { showToast } from '../components/Toast';
import { Colors, Typography, CommonStyles, Spacing } from '../constants/Design';
import { apiService } from '../services/api';
import { ReportIssueRequest, SupportIssueQuota } from '../types/api';

interface PriorityOption {
  value: 'low' | 'medium' | 'high' | 'urgent';
  label: string;
  color: string;
  icon: string;
}

interface CategoryOption {
  value: string;
  label: string;
  icon: string;
}

const PRIORITY_OPTIONS: PriorityOption[] = [
  { value: 'low', label: 'Low', color: Colors.success, icon: 'checkmark-circle' },
  { value: 'medium', label: 'Medium', color: Colors.warning, icon: 'information-circle' },
  { value: 'high', label: 'High', color: Colors.error, icon: 'alert-circle' },
  { value: 'urgent', label: 'Urgent', color: '#FF4444', icon: 'warning' },
];

const CATEGORY_OPTIONS: CategoryOption[] = [
  { value: 'Technical Support', label: 'Technical Support', icon: 'build' },
  { value: 'Billing Inquiry', label: 'Billing Inquiry', icon: 'card' },
  { value: 'Service Outage', label: 'Service Outage', icon: 'wifi' },
  { value: 'Account Issues', label: 'Account Issues', icon: 'person-circle' },
  { value: 'General Inquiry', label: 'General Inquiry', icon: 'help-circle' },
  { value: 'Feature Request', label: 'Feature Request', icon: 'bulb' },
];

interface SocialMediaItem {
  id: string;
  name: string;
  icon: string;
  color: string;
  url: string;
}

const SOCIAL_MEDIA: SocialMediaItem[] = [
  { id: 'facebook', name: 'Facebook', icon: 'facebook', color: '#1877F2', url: 'https://www.facebook.com/ctecg' },
  { id: 'instagram', name: 'Instagram', icon: 'instagram', color: '#E4405F', url: 'https://www.instagram.com/ctecg_internet/' },
  { id: 'telegram', name: 'Telegram', icon: 'telegram-plane', color: '#0088CC', url: 'https://t.me/joinchat/AAAAAFk4fEjDkzEDZmezUQ' },
  { id: 'twitter', name: 'X', icon: 'twitter', color: '#000000', url: 'https://x.com/CTECG1' },
  { id: 'whatsapp', name: 'WhatsApp', icon: 'whatsapp', color: '#25D366', url: 'https://wa.me/27769790642' },
  { id: 'website', name: 'Website', icon: 'globe', color: Colors.primary, url: 'http://www.ctecg.co.za' },
];

export default function SupportScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [category, setCategory] = useState('Technical Support');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [issueQuota, setIssueQuota] = useState<SupportIssueQuota | null>(null);
  const [isQuotaLoading, setIsQuotaLoading] = useState(false);

  const handleSocialPress = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.error('Failed to open URL:', error);
      showToast.error('Error', 'Unable to open this link');
    }
  };

  const loadIssueQuota = async () => {
    setIsQuotaLoading(true);
    try {
      const response = await apiService.getSupportIssueQuota();
      if (response.success && response.data) {
        setIssueQuota(response.data);
      }
    } catch (error) {
      console.error('Failed to load support issue quota:', error);
    } finally {
      setIsQuotaLoading(false);
    }
  };

  const handleChatSupport = () => {
    handleSocialPress('https://wa.me/27769790642');
  };

  useEffect(() => {
    loadIssueQuota();
  }, []);

  const handleSubmit = async () => {
    if (issueQuota?.limit_reached) {
      showToast.error('Limit reached', 'Daily email limit reached. Please chat to support.');
      return;
    }

    // Validation
    if (!message.trim()) {
      showToast.error('Error', 'Please describe your issue.');
      return;
    }

    setIsSubmitting(true);

    try {
      const issueData: ReportIssueRequest = {
        subject: `${user?.invoicingid || 'UNKNOWN'} - ${category}`, // Auto-generated subject
        message: message.trim(),
        priority,
        category,
      };

      const response = await apiService.reportIssue(issueData);

      if (response.success) {
        showToast.success('Success', 'Your issue has been reported successfully. Our support team will get back to you soon.');
        // Reset form
        setMessage('');
        setPriority('medium');
        setCategory('Technical Support');
        if (response.data?.quota) {
          setIssueQuota(response.data.quota);
        } else {
          loadIssueQuota();
        }
      } else {
        showToast.error('Error', response.message || 'Failed to submit your issue. Please try again.');
      }
    } catch (error) {
      const err: any = error;
      if (err?.code === 429 && err?.details?.daily_limit_reached) {
        setIssueQuota({
          daily_limit: err.details.daily_limit ?? 3,
          used_today: err.details.used_today ?? err.details.daily_limit ?? 3,
          remaining_today: 0,
          reset_at: err.details.reset_at ?? '',
          limit_reached: true
        });
        showToast.error('Limit reached', 'Daily email limit reached. Please chat to support.');
      } else {
        console.error('Error submitting issue:', error);
        showToast.error('Error', 'Failed to submit your issue. Please check your connection and try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <TopNavigation title="Customer Care" subtitle="Get help & contact us" />
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
      >
        {/* Social Media Section */}
        <View style={styles.socialSection}>
          <Text style={styles.socialTitle}>Connect With Us</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.socialScrollContent}
          >
            {SOCIAL_MEDIA.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.socialItem}
                onPress={() => handleSocialPress(item.url)}
                activeOpacity={0.7}
              >
                <View style={[styles.socialIconContainer, { borderColor: item.color }]}>
                  <FontAwesome5 name={item.icon} size={24} color={item.color} />
                </View>
                <Text style={styles.socialLabel} numberOfLines={1}>{item.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Contact Info Card */}
        <Card title="Contact Information">
          <View style={styles.contactInfo}>
            <View style={styles.contactItem}>
              <Ionicons name="mail" size={20} color={Colors.primary} />
              <Text style={styles.contactText}>helpdesk@ctecg.co.za</Text>
            </View>
            <View style={styles.contactItem}>
              <Ionicons name="call" size={20} color={Colors.primary} />
              <Text style={styles.contactText}>076 979 0642</Text>
            </View>
            <View style={styles.contactItem}>
              <Ionicons name="call" size={20} color={Colors.primary} />
              <Text style={styles.contactText}>013 262 4798</Text>
            </View>
            <View style={styles.contactItem}>
              <Ionicons name="time" size={20} color={Colors.primary} />
              <Text style={styles.contactText}>Mon-Fri: 8:00 AM - 5:00 PM</Text>
            </View>
          </View>
        </Card>

        {/* Report Issue Form */}
        <Card title="Report an Issue">
          <View style={styles.form}>
            {/* Category Selection */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionsContainer}>
                {CATEGORY_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.optionChip,
                      category === option.value && styles.selectedChip,
                    ]}
                    onPress={() => setCategory(option.value)}
                  >
                    <Ionicons 
                      name={option.icon as any} 
                      size={16} 
                      color={category === option.value ? Colors.surface : Colors.primary} 
                    />
                    <Text 
                      style={[
                        styles.optionText,
                        category === option.value && styles.selectedOptionText,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Priority Selection */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Priority</Text>
              <View style={styles.priorityContainer}>
                {PRIORITY_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.priorityOption,
                      priority === option.value && { backgroundColor: option.color + '20' },
                    ]}
                    onPress={() => setPriority(option.value)}
                  >
                    <Ionicons 
                      name={option.icon as any} 
                      size={20} 
                      color={option.color} 
                    />
                    <Text 
                      style={[
                        styles.priorityText,
                        { color: priority === option.value ? option.color : Colors.text },
                      ]}
                    >
                      {option.label}
                    </Text>
                    {priority === option.value && (
                      <Ionicons name="checkmark-circle" size={16} color={option.color} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Message Input */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Message</Text>
              <TextInput
                style={[styles.textInput, styles.messageInput]}
                value={message}
                onChangeText={setMessage}
                placeholder="Describe your issue in detail..."
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                maxLength={1000}
              />
              <Text style={styles.charCount}>{message.length}/1000</Text>
            </View>

            {issueQuota?.limit_reached && (
              <Text style={styles.limitNotice}>
                Daily limit reached. Please chat to support.
              </Text>
            )}

            {/* Submit Button */}
            {issueQuota?.limit_reached ? (
              <TouchableOpacity
                style={[styles.submitButton, styles.chatButton]}
                onPress={handleChatSupport}
              >
                <Ionicons name="logo-whatsapp" size={20} color={Colors.surface} />
                <Text style={styles.submitButtonText}>Chat to Support</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.submitButton, (isSubmitting || isQuotaLoading) && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={isSubmitting || isQuotaLoading}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={Colors.surface} size="small" />
                ) : (
                  <>
                    <Ionicons name="send" size={20} color={Colors.surface} />
                    <Text style={styles.submitButtonText}>Submit Issue</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </Card>

        {/* FAQ Link Card */}
        <Card title="Frequently Asked Questions">
          <View style={styles.faqLinkContainer}>
            <TouchableOpacity 
              style={styles.faqLinkButton}
              onPress={() => navigation.navigate('FAQ' as never)}
              activeOpacity={0.7}
            >
              <View style={styles.faqLinkContent}>
                <Ionicons name="help-circle" size={24} color={Colors.primary} />
                <View style={styles.faqLinkTextContainer}>
                  <Text style={styles.faqLinkTitle}>View All FAQs</Text>
                  <Text style={styles.faqLinkSubtitle}>
                    Find answers to common questions about our services, 
                    technical support, billing, and more.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
              </View>
            </TouchableOpacity>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    ...CommonStyles.safeArea,
  },
  scrollView: {
    flex: 1,
    padding: Spacing.md,
  },
  scrollViewContent: {
    paddingBottom: Spacing.xl * 2,
  },
  socialSection: {
    marginBottom: Spacing.lg,
  },
  socialTitle: {
    fontSize: Typography.sm,
    fontWeight: Typography.weights.semibold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: Typography.letterSpacing.wider,
    marginBottom: Spacing.md,
    marginLeft: Spacing.xs,
  },
  socialScrollContent: {
    paddingRight: Spacing.md,
    gap: Spacing.lg,
  },
  socialItem: {
    alignItems: 'center',
    width: 80,
  },
  socialIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.background,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
    borderColor: Colors.border,
  },
  socialLabel: {
    fontSize: Typography.xs,
    fontWeight: Typography.weights.medium,
    color: Colors.text,
    textAlign: 'center',
  },
  contactInfo: {
    gap: Spacing.md,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  contactText: {
    fontSize: Typography.md,
    color: Colors.text,
    flex: 1,
  },
  form: {
    gap: Spacing.lg,
  },
  formGroup: {
    gap: Spacing.sm,
  },
  label: {
    fontSize: Typography.md,
    fontWeight: Typography.weights.semibold,
    color: Colors.text,
  },
  optionsContainer: {
    marginTop: Spacing.xs,
  },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginRight: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.xs,
  },
  selectedChip: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  optionText: {
    fontSize: Typography.sm,
    color: Colors.text,
    fontWeight: Typography.weights.medium,
  },
  selectedOptionText: {
    color: Colors.surface,
  },
  priorityContainer: {
    gap: Spacing.sm,
  },
  priorityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  priorityText: {
    fontSize: Typography.md,
    fontWeight: Typography.weights.medium,
    flex: 1,
  },
  textInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: Spacing.md,
    fontSize: Typography.md,
    color: Colors.text,
    backgroundColor: Colors.surface,
    minHeight: 48,
  },
  messageInput: {
    height: 120,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
    textAlign: 'right',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    padding: Spacing.md,
    borderRadius: 12,
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  chatButton: {
    backgroundColor: '#25D366',
  },
  submitButtonDisabled: {
    backgroundColor: Colors.textMuted,
  },
  submitButtonText: {
    fontSize: Typography.md,
    fontWeight: Typography.weights.semibold,
    color: Colors.surface,
  },
  limitNotice: {
    fontSize: Typography.sm,
    color: Colors.error,
    textAlign: 'center',
  },
  faqLinkContainer: {
    padding: Spacing.sm,
  },
  faqLinkButton: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  faqLinkContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  faqLinkTextContainer: {
    flex: 1,
  },
  faqLinkTitle: {
    fontSize: Typography.md,
    fontWeight: Typography.weights.semibold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  faqLinkSubtitle: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  loadingText: {
    fontSize: Typography.md,
    color: Colors.textMuted,
    marginTop: Spacing.md,
  },
});
