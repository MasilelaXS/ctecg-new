import React from 'react';
import {
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ConfirmationModal from './ConfirmationModal';
import { Colors, Spacing, Typography } from '../constants/Design';

interface CustomerCareModalProps {
  visible: boolean;
  onClose: () => void;
  message?: string;
}

const PHONE_NUMBER = '0769790642';
const LANDLINE_NUMBER = '0132624798';
const EMAIL_ADDRESS = 'helpdesk@ctecg.co.za';

interface ContactActionProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  url: string;
}

function ContactAction({ icon, label, value, url }: ContactActionProps) {
  const openContact = async () => {
    try {
      await Linking.openURL(url);
    } catch {
      // Keep the contact value visible if the device cannot open the link.
    }
  };

  return (
    <TouchableOpacity
      style={styles.contactAction}
      onPress={openContact}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
    >
      <View style={styles.contactIcon}>
        <Ionicons name={icon} size={20} color={Colors.primary} />
      </View>
      <View style={styles.contactText}>
        <Text style={styles.contactLabel}>{label}</Text>
        <Text style={styles.contactValue}>{value}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

export default function CustomerCareModal({
  visible,
  onClose,
  message = 'Our Customer Care team is ready to assist you.',
}: CustomerCareModalProps) {
  return (
    <ConfirmationModal
      visible={visible}
      type="confirm"
      title="Contact Customer Care"
      message={message}
      confirmText="Done"
      onConfirm={onClose}
      onCancel={onClose}
      showCancel={false}
    >
      <View style={styles.contactList}>
        <ContactAction
          icon="call-outline"
          label="Mobile"
          value="076 979 0642"
          url={`tel:${PHONE_NUMBER}`}
        />
        <ContactAction
          icon="logo-whatsapp"
          label="WhatsApp"
          value="076 979 0642"
          url={`https://wa.me/27${PHONE_NUMBER.slice(1)}`}
        />
        <ContactAction
          icon="call-outline"
          label="Landline"
          value="013 262 4798"
          url={`tel:${LANDLINE_NUMBER}`}
        />
        <ContactAction
          icon="mail-outline"
          label="Email"
          value={EMAIL_ADDRESS}
          url={`mailto:${EMAIL_ADDRESS}`}
        />
      </View>
    </ConfirmationModal>
  );
}

const styles = StyleSheet.create({
  contactList: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  contactAction: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  contactIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    marginRight: Spacing.sm,
  },
  contactText: {
    flex: 1,
  },
  contactLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.xs,
  },
  contactValue: {
    color: Colors.text,
    fontSize: Typography.sm,
    fontWeight: Typography.weights.semibold,
    marginTop: 2,
  },
});
