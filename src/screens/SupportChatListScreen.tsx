import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import TopNavigation from '../components/TopNavigation';
import ConfirmationModal from '../components/ConfirmationModal';
import { showToast } from '../components/Toast';
import { Colors, Typography, CommonStyles, Spacing } from '../constants/Design';
import { apiService } from '../services/api';
import { SupportTicket } from '../types/api';

export default function SupportChatListScreen() {
  const navigation = useNavigation();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [chatEnabled, setChatEnabled] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTicketSubject, setNewTicketSubject] = useState('');
  const [newTicketMessage, setNewTicketMessage] = useState('');

  useFocusEffect(
    React.useCallback(() => {
      loadTickets('initial');
      checkChatEnabled();
      
      // Poll for ticket updates every 5 seconds
      const interval = setInterval(() => {
        loadTickets('silent'); // Silent refresh
      }, 5000);
      
      return () => clearInterval(interval);
    }, [])
  );

  const checkChatEnabled = async () => {
    try {
      const response = await apiService.getChatSettings();
      if (response.success && response.data) {
        setChatEnabled(response.data.support_chat_enabled);
      }
    } catch (error) {
      console.error('Check chat enabled error:', error);
    }
  };

  const loadTickets = async (mode: 'initial' | 'refresh' | 'silent' = 'initial') => {
    try {
      if (mode === 'initial') {
        setIsLoading(true);
      } else if (mode === 'refresh') {
        setIsRefreshing(true);
      }
      // 'silent' mode shows no loading indicators

      const response = await apiService.getChatTickets();

      if (response.success && response.data) {
        setTickets(response.data.tickets);
      } else {
        if (mode !== 'silent') {
          showToast.error('Error', response.message || 'Failed to load tickets');
        }
      }
    } catch (error) {
      console.error('Load tickets error:', error);
      if (mode !== 'silent') {
        showToast.error('Error', 'Failed to load conversations');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleCreateTicket = () => {
    if (!chatEnabled) {
      showToast.error('Unavailable', 'Chat support is currently disabled');
      return;
    }

    setNewTicketSubject('');
    setNewTicketMessage('');
    setShowCreateModal(true);
  };

  const handleSubmitCreateTicket = async () => {
    const subject = newTicketSubject.trim();
    const message = newTicketMessage.trim();

    if (!subject) {
      showToast.error('Required', 'Please enter a ticket subject');
      return;
    }

    if (!message) {
      showToast.error('Required', 'Please describe your issue');
      return;
    }

    await createTicket(subject, message);
  };

  const createTicket = async (subject: string, message: string) => {
    setIsCreating(true);

    try {
      const response = await apiService.createChatTicket({
        subject,
        message,
        priority: 'medium',
        category: 'General Inquiry',
      });

      if (response.success && response.data) {
        showToast.success('Success', 'Ticket created successfully');
        setShowCreateModal(false);
        setNewTicketSubject('');
        setNewTicketMessage('');
        
        // Navigate to the new ticket chat
        // @ts-ignore - Navigation types will be updated when screen is added to navigator
        navigation.navigate('Chat' as never, {
          ticketId: response.data.ticket.id,
          ticketNumber: response.data.ticket.ticket_number,
          subject: response.data.ticket.subject,
        } as never);
        
        // Reload tickets list
        loadTickets('silent');
      } else {
        showToast.error('Error', response.message || 'Failed to create ticket');
      }
    } catch (error: any) {
      console.error('Create ticket error:', error);
      
      if (error.response?.status === 429) {
        showToast.error('Limit Reached', 'You have reached the daily ticket limit. Please try again tomorrow.');
      } else {
        showToast.error('Error', 'Failed to create ticket');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleTicketPress = (ticket: SupportTicket) => {
    // @ts-ignore - Navigation types will be updated when screen is added to navigator
    navigation.navigate('Chat' as never, {
      ticketId: ticket.id,
      ticketNumber: ticket.ticket_number,
      subject: ticket.subject,
    } as never);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
      case 'in_progress':
        return Colors.primary;
      case 'waiting_customer':
        return Colors.warning;
      case 'resolved':
        return Colors.success;
      case 'closed':
        return Colors.textSecondary;
      default:
        return Colors.textSecondary;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open':
        return 'Open';
      case 'in_progress':
        return 'In Progress';
      case 'waiting_customer':
        return 'Waiting for You';
      case 'waiting_technician':
        return 'Waiting for Technician';
      case 'resolved':
        return 'Resolved';
      case 'closed':
        return 'Closed';
      default:
        return status;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return '#FF4444';
      case 'high':
        return Colors.error;
      case 'medium':
        return Colors.warning;
      case 'low':
        return Colors.success;
      default:
        return Colors.textSecondary;
    }
  };

  const renderTicket = ({ item }: { item: SupportTicket }) => {
    const hasUnread = item.unread_count > 0;

    return (
      <TouchableOpacity
        style={[styles.ticketCard, hasUnread && styles.ticketCardUnread]}
        onPress={() => handleTicketPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.ticketHeader}>
          <View style={styles.ticketHeaderLeft}>
            <Text style={[styles.ticketNumber, hasUnread && styles.ticketNumberUnread]}>
              {item.ticket_number}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
              <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                {getStatusLabel(item.status)}
              </Text>
            </View>
          </View>
          
          {hasUnread && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unread_count}</Text>
            </View>
          )}
        </View>

        <Text style={[styles.ticketSubject, hasUnread && styles.ticketSubjectUnread]} numberOfLines={2}>
          {item.subject}
        </Text>

        {item.last_message_preview && (
          <Text style={styles.lastMessage} numberOfLines={2}>
            {item.last_message_preview}
          </Text>
        )}

        <View style={styles.ticketFooter}>
          <View style={styles.ticketMetadata}>
            <Ionicons name="chatbubble-outline" size={14} color={Colors.textSecondary} />
            <Text style={styles.metadataText}>{item.message_count} messages</Text>
            
            {item.attachment_count > 0 && (
              <>
                <Ionicons name="attach" size={14} color={Colors.textSecondary} style={{ marginLeft: 12 }} />
                <Text style={styles.metadataText}>{item.attachment_count} files</Text>
              </>
            )}
          </View>

          <Text style={styles.ticketDate}>
            {formatDate(item.last_message_at || item.created_at)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="chatbubbles-outline" size={80} color={Colors.textSecondary} />
      <Text style={styles.emptyStateTitle}>No Conversations Yet</Text>
      <Text style={styles.emptyStateText}>
        Start a new conversation with our support team
      </Text>
      <TouchableOpacity
        style={styles.emptyStateButton}
        onPress={handleCreateTicket}
        disabled={isCreating}
      >
        {isCreating ? (
          <ActivityIndicator size="small" color={Colors.white} />
        ) : (
          <>
            <Ionicons name="add-circle" size={20} color={Colors.white} />
            <Text style={styles.emptyStateButtonText}>New Ticket</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  if (!chatEnabled) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <TopNavigation 
          title="Support" 
          subtitle="Get help from our team"
        />
        <View style={styles.disabledContainer}>
          <Ionicons name="close-circle" size={80} color={Colors.error} />
          <Text style={styles.disabledTitle}>Chat Support Unavailable</Text>
          <Text style={styles.disabledText}>
            Chat support is currently disabled. Please contact us via email or phone.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <TopNavigation 
        title="Support" 
        subtitle="Your conversations"
      />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading conversations...</Text>
        </View>
      ) : (
        <FlatList
          data={tickets}
          renderItem={renderTicket}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={[
            styles.listContainer,
            tickets.length === 0 && styles.listContainerEmpty,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadTickets('refresh')}
              colors={[Colors.primary]}
            />
          }
          ListEmptyComponent={renderEmptyState}
        />
      )}

      {!isLoading && tickets.length > 0 && (
        <TouchableOpacity
          style={styles.fab}
          onPress={handleCreateTicket}
          disabled={isCreating}
          activeOpacity={0.8}
        >
          {isCreating ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <Ionicons name="add" size={28} color={Colors.white} />
          )}
        </TouchableOpacity>
      )}

      <ConfirmationModal
        visible={showCreateModal}
        type="confirm"
        title="New Support Ticket"
        message="Tell us what you need help with."
        confirmText={isCreating ? 'Creating...' : 'Create Ticket'}
        cancelText="Cancel"
        onConfirm={() => void handleSubmitCreateTicket()}
        onCancel={() => setShowCreateModal(false)}
        confirmDisabled={isCreating}
      >
        <TextInput
          style={styles.modalInput}
          value={newTicketSubject}
          onChangeText={setNewTicketSubject}
          placeholder="Subject"
          placeholderTextColor={Colors.textSecondary}
          editable={!isCreating}
          maxLength={120}
        />

        <TextInput
          style={[styles.modalInput, styles.modalTextarea]}
          value={newTicketMessage}
          onChangeText={setNewTicketMessage}
          placeholder="Describe your issue..."
          placeholderTextColor={Colors.textSecondary}
          editable={!isCreating}
          multiline
          textAlignVertical="top"
          maxLength={2000}
        />
      </ConfirmationModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...CommonStyles.body,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  disabledContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  disabledTitle: {
    ...CommonStyles.h2,
    color: Colors.text,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  disabledText: {
    ...CommonStyles.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  listContainer: {
    padding: Spacing.md,
  },
  listContainerEmpty: {
    flex: 1,
  },
  ticketCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    position: 'relative',
    overflow: 'hidden',
  },
  ticketCardUnread: {
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  ticketHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: Spacing.sm,
  },
  ticketNumber: {
    ...CommonStyles.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  ticketNumberUnread: {
    color: Colors.primary,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusText: {
    ...CommonStyles.caption,
    fontWeight: '600',
    fontSize: 10,
  },
  unreadBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xs,
  },
  unreadText: {
    ...CommonStyles.caption,
    color: Colors.white,
    fontWeight: '700',
    fontSize: 12,
  },
  ticketSubject: {
    fontSize: Typography.md,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  ticketSubjectUnread: {
    fontWeight: '700',
  },
  lastMessage: {
    ...CommonStyles.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  ticketFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ticketMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  metadataText: {
    ...CommonStyles.caption,
    color: Colors.textSecondary,
  },
  ticketDate: {
    ...CommonStyles.caption,
    color: Colors.textSecondary,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyStateTitle: {
    ...CommonStyles.h2,
    color: Colors.text,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  emptyStateText: {
    ...CommonStyles.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 25,
    gap: Spacing.sm,
  },
  emptyStateButtonText: {
    fontSize: Typography.md,
    fontWeight: Typography.weights.bold,
    color: Colors.white,
  },
  fab: {
    position: 'absolute',
    bottom: Spacing.xl,
    right: Spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
  },
  modalInput: {
    ...CommonStyles.body,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.text,
  },
  modalTextarea: {
    minHeight: 120,
  },
});
