import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { Colors, Typography } from "../constants/Design";

interface DataUsageGaugeProps {
  percentage: number | null;
  downloadPercentage: number;
  uploadPercentage: number;
  isUnlimited?: boolean;
  size?: number;
}

export const USAGE_RING_COLORS = {
  download: "#9CA3AF",
  upload: "#D1D5DB",
  track: "#F3F4F6",
} as const;

export const getUsageColor = (percentage: number | null) => {
  if (percentage === null) return Colors.primary;
  if (percentage >= 95) return Colors.error;
  if (percentage >= 85) return "#EA580C";
  if (percentage >= 70) return "#D97706";
  if (percentage >= 50) return "#CA8A04";
  return Colors.success;
};

const normalizePercentage = (value: number | null): number =>
  Math.min(Math.max(value ?? 0, 0), 100);

export default function DataUsageGauge({
  percentage,
  downloadPercentage,
  uploadPercentage,
  isUnlimited = false,
  size = 120,
}: DataUsageGaugeProps) {
  const center = size / 2;
  const totalColor = getUsageColor(percentage);
  const normalizedTotal = normalizePercentage(percentage);
  const normalizedDownload = normalizePercentage(downloadPercentage);
  const normalizedUpload = normalizePercentage(uploadPercentage);
  const outerRadius = size / 2 - 6;
  const middleRadius = outerRadius - 10;
  const innerRadius = middleRadius - 10;

  const rings = isUnlimited
    ? [
        {
          key: "download",
          percentage: normalizedDownload,
          radius: outerRadius,
          strokeWidth: 9,
          color: USAGE_RING_COLORS.download,
        },
        {
          key: "upload",
          percentage: normalizedUpload,
          radius: middleRadius,
          strokeWidth: 8,
          color: USAGE_RING_COLORS.upload,
        },
      ]
    : [
        {
          key: "total",
          percentage: normalizedTotal,
          radius: outerRadius,
          strokeWidth: 9,
          color: totalColor,
        },
        {
          key: "download",
          percentage: normalizedDownload,
          radius: middleRadius,
          strokeWidth: 8,
          color: USAGE_RING_COLORS.download,
        },
        {
          key: "upload",
          percentage: normalizedUpload,
          radius: innerRadius,
          strokeWidth: 7,
          color: USAGE_RING_COLORS.upload,
        },
      ];

  const accessibilityLabel = isUnlimited
    ? `Unlimited data plan. Downloads are ${Math.round(normalizedDownload)} percent and uploads are ${Math.round(normalizedUpload)} percent of measured traffic.`
    : percentage === null
      ? "Package usage percentage is unavailable."
      : `${Math.round(normalizedTotal)} percent total used. Downloads use ${Math.round(normalizedDownload)} percent and uploads use ${Math.round(normalizedUpload)} percent of the package limit.`;

  return (
    <View
      style={[styles.container, { width: size, height: size }]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={
        isUnlimited || percentage === null
          ? undefined
          : { min: 0, max: 100, now: Math.round(normalizedTotal) }
      }
    >
      <Svg width={size} height={size} style={styles.gauge}>
        {rings.map((ring) => {
          const circumference = 2 * Math.PI * ring.radius;
          const progressOffset =
            circumference - (ring.percentage / 100) * circumference;

          return (
            <React.Fragment key={ring.key}>
              <Circle
                cx={center}
                cy={center}
                r={ring.radius}
                fill="none"
                stroke={USAGE_RING_COLORS.track}
                strokeWidth={ring.strokeWidth}
              />
              <Circle
                cx={center}
                cy={center}
                r={ring.radius}
                fill="none"
                stroke={ring.color}
                strokeWidth={ring.strokeWidth}
                strokeLinecap="round"
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={progressOffset}
                rotation={-90}
                origin={`${center}, ${center}`}
              />
            </React.Fragment>
          );
        })}
      </Svg>

      <View style={styles.content} pointerEvents="none">
        <Text
          style={[
            styles.value,
            {
              color: totalColor,
              fontSize: isUnlimited ? Typography.xs : Typography.xl,
            },
          ]}
        >
          {isUnlimited
            ? "Unlimited"
            : percentage === null
              ? "N/A"
              : `${Math.round(normalizedTotal)}%`}
        </Text>
        <Text style={styles.label}>
          {isUnlimited ? "Plan" : percentage === null ? "Usage" : "Used"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  gauge: {
    position: "absolute",
  },
  content: {
    alignItems: "center",
    justifyContent: "center",
  },
  value: {
    fontWeight: Typography.weights.bold,
  },
  label: {
    marginTop: 2,
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: Typography.letterSpacing.wider,
  },
});
