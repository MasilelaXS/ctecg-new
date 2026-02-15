import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import Toast, { ToastConfig } from 'react-native-toast-message';
import { BlurView } from 'expo-blur';
import { Colors, Typography, Spacing } from '../constants/Design';
import { Ionicons } from '@expo/vector-icons';

type ToastType = 'success' | 'error' | 'info' | 'warning';

const iconConfig: Record<ToastType, { name: keyof typeof Ionicons.glyphMap; color: string; bgColor: string }> = {
  success: { name: 'checkmark-circle', color: '#10B981', bgColor: '#D1FAE5' },
  error: { name: 'close-circle', color: Colors.error, bgColor: '#FEE2E2' },
  warning: { name: 'warning', color: '#F59E0B', bgColor: '#FEF3C7' },
  info: { name: 'information-circle', color: '#3B82F6', bgColor: '#DBEAFE' },
};

// Custom toast configuration with glass morphism design matching ConfirmationModal
export const toastConfig: ToastConfig = {
  success: (props) => (
    <View style={styles.toastWrapper}>
      <BlurView
        intensity={Platform.OS === 'ios' ? 80 : 100}
        tint="light"
        style={styles.blurContainer}
      />
      <View style={styles.glassOverlay} />
      
      <View style={styles.toastContent}>
        <View style={[styles.iconContainer, { backgroundColor: iconConfig.success.bgColor }]}>
          <Ionicons name={iconConfig.success.name} size={24} color={iconConfig.success.color} />
        </View>
        
        <View style={styles.textContainer}>
          <Text style={styles.title}>{props.text1}</Text>
          {props.text2 && <Text style={styles.message}>{props.text2}</Text>}
        </View>
        
        <TouchableOpacity 
          style={styles.dismissButton} 
          onPress={() => Toast.hide()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={20} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  ),

  error: (props) => (
    <View style={styles.toastWrapper}>
      <BlurView
        intensity={Platform.OS === 'ios' ? 80 : 100}
        tint="light"
        style={styles.blurContainer}
      />
      <View style={styles.glassOverlay} />
      
      <View style={styles.toastContent}>
        <View style={[styles.iconContainer, { backgroundColor: iconConfig.error.bgColor }]}>
          <Ionicons name={iconConfig.error.name} size={24} color={iconConfig.error.color} />
        </View>
        
        <View style={styles.textContainer}>
          <Text style={styles.title}>{props.text1}</Text>
          {props.text2 && <Text style={styles.message}>{props.text2}</Text>}
        </View>
        
        <TouchableOpacity 
          style={styles.dismissButton} 
          onPress={() => Toast.hide()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={20} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  ),

  info: (props) => (
    <View style={styles.toastWrapper}>
      <BlurView
        intensity={Platform.OS === 'ios' ? 80 : 100}
        tint="light"
        style={styles.blurContainer}
      />
      <View style={styles.glassOverlay} />
      
      <View style={styles.toastContent}>
        <View style={[styles.iconContainer, { backgroundColor: iconConfig.info.bgColor }]}>
          <Ionicons name={iconConfig.info.name} size={24} color={iconConfig.info.color} />
        </View>
        
        <View style={styles.textContainer}>
          <Text style={styles.title}>{props.text1}</Text>
          {props.text2 && <Text style={styles.message}>{props.text2}</Text>}
        </View>
        
        <TouchableOpacity 
          style={styles.dismissButton} 
          onPress={() => Toast.hide()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={20} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  ),

  warning: (props) => (
    <View style={styles.toastWrapper}>
      <BlurView
        intensity={Platform.OS === 'ios' ? 80 : 100}
        tint="light"
        style={styles.blurContainer}
      />
      <View style={styles.glassOverlay} />
      
      <View style={styles.toastContent}>
        <View style={[styles.iconContainer, { backgroundColor: iconConfig.warning.bgColor }]}>
          <Ionicons name={iconConfig.warning.name} size={24} color={iconConfig.warning.color} />
        </View>
        
        <View style={styles.textContainer}>
          <Text style={styles.title}>{props.text1}</Text>
          {props.text2 && <Text style={styles.message}>{props.text2}</Text>}
        </View>
        
        <TouchableOpacity 
          style={styles.dismissButton} 
          onPress={() => Toast.hide()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={20} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  ),
};

// Helper functions for showing toasts
export const showToast = {
  success: (title: string, message?: string) => {
    Toast.show({
      type: 'success',
      text1: title,
      text2: message,
      position: 'top',
      visibilityTime: 4000,
      autoHide: true,
      topOffset: 60,
    });
  },

  error: (title: string, message?: string) => {
    Toast.show({
      type: 'error',
      text1: title,
      text2: message,
      position: 'top',
      visibilityTime: 5000,
      autoHide: true,
      topOffset: 60,
    });
  },

  info: (title: string, message?: string) => {
    Toast.show({
      type: 'info',
      text1: title,
      text2: message,
      position: 'top',
      visibilityTime: 4000,
      autoHide: true,
      topOffset: 60,
    });
  },

  warning: (title: string, message?: string) => {
    Toast.show({
      type: 'warning',
      text1: title,
      text2: message,
      position: 'top',
      visibilityTime: 4500,
      autoHide: true,
      topOffset: 60,
    });
  },
};

const styles = StyleSheet.create({
  toastWrapper: {
    width: '90%',
    maxWidth: 400,
    marginHorizontal: Spacing.md,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  blurContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    gap: Spacing.sm,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: Typography.md,
    fontWeight: Typography.weights.semibold,
    color: Colors.text,
    lineHeight: 20,
  },
  message: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  dismissButton: {
    padding: 4,
    borderRadius: 8,
  },
});

export { Toast };
