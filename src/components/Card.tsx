import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  style?: ViewStyle;
  titleStyle?: TextStyle;
  subtitleStyle?: TextStyle;
  variant?: 'default' | 'highlight' | 'minimal' | 'uncapped';
}

export default function Card({
  children,
  title,
  subtitle,
  style,
  titleStyle,
  subtitleStyle,
  variant = 'default',
}: CardProps) {
  return (
    <View style={[styles.card, styles[variant], style]}>
      {title && (
        <View style={styles.header}>
          <Text style={[styles.title, titleStyle]}>{title}</Text>
          {subtitle && (
            <Text style={[styles.subtitle, subtitleStyle]}>{subtitle}</Text>
          )}
        </View>
      )}
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    elevation: 2,
  },
  default: {
    // Default card style with no additional borders
  },
  highlight: {
    backgroundColor: '#FFF5F5',
  },
  minimal: {
    shadowOpacity: 0.04,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  uncapped: {
    backgroundColor: '#FFF5F5',
    borderColor: '#cc0000',
    borderWidth: 2,
  },
  header: {
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  content: {
    // Content styling
  },
});
