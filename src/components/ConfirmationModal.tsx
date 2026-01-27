import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Colors, Typography, Spacing } from '../constants/Design';
import { Ionicons } from '@expo/vector-icons';

type ModalType = 'confirm' | 'success' | 'error' | 'warning' | 'info';

interface ConfirmationModalProps {
  visible: boolean;
  type?: ModalType;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  showCancel?: boolean;
  destructive?: boolean;
}

const iconConfig: Record<ModalType, { name: keyof typeof Ionicons.glyphMap; color: string; bgColor: string }> = {
  confirm: { name: 'help-circle', color: Colors.primary, bgColor: '#FEE2E2' },
  success: { name: 'checkmark-circle', color: '#10B981', bgColor: '#D1FAE5' },
  error: { name: 'close-circle', color: Colors.error, bgColor: '#FEE2E2' },
  warning: { name: 'warning', color: '#F59E0B', bgColor: '#FEF3C7' },
  info: { name: 'information-circle', color: '#3B82F6', bgColor: '#DBEAFE' },
};

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  visible,
  type = 'confirm',
  title,
  message,
  confirmText = 'OK',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  showCancel = true,
  destructive = false,
}) => {
  const icon = iconConfig[type];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.container}>
              {/* Glass Effect Background */}
              <BlurView
                intensity={Platform.OS === 'ios' ? 80 : 100}
                tint="light"
                style={styles.blurContainer}
              />
              
              {/* Glass overlay for extra frosted effect */}
              <View style={styles.glassOverlay} />

              {/* Content */}
              <View style={styles.content}>
                {/* Icon */}
                <View style={[styles.iconContainer, { backgroundColor: icon.bgColor }]}>
                  <Ionicons name={icon.name} size={32} color={icon.color} />
                </View>

                {/* Text Content */}
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.message}>{message}</Text>

                {/* Buttons */}
                <View style={styles.buttonContainer}>
                  {showCancel && (
                    <TouchableOpacity
                      style={[styles.button, styles.cancelButton]}
                      onPress={onCancel}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.cancelButtonText}>{cancelText}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[
                      styles.button,
                      styles.confirmButton,
                      destructive && styles.destructiveButton,
                      !showCancel && styles.fullWidthButton,
                    ]}
                    onPress={onConfirm}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.confirmButtonText, destructive && styles.destructiveButtonText]}>
                      {confirmText}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  container: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    overflow: 'hidden',
    // Glass border effect
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    // Shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 20,
  },
  blurContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  content: {
    padding: Spacing.lg,
    alignItems: 'center',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    // Subtle shadow on icon
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: Typography.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  message: {
    fontSize: Typography.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  buttonContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: Spacing.sm,
  },
  button: {
    flex: 1,
    paddingVertical: Spacing.sm + 4,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  cancelButtonText: {
    fontSize: Typography.md,
    fontWeight: Typography.weights.semibold,
    color: Colors.textSecondary,
  },
  confirmButton: {
    backgroundColor: Colors.primary,
    // Subtle glow effect
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmButtonText: {
    fontSize: Typography.md,
    fontWeight: Typography.weights.semibold,
    color: Colors.textInverse,
  },
  destructiveButton: {
    backgroundColor: Colors.error,
    shadowColor: Colors.error,
  },
  destructiveButtonText: {
    color: Colors.textInverse,
  },
  fullWidthButton: {
    flex: 1,
  },
});

export default ConfirmationModal;
