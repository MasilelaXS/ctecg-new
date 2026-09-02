import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography } from '../constants/Design';

interface CachedDataNoticeProps {
  cachedAt: string | null;
}

export default function CachedDataNotice({ cachedAt }: CachedDataNoticeProps) {
  if (!cachedAt) return null;
  const date = new Date(cachedAt);
  const formatted = Number.isNaN(date.getTime()) ? 'earlier' : date.toLocaleString();

  return (
    <View style={styles.container} accessibilityRole="alert">
      <Ionicons name="cloud-offline-outline" size={20} color={Colors.warning || '#B56A00'} />
      <Text style={styles.text}>You are offline. Showing saved data from {formatted}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#FFF8E8',
    borderColor: '#F1D49A',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  text: {
    color: Colors.textSecondary,
    flex: 1,
    fontSize: Typography.sm,
  },
});
