import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import TopNavigation from '../components/TopNavigation';
import { Colors, Typography, Spacing } from '../constants/Design';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

const faqData: FAQItem[] = [
  {
    id: '1',
    question: 'How do I check my data usage?',
    answer: 'You can check your data usage in real-time through the Usage tab in the app. We provide detailed breakdowns of your daily, weekly, and monthly usage including upload and download statistics. For uncapped packages, you can monitor your usage patterns and trends.'
  },
  {
    id: '2',
    question: 'What payment methods do you accept?',
    answer: 'We accept various payment methods including:\n• Bank transfers (EFT)\n• Direct debit orders\n• Cash deposits at our office\n• Online banking payments\n• Debit orders\n\nFor bank transfers, use your account number as the payment reference.'
  },
  {
    id: '3',
    question: 'How do I report a technical issue?',
    answer: 'You can report technical issues through:\n• This app using the "Report Issue" feature in Customer Care\n• Calling our support line: 076 979 0642\n• Emailing helpdesk@ctecg.co.za\n• Landline: 013 262 4798\n\nPlease provide details about the issue, when it started, and any error messages you see.'
  },
  {
    id: '4',
    question: 'What should I do if my internet is slow?',
    answer: 'First, try these troubleshooting steps:\n• Restart your router/modem\n• Check if multiple devices are using the connection\n• Run a speed test at different times\n• Check for any scheduled maintenance in the Outages section\n\nIf the issue persists, contact our technical support team.'
  },
  {
    id: '5',
    question: 'How do I change my package or upgrade my speed?',
    answer: 'To change your package:\n• Contact our sales team via phone or email\n• Visit our office during business hours\n• Use the app to submit an upgrade request\n\nUpgrades typically take 24-48 hours to process. Downgrades may require a 30-day notice period.'
  },
  {
    id: '6',
    question: 'What are your service hours and support availability?',
    answer: 'Our service hours are:\n• Office: Monday to Friday, 8:00 AM - 5:00 PM\n• Technical Support: Monday to Friday, 8:00 AM - 8:00 PM\n• Emergency Support: 24/7 for critical issues\n• Weekend Support: Saturday 9:00 AM - 1:00 PM\n\nEmergency contact available for business customers.'
  },
  {
    id: '7',
    question: 'How do I set up port forwarding or configure my router?',
    answer: 'Router configuration depends on your specific model:\n• Most settings can be accessed via 192.168.1.1 or 192.168.0.1\n• Default login credentials are usually on the router label\n• For port forwarding, contact our technical support for assistance\n• We provide free basic router configuration support\n\nAdvanced configurations may require a technician visit.'
  },
  {
    id: '8',
    question: 'What is your fair usage policy for uncapped packages?',
    answer: 'Our uncapped packages include:\n• Truly unlimited data usage\n• No throttling or speed reductions\n• Fair usage applies only to excessive business usage (>1TB/month)\n• Residential users are not affected by fair usage policies\n• Gaming and streaming are fully supported\n\nWe maintain network quality for all users.'
  },
  {
    id: '9',
    question: 'How do I get a tax invoice or payment receipt?',
    answer: 'Tax invoices and receipts:\n• Automatically emailed after each payment\n• Available in the Billing section of this app\n• Can be downloaded from our customer portal\n• Duplicates available on request\n\nFor VAT registration changes, contact our accounts department with your updated VAT certificate.'
  },
  {
    id: '10',
    question: 'What happens if I move to a new address?',
    answer: 'For relocations:\n• Contact us at least 7 days before moving\n• We\'ll check service availability at your new address\n• Relocation fees may apply depending on distance\n• Installation at the new address typically takes 3-5 business days\n• Your package and billing remain unchanged\n\nSome areas may require different package options.'
  },
  {
    id: '11',
    question: 'How do I cancel my service or request a refund?',
    answer: 'Service cancellation:\n• 30-day written notice required\n• Contact our customer service team\n• Outstanding amounts must be settled\n• Equipment must be returned in good condition\n• Installation fees are non-refundable\n• Pro-rata refunds available for unused subscription periods\n\nCancellation confirmation will be sent via email.'
  },
  {
    id: '12',
    question: 'What do I do during power outages or load shedding?',
    answer: 'During power outages:\n• Our towers have backup power (4-8 hours typically)\n• Use a UPS or inverter to power your router\n• Check the Outages section for updates on extended outages\n• Report extended outages in your area\n• Consider a mobile backup solution\n\nWe provide real-time outage updates and estimated restoration times.'
  }
];

export default function FAQScreen() {
  const navigation = useNavigation();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const expandAll = () => {
    setExpandedItems(new Set(faqData.map(item => item.id)));
  };

  const collapseAll = () => {
    setExpandedItems(new Set());
  };

  return (
    <>
      <TopNavigation
        title="Frequently Asked Questions"
        subtitle="Common questions and answers"
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header with expand/collapse controls */}
        <View style={styles.headerControls}>
          <Text style={styles.headerText}>
            {faqData.length} frequently asked questions
          </Text>
          <View style={styles.controlButtons}>
            <TouchableOpacity onPress={expandAll} style={styles.controlButton}>
              <Text style={styles.controlButtonText}>Expand All</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={collapseAll} style={styles.controlButton}>
              <Text style={styles.controlButtonText}>Collapse All</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* FAQ Items */}
        <View style={styles.faqContainer}>
          {faqData.map((item) => {
            const isExpanded = expandedItems.has(item.id);
            
            return (
              <View key={item.id} style={styles.faqItem}>
                <TouchableOpacity
                  style={styles.faqHeader}
                  onPress={() => toggleExpanded(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.questionContainer}>
                    <Text style={styles.questionText}>{item.question}</Text>
                  </View>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={Colors.primary}
                    style={styles.chevronIcon}
                  />
                </TouchableOpacity>
                
                {isExpanded && (
                  <View style={styles.answerContainer}>
                    <Text style={styles.answerText}>{item.answer}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Contact support section */}
        <View style={styles.contactSection}>
          <View style={styles.contactHeader}>
            <Ionicons name="help-circle" size={24} color={Colors.primary} />
            <Text style={styles.contactTitle}>Still need help?</Text>
          </View>
          <Text style={styles.contactText}>
            If you couldn't find the answer to your question, our support team is here to help.
          </Text>
          <TouchableOpacity
            style={styles.contactButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.contactButtonText}>Back to Support</Text>
            <Ionicons name="arrow-forward" size={16} color={Colors.textInverse} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xl * 2,
  },
  headerControls: {
    marginBottom: Spacing.lg,
  },
  headerText: {
    fontSize: Typography.lg,
    fontWeight: Typography.weights.semibold,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  controlButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  controlButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  controlButtonText: {
    fontSize: Typography.sm,
    color: Colors.primary,
    fontWeight: Typography.weights.medium,
  },
  faqContainer: {
    marginBottom: Spacing.xl,
  },
  faqItem: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.surface,
  },
  questionContainer: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  questionText: {
    fontSize: Typography.md,
    fontWeight: Typography.weights.semibold,
    color: Colors.text,
    lineHeight: Typography.md * Typography.lineHeights.relaxed,
  },
  chevronIcon: {
    marginLeft: Spacing.xs,
  },
  answerContainer: {
    padding: Spacing.md,
    paddingTop: 0,
  },
  answerText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    lineHeight: Typography.sm * Typography.lineHeights.relaxed,
  },
  contactSection: {
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  contactTitle: {
    fontSize: Typography.lg,
    fontWeight: Typography.weights.semibold,
    color: Colors.text,
    marginLeft: Spacing.sm,
  },
  contactText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    lineHeight: Typography.sm * Typography.lineHeights.relaxed,
    marginBottom: Spacing.md,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 8,
    gap: Spacing.xs,
  },
  contactButtonText: {
    fontSize: Typography.md,
    fontWeight: Typography.weights.semibold,
    color: Colors.textInverse,
  },
});
