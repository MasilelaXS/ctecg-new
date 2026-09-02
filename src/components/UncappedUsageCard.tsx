import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Colors, Spacing, Typography } from "../constants/Design";
import { calculateUsageRingPercentages } from "../utils/usageRings";
import Card from "./Card";
import DataUsageGauge, { USAGE_RING_COLORS } from "./DataUsageGauge";

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
  const rings = calculateUsageRingPercentages(
    downloadGb,
    uploadGb,
    totalGb,
    null,
    true,
  );

  return (
    <Card title="Data Usage" subtitle="Current Month">
      <View style={styles.overview}>
        <DataUsageGauge
          percentage={null}
          downloadPercentage={rings.download}
          uploadPercentage={rings.upload}
          isUnlimited
        />

        <View style={styles.details}>
          <MetricRow
            label="Downloaded"
            value={`${downloadGb.toFixed(1)} GB`}
            percentage={`${Math.round(rings.download)}% of traffic`}
            color={USAGE_RING_COLORS.download}
          />
          <MetricRow
            label="Uploaded"
            value={`${uploadGb.toFixed(1)} GB`}
            percentage={`${Math.round(rings.upload)}% of traffic`}
            color={USAGE_RING_COLORS.upload}
          />
          <View style={styles.row}>
            <Text style={styles.label}>Total Used</Text>
            <Text style={[styles.value, styles.totalValue]}>
              {totalGb.toFixed(1)} GB
            </Text>
          </View>
          <View style={[styles.row, styles.lastRow]}>
            <Text style={styles.label}>Plan Type</Text>
            <Text style={styles.value}>Unlimited</Text>
          </View>
        </View>
      </View>

      <View style={styles.packageRow}>
        <Text style={styles.packageLabel}>Package</Text>
        <Text style={styles.packageValue} numberOfLines={2}>
          {packageName}
        </Text>
      </View>
    </Card>
  );
}

function MetricRow({
  label,
  value,
  percentage,
  color,
}: {
  label: string;
  value: string;
  percentage: string;
  color: string;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.labelGroup}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={styles.label}>{label}</Text>
      </View>
      <View style={styles.valueGroup}>
        <Text style={styles.value}>{value}</Text>
        <Text style={styles.percentage}>{percentage}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overview: {
    flexDirection: "row",
    alignItems: "center",
  },
  details: {
    flex: 1,
    marginLeft: Spacing.lg,
  },
  row: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  lastRow: {
    marginBottom: 0,
  },
  labelGroup: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.xs,
  },
  label: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
  valueGroup: {
    alignItems: "flex-end",
    marginLeft: Spacing.sm,
  },
  value: {
    fontSize: Typography.sm,
    fontWeight: Typography.weights.semibold,
    color: Colors.text,
  },
  percentage: {
    marginTop: 2,
    fontSize: 10,
    color: Colors.textSecondary,
  },
  totalValue: {
    color: Colors.primary,
    fontWeight: Typography.weights.bold,
  },
  packageRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  packageLabel: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
  packageValue: {
    flex: 1,
    marginLeft: Spacing.md,
    fontSize: Typography.sm,
    fontWeight: Typography.weights.semibold,
    color: Colors.text,
    textAlign: "right",
  },
});
