import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing } from '../constants/Design';
import { ConfirmationModal } from './ConfirmationModal';

interface YocoPaymentWebViewProps {
  visible: boolean;
  checkoutUrl: string;
  paymentReference: string;
  onSuccess: (paymentReference: string) => void;
  onCancel: () => void;
  onError: (error: string) => void;
}

export default function YocoPaymentWebView({
  visible,
  checkoutUrl,
  paymentReference,
  onSuccess,
  onCancel,
  onError,
}: YocoPaymentWebViewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [currentUrl, setCurrentUrl] = useState('');
  const [showCancelledModal, setShowCancelledModal] = useState(false);
  const [showFailedModal, setShowFailedModal] = useState(false);
  const [showConfirmCancelModal, setShowConfirmCancelModal] = useState(false);
  const webViewRef = useRef<WebView>(null);

  const handleNavigationStateChange = (navState: WebViewNavigation) => {
    const { url } = navState;
    setCurrentUrl(url);
    
    console.log('Yoco WebView URL:', url);

    // Check for success URL
    if (url.includes('ctecg.co.za/payment/success')) {
      console.log('Payment successful:', paymentReference);
      onSuccess(paymentReference);
      return;
    }

    // Check for cancel URL
    if (url.includes('ctecg.co.za/payment/cancel')) {
      console.log('Payment cancelled by user');
      setShowCancelledModal(true);
      return;
    }

    // Check for failure URL
    if (url.includes('ctecg.co.za/payment/failure')) {
      console.log('Payment failed');
      setShowFailedModal(true);
      return;
    }
  };

  const handleClose = () => {
    setShowConfirmCancelModal(true);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={handleClose}
          >
            <Ionicons name="close" size={28} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Secure Payment</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Payment Info Banner */}
        <View style={styles.infoBanner}>
          <Ionicons name="shield-checkmark" size={20} color={Colors.primary} />
          <Text style={styles.infoBannerText}>
            Secure payment powered by Yoco
          </Text>
        </View>

        {/* Loading Indicator */}
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading payment page...</Text>
          </View>
        )}

        {/* WebView */}
        <WebView
          ref={webViewRef}
          source={{ uri: checkoutUrl }}
          style={styles.webview}
          onNavigationStateChange={handleNavigationStateChange}
          onLoadStart={() => setIsLoading(true)}
          onLoadEnd={() => setIsLoading(false)}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.error('WebView error:', nativeEvent);
            onError('Failed to load payment page');
          }}
          startInLoadingState={true}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          sharedCookiesEnabled={true}
        />

        {/* Current URL Display (Debug - Remove in production) */}
        {__DEV__ && currentUrl && (
          <View style={styles.debugBar}>
            <Text style={styles.debugText} numberOfLines={1}>
              {currentUrl}
            </Text>
          </View>
        )}

        {/* Payment Cancelled Modal */}
        <ConfirmationModal
          visible={showCancelledModal}
          type="info"
          title="Payment Cancelled"
          message="You have cancelled the payment."
          confirmText="OK"
          onConfirm={() => {
            setShowCancelledModal(false);
            onCancel();
          }}
          onCancel={() => {
            setShowCancelledModal(false);
            onCancel();
          }}
          showCancel={false}
        />

        {/* Payment Failed Modal */}
        <ConfirmationModal
          visible={showFailedModal}
          type="error"
          title="Payment Failed"
          message="The payment could not be processed. Please try again or use a different payment method."
          confirmText="OK"
          onConfirm={() => {
            setShowFailedModal(false);
            onError('Payment failed');
          }}
          onCancel={() => {
            setShowFailedModal(false);
            onError('Payment failed');
          }}
          showCancel={false}
        />

        {/* Confirm Cancel Modal */}
        <ConfirmationModal
          visible={showConfirmCancelModal}
          type="warning"
          title="Cancel Payment"
          message="Are you sure you want to cancel this payment?"
          confirmText="Yes"
          cancelText="No"
          onConfirm={() => {
            setShowConfirmCancelModal(false);
            onCancel();
          }}
          onCancel={() => setShowConfirmCancelModal(false)}
          destructive
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: Typography.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.primaryLight,
    gap: Spacing.xs,
  },
  infoBannerText: {
    fontSize: Typography.sm,
    color: Colors.primary,
    fontWeight: Typography.weights.semibold,
  },
  loadingOverlay: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: Typography.md,
    color: Colors.textSecondary,
  },
  webview: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  debugBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: Spacing.xs,
  },
  debugText: {
    fontSize: Typography.sm,
    color: Colors.textInverse,
    fontFamily: 'monospace',
  },
});
