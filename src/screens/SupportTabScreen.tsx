import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SupportScreen from './SupportScreen';
import SupportChatListScreen from './SupportChatListScreen';
import { apiService } from '../services/api';
import { Colors } from '../constants/Design';

export default function SupportTabScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [isChatEnabled, setIsChatEnabled] = useState(false);

  useEffect(() => {
    checkChatSettings();
  }, []);

  const checkChatSettings = async () => {
    try {
      const response = await apiService.getChatSettings();
      if (response.success && response.data) {
        const chatEnabled = response.data.support_chat_enabled === true || 
                          String(response.data.support_chat_enabled) === 'true';
        setIsChatEnabled(chatEnabled);
      }
    } catch (error) {
      console.error('Failed to check chat settings:', error);
      // Default to email form if check fails
      setIsChatEnabled(false);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={[]}>
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // Render chat list if enabled, otherwise show email form
  return isChatEnabled ? <SupportChatListScreen /> : <SupportScreen />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
