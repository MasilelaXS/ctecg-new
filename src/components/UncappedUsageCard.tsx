import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Card from './Card';

interface UncappedUsageCardProps {
  downloadGb: number;
  uploadGb: number;
  totalGb: number;
  packageName: string;
}

export default function UncappedUsageCard({
  downloadGb,
  uploadGb,
  totalGb,
  packageName,
}: UncappedUsageCardProps) {
  return (
    <Card>
      <View style={styles.container}>
        {/* Unlimited Header */}
        <View style={styles.unlimitedSection}>
          <View style={styles.unlimitedHeader}>
            <View style={styles.infinityIcon}>
              <Text style={styles.infinitySymbol}>∞</Text>
            </View>
            <View style={styles.unlimitedTextContainer}>
              <Text style={styles.unlimitedLabel}>Unlimited Data</Text>
              <Text style={styles.packageLabel}>{packageName}</Text>
            </View>
          </View>
        </View>

        {/* Usage Details */}
        <View style={styles.usageSection}>
          <View style={styles.usageRow}>
            <Text style={styles.usageLabel}>Downloaded</Text>
            <Text style={styles.usageValue}>{downloadGb.toFixed(1)} GB</Text>
          </View>
          
          <View style={styles.usageRow}>
            <Text style={styles.usageLabel}>Uploaded</Text>
            <Text style={styles.usageValue}>{uploadGb.toFixed(1)} GB</Text>
          </View>
          
          <View style={[styles.usageRow, styles.totalRow]}>
            <Text style={[styles.usageLabel, styles.totalLabel]}>Total Used</Text>
            <Text style={[styles.usageValue, styles.totalValue]}>{totalGb.toFixed(1)} GB</Text>
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  unlimitedSection: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    marginBottom: 16,
  },
  unlimitedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  infinityIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#cc0000',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  infinitySymbol: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  unlimitedTextContainer: {
    alignItems: 'flex-start',
  },
  unlimitedLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  packageLabel: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  usageSection: {
    // No additional margin needed
  },
  usageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  totalRow: {
    borderBottomWidth: 0,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 12,
    marginTop: 4,
  },
  usageLabel: {
    fontSize: 14,
    color: '#666666',
  },
  totalLabel: {
    fontWeight: '600',
    color: '#1A1A1A',
  },
  usageValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
});
