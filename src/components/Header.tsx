import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface HeaderProps {
  title: string;
  subtitle?: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  rightComponent?: React.ReactNode;
  variant?: 'default' | 'primary' | 'transparent';
}

export default function Header({
  title,
  subtitle,
  showBackButton = false,
  onBackPress,
  rightComponent,
  variant = 'default',
}: HeaderProps) {
  const insets = useSafeAreaInsets();

  const getStatusBarStyle = () => {
    switch (variant) {
      case 'primary':
        return 'light-content';
      case 'transparent':
        return 'dark-content';
      default:
        return 'dark-content';
    }
  };

  const getBackgroundColor = () => {
    switch (variant) {
      case 'primary':
        return '#cc0000';
      case 'transparent':
        return 'transparent';
      default:
        return '#FFFFFF';
    }
  };

  const getTitleColor = () => {
    switch (variant) {
      case 'primary':
        return '#FFFFFF';
      case 'transparent':
        return '#1A1A1A';
      default:
        return '#1A1A1A';
    }
  };

  const getSubtitleColor = () => {
    switch (variant) {
      case 'primary':
        return '#FFFFFF';
      case 'transparent':
        return '#666666';
      default:
        return '#666666';
    }
  };

  const getIconColor = () => {
    switch (variant) {
      case 'primary':
        return '#FFFFFF';
      default:
        return '#1A1A1A';
    }
  };

  return (
    <>
      <StatusBar
        barStyle={getStatusBarStyle()}
        backgroundColor={getBackgroundColor()}
        translucent={variant === 'transparent'}
      />
      <View
        style={[
          styles.header,
          { 
            paddingTop: variant === 'transparent' ? insets.top : insets.top + 8,
            backgroundColor: getBackgroundColor(),
          },
          variant !== 'transparent' && styles.shadow
        ]}
      >
        <View style={styles.content}>
          <View style={styles.leftSection}>
            {showBackButton && (
              <TouchableOpacity
                onPress={onBackPress}
                style={styles.backButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons 
                  name="chevron-back" 
                  size={24} 
                  color={getIconColor()} 
                />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.centerSection}>
            <Text style={[styles.title, { color: getTitleColor() }]}>
              {title}
            </Text>
            {subtitle && (
              <Text style={[styles.subtitle, { color: getSubtitleColor() }]}>
                {subtitle}
              </Text>
            )}
          </View>

          <View style={styles.rightSection}>
            {rightComponent}
          </View>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingBottom: 16,
  },
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  leftSection: {
    width: 40,
    alignItems: 'flex-start',
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
  },
  rightSection: {
    width: 40,
    alignItems: 'flex-end',
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
