import React, { useState } from 'react';
import { Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import TopNavigation from '../components/TopNavigation';
import { Colors, Spacing, Typography } from '../constants/Design';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  paymentOptions?: boolean;
}

const SHOP2SHOP_URL = 'https://shop.shoptoshop.co.za/qr-code/send?code=QZ2AJ7';

const faqData: FAQItem[] = [
  { id: 'usage', question: 'How do I check my data usage?', answer: 'Open the Usage tab to see the usage information available for your account, including the current billing period and the daily counters supplied by Azotel.' },
  { id: 'payments', question: 'What payment methods do you accept?', answer: 'You can pay securely in the following ways:\n• Yoco card payment from Billing > Make a Payment\n• Shop2Shop using the QR code below\n• Bank transfer (EFT)\n• Debit order\n• Cash deposit at our office\n\nAlways use your CTECG account number as the payment reference.', paymentOptions: true },
  { id: 'report-issue', question: 'How do I report a technical issue?', answer: 'Use Report Issue on the Support screen, call 076 979 0642, WhatsApp 076 979 0642, call our landline on 013 262 4798, or email helpdesk@ctecg.co.za. Please explain what happened, when it started, and any error message you saw.' },
  { id: 'slow-internet', question: 'What should I do if my internet is slow?', answer: 'Restart your router, check whether several devices are using the connection, and run a speed test. If the problem continues, report it from the Support screen or contact Technical Support.' },
  { id: 'package-change', question: 'How do I change my package or upgrade my speed?', answer: 'Contact Customer Care so the team can check which packages and speeds are available for your service and explain any applicable processing time or notice period.' },
  { id: 'hours', question: 'What are your service hours and support availability?', answer: 'Our service hours are:\n• Office: 08H00 - 17H00, Monday to Friday\n• Technical Support: 05H00 - 22H00, Monday to Sunday.' },
  { id: 'fair-usage', question: 'Do you have a fair usage policy?', answer: 'No. CTECG does not have a fair usage policy.' },
  { id: 'invoices', question: 'How do I get my invoices?', answer: 'Your latest three invoices are available on the Billing screen in this app. If you need an older invoice or have a question about an invoice, contact Customer Care.' },
  { id: 'relocation', question: 'What happens if I move to a new address?', answer: 'Contact Customer Care before moving so CTECG can check service availability at the new address and explain the relocation process, expected timing, and any applicable fees.' },
  { id: 'power-outage', question: 'What do I do during power outages or load shedding?', answer: 'Your router and related equipment need power to keep working during an outage. If you have a suitable DC UPS, connect it according to the manufacturer’s instructions. If you do not have one, you may purchase a compatible DC UPS yourself or contact Customer Care to purchase one from CTECG.' },
];

export default function FAQScreen() {
  const navigation = useNavigation();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setExpandedItems((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <>
      <TopNavigation title="Frequently Asked Questions" subtitle="Common questions and answers" showBackButton onBackPress={() => navigation.goBack()} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerControls}>
          <Text style={styles.headerText}>{faqData.length} frequently asked questions</Text>
          <View style={styles.controlButtons}>
            <TouchableOpacity onPress={() => setExpandedItems(new Set(faqData.map((item) => item.id)))} style={styles.controlButton} accessibilityRole="button">
              <Text style={styles.controlButtonText}>Expand All</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setExpandedItems(new Set())} style={styles.controlButton} accessibilityRole="button">
              <Text style={styles.controlButtonText}>Collapse All</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.faqContainer}>
          {faqData.map((item) => {
            const isExpanded = expandedItems.has(item.id);
            return (
              <View key={item.id} style={styles.faqItem}>
                <TouchableOpacity style={styles.faqHeader} onPress={() => toggleExpanded(item.id)} activeOpacity={0.7} accessibilityRole="button" accessibilityState={{ expanded: isExpanded }}>
                  <Text style={styles.questionText}>{item.question}</Text>
                  <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.primary} />
                </TouchableOpacity>
                {isExpanded && (
                  <View style={styles.answerContainer}>
                    <Text style={styles.answerText}>{item.answer}</Text>
                    {item.paymentOptions && (
                      <View style={styles.paymentContainer}>
                        <Text style={styles.paymentTitle}>Shop2Shop payment QR</Text>
                        <Image source={require('../../assets/shop2shop-qr.png')} style={styles.paymentQr} resizeMode="contain" accessibilityLabel="Shop2Shop payment QR code" />
                        <TouchableOpacity style={styles.paymentButton} onPress={() => Linking.openURL(SHOP2SHOP_URL)} accessibilityRole="link" accessibilityLabel="Open Shop2Shop payment page">
                          <Text style={styles.paymentButtonText}>Open Shop2Shop</Text>
                          <Ionicons name="open-outline" size={17} color={Colors.textInverse} />
                        </TouchableOpacity>
                        <Text style={styles.paymentHint}>For Yoco, open Billing and select Make a Payment.</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        <View style={styles.contactSection}>
          <View style={styles.contactHeader}>
            <Ionicons name="help-circle" size={24} color={Colors.primary} />
            <Text style={styles.contactTitle}>Still need help?</Text>
          </View>
          <Text style={styles.contactText}>If you could not find the answer, our Customer Care team is ready to help.</Text>
          <TouchableOpacity style={styles.contactButton} onPress={() => navigation.goBack()} accessibilityRole="button">
            <Text style={styles.contactButtonText}>Back to Support</Text>
            <Ionicons name="arrow-forward" size={16} color={Colors.textInverse} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: Spacing.md, paddingBottom: Spacing.xl * 2 },
  headerControls: { marginBottom: Spacing.lg },
  headerText: { fontSize: Typography.lg, fontWeight: Typography.weights.semibold, color: Colors.text, marginBottom: Spacing.sm },
  controlButtons: { flexDirection: 'row', gap: Spacing.sm },
  controlButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.sm, backgroundColor: Colors.surface, borderRadius: 8, borderWidth: 1, borderColor: Colors.border },
  controlButtonText: { fontSize: Typography.sm, color: Colors.primary, fontWeight: Typography.weights.medium },
  faqContainer: { marginBottom: Spacing.xl },
  faqItem: { backgroundColor: Colors.background, borderRadius: 12, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  faqHeader: { minHeight: 58, flexDirection: 'row', alignItems: 'center', padding: Spacing.md, backgroundColor: Colors.surface },
  questionText: { flex: 1, marginRight: Spacing.sm, fontSize: Typography.md, fontWeight: Typography.weights.semibold, color: Colors.text, lineHeight: Typography.md * Typography.lineHeights.relaxed },
  answerContainer: { padding: Spacing.md, paddingTop: 0 },
  answerText: { fontSize: Typography.sm, color: Colors.textSecondary, lineHeight: Typography.sm * Typography.lineHeights.relaxed },
  paymentContainer: { alignItems: 'center', marginTop: Spacing.lg, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  paymentTitle: { fontSize: Typography.md, fontWeight: Typography.weights.semibold, color: Colors.text, marginBottom: Spacing.sm },
  paymentQr: { width: 220, height: 220, backgroundColor: '#FFFFFF' },
  paymentButton: { minHeight: 46, marginTop: Spacing.md, paddingHorizontal: Spacing.lg, borderRadius: 8, backgroundColor: Colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs },
  paymentButtonText: { color: Colors.textInverse, fontSize: Typography.sm, fontWeight: Typography.weights.semibold },
  paymentHint: { color: Colors.textSecondary, fontSize: Typography.xs, textAlign: 'center', marginTop: Spacing.sm },
  contactSection: { backgroundColor: Colors.surface, padding: Spacing.lg, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  contactHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  contactTitle: { fontSize: Typography.lg, fontWeight: Typography.weights.semibold, color: Colors.text, marginLeft: Spacing.sm },
  contactText: { fontSize: Typography.sm, color: Colors.textSecondary, lineHeight: Typography.sm * Typography.lineHeights.relaxed, marginBottom: Spacing.md },
  contactButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, borderRadius: 8, gap: Spacing.xs },
  contactButtonText: { fontSize: Typography.md, fontWeight: Typography.weights.semibold, color: Colors.textInverse },
});
