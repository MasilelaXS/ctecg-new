import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { TowerNotification } from "../types/api";
import { Colors, Spacing, Typography } from "../constants/Design";
import StevieMascot from "./StevieMascot";

export default function TowerNotificationCard({
  notification,
}: {
  notification: TowerNotification;
}) {
  const created = new Date(notification.created_at);
  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`${notification.title}. ${notification.message}`}
    >
      <View style={styles.content}>
        <Text style={styles.title}>{notification.title}</Text>
        <Text style={styles.message}>{notification.message}</Text>
        <View style={styles.detailsRow}>
          {notification.tower_names.length > 0 && (
            <View style={styles.detailItem}>
              <Ionicons
                name="location-outline"
                size={15}
                color={Colors.textMuted}
              />
              <Text style={styles.detailText}>
                {notification.tower_names.join(", ")}
              </Text>
            </View>
          )}
          {!Number.isNaN(created.getTime()) && (
            <Text style={styles.date}>
              {created.toLocaleDateString("en-ZA")}
            </Text>
          )}
        </View>
      </View>
      <StevieMascot width={82} decorative style={styles.stevieImage} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 132,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingLeft: Spacing.md,
    marginBottom: Spacing.md,
    overflow: "hidden",
  },
  content: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingRight: Spacing.sm,
  },
  title: {
    ...Typography.bodyLargeBold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  message: { ...Typography.bodyMedium, color: Colors.text, lineHeight: 21 },
  detailsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  detailText: { ...Typography.bodySmall, color: Colors.textMuted },
  date: { ...Typography.bodySmall, color: Colors.textMuted },
  stevieImage: {
    alignSelf: "flex-end",
    marginRight: Spacing.sm,
  },
});
