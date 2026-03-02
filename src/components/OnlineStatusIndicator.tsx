import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing } from '../constants/Design';
import { apiService } from '../services/api';

interface OnlineStatusIndicatorProps {
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export default function OnlineStatusIndicator({
  size = 'medium',
  showText = true,
  autoRefresh = true,
  refreshInterval = 60000,
}: OnlineStatusIndicatorProps) {
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  const fetchOnlineStatus = async () => {
    try {
      const response = await apiService.getOnlineStatus();
      if (response.success && response.data) {
        setIsOnline(response.data.is_online);
      }
    } catch (error) {
      console.error('Error fetching online status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOnlineStatus();

    if (autoRefresh) {
      const interval = setInterval(fetchOnlineStatus, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  const getStatusColor = () => {
    if (loading) return Colors.textSecondary;
    return isOnline ? Colors.success : Colors.textSecondary;
  };

  const getStatusText = () => {
    if (loading) return 'Checking...';
    return isOnline ? 'Online' : 'Offline';
  };

  const getDotSize = () => {
    switch (size) {
      case 'small':
        return 8;
      case 'large':
        return 14;
      default:
        return 10;
    }
  };

  const getTextSize = () => {
    switch (size) {
      case 'small':
        return Typography.sm;
      case 'large':
        return Typography.md;
      default:
        return Typography.sm;
    }
  };

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.statusDot,
          {
            width: getDotSize(),
            height: getDotSize(),
            backgroundColor: getStatusColor(),
            opacity: isOnline ? 1 : 0.5,
          },
        ]}
      >
        {isOnline && <View style={styles.pulse} />}
      </View>
      {showText && (
        <Text
          style={[
            styles.statusText,
            {
              fontSize: getTextSize(),
              color: getStatusColor(),
            },
          ]}
        >
          {getStatusText()}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statusDot: {
    borderRadius: 100,
    position: 'relative',
  },
  pulse: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 100,
    backgroundColor: Colors.success,
    opacity: 0.3,
  },
  statusText: {
    fontWeight: Typography.weights.medium,
  },
});
