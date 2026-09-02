import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  Animated,
  Dimensions,
  Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Directory, File, Paths } from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import TopNavigation from '../components/TopNavigation';
import { showToast } from '../components/Toast';
import { Colors, Typography, CommonStyles, Spacing } from '../constants/Design';
import { apiService, API_BASE_URL } from '../services/api';
import { TicketMessage, TicketAttachment } from '../types/api';
import { renderFormattedText } from '../utils/textFormatter';

interface ChatScreenProps {
  route: {
    params: {
      ticketId: number;
      ticketNumber: string;
      subject: string;
    };
  };
  navigation: any;
}

type ReplyMeta = {
  messageId: number;
  senderName: string;
  snippet: string;
};

const REPLY_META_PREFIX = '[reply-meta]';
const REACTION_CHOICES = ['👍', '❤️', '😂', '😮', '🙏'];
const REACTION_STORAGE_KEY_PREFIX = 'chat_ticket_reactions_';
const DELETED_MESSAGE_SENTINEL = '[deleted-message]';
const DELETED_MESSAGE_TEXT = 'This message was deleted';
const INITIAL_MESSAGES_LIMIT = 25;
const OLDER_MESSAGES_PAGE_SIZE = 10;

type DisplayItem =
  | { type: 'separator'; key: string; label: string }
  | { type: 'message'; key: string; message: TicketMessage };

export default function ChatScreen({ route, navigation }: ChatScreenProps) {
  const { ticketId, ticketNumber, subject } = route.params;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [ticketStatus, setTicketStatus] = useState('open');
  const [isTyping, setIsTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingFeedback, setRatingFeedback] = useState('');
  const [existingRating, setExistingRating] = useState<any>(null);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState<number | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [replyTarget, setReplyTarget] = useState<ReplyMeta | null>(null);
  const [messageReactions, setMessageReactions] = useState<Record<number, string>>({});
  const [reactionsHydrated, setReactionsHydrated] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<TicketMessage | null>(null);
  const [showMessageActions, setShowMessageActions] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [showCloseTicketConfirmModal, setShowCloseTicketConfirmModal] = useState(false);
  const [showAttachmentActions, setShowAttachmentActions] = useState(false);
  const [viewerImageUrl, setViewerImageUrl] = useState<string | null>(null);
  const [iosKeyboardOffset, setIosKeyboardOffset] = useState(0);
  const [cachedAttachmentUris, setCachedAttachmentUris] = useState<Record<number, string>>({});
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const trayAnim = useRef(new Animated.Value(0)).current;
  const inflightAttachmentDownloads = useRef<Set<number>>(new Set());
  const messageWindowSizeRef = useRef(INITIAL_MESSAGES_LIMIT);
  const pendingScrollToEndRef = useRef(false);
  const pendingScrollAnimatedRef = useRef(false);
  const latestMessageIdRef = useRef<number | null>(null);
  
  const flatListRef = useRef<FlatList<DisplayItem>>(null);
  const attachmentAuthToken = apiService.getAuthToken();
  const attachmentImageHeaders = attachmentAuthToken
    ? {
      Authorization: `Bearer ${attachmentAuthToken}`,
    }
    : undefined;

  const getReactionStorageKey = (id: number) => `${REACTION_STORAGE_KEY_PREFIX}${id}`;

  const isMessageDeleted = (messageText: string) => messageText.trim() === DELETED_MESSAGE_SENTINEL;

  const getDateKey = (value: Date) => `${value.getFullYear()}-${value.getMonth()}-${value.getDate()}`;

  const getDateDividerLabel = (value: Date) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(value.getFullYear(), value.getMonth(), value.getDate());
    const diffDays = Math.round((today.getTime() - target.getTime()) / (24 * 60 * 60 * 1000));

    if (diffDays === 0) {
      return 'Today';
    }

    if (diffDays === 1) {
      return 'Yesterday';
    }

    return value.toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: value.getFullYear() === now.getFullYear() ? undefined : 'numeric',
    });
  };

  const decodeReplyMeta = (messageText: string): { reply: ReplyMeta | null; body: string } => {
    if (!messageText.startsWith(REPLY_META_PREFIX)) {
      return { reply: null, body: messageText };
    }

    const lineBreakIndex = messageText.indexOf('\n');
    if (lineBreakIndex < 0) {
      return { reply: null, body: messageText };
    }

    const encoded = messageText.slice(REPLY_META_PREFIX.length, lineBreakIndex).trim();
    try {
      const parsed = JSON.parse(decodeURIComponent(encoded)) as ReplyMeta;
      if (!parsed || typeof parsed.messageId !== 'number') {
        return { reply: null, body: messageText };
      }
      return {
        reply: {
          messageId: parsed.messageId,
          senderName: parsed.senderName || 'User',
          snippet: parsed.snippet || '',
        },
        body: messageText.slice(lineBreakIndex + 1),
      };
    } catch {
      try {
        const parsed = JSON.parse(decodeURIComponent(escape(globalThis.atob(encoded)))) as ReplyMeta;
        if (!parsed || typeof parsed.messageId !== 'number') {
          return { reply: null, body: messageText };
        }
        return {
          reply: {
            messageId: parsed.messageId,
            senderName: parsed.senderName || 'User',
            snippet: parsed.snippet || '',
          },
          body: messageText.slice(lineBreakIndex + 1),
        };
      } catch {
        return { reply: null, body: messageText };
      }
    }
  };

  const buildReplyPrefixedMessage = (messageText: string, reply: ReplyMeta | null): string => {
    if (!reply) {
      return messageText;
    }

    const payload = encodeURIComponent(JSON.stringify(reply));
    return `${REPLY_META_PREFIX}${payload}\n${messageText}`;
  };

  const canEditMessage = (message: TicketMessage) => {
    if (!message.is_own_message) {
      return false;
    }

    const createdAt = new Date(message.created_at).getTime();
    if (Number.isNaN(createdAt)) {
      return false;
    }

    return Date.now() - createdAt <= 5 * 60 * 1000;
  };

  useEffect(() => {
    messageWindowSizeRef.current = INITIAL_MESSAGES_LIMIT;
    pendingScrollToEndRef.current = true;
    pendingScrollAnimatedRef.current = false;
    latestMessageIdRef.current = null;
    setHasMoreMessages(false);
    setIsLoadingOlder(false);
    loadMessages({ showLoading: true, mode: 'replace', limit: INITIAL_MESSAGES_LIMIT });
    checkExistingRating(); // Check if ticket already has a rating
    
    // Poll for new messages every 5 seconds (silently)
    const messagesInterval = setInterval(() => {
      loadMessages({
        showLoading: false,
        mode: 'replace',
        limit: messageWindowSizeRef.current,
      });
    }, 5000);
    
    // Poll for typing indicators every 2 seconds
    const typingInterval = setInterval(() => {
      checkTypingIndicators();
    }, 2000);
    
    return () => {
      clearInterval(messagesInterval);
      clearInterval(typingInterval);
    };
  }, [ticketId]);

  useEffect(() => {
    let mounted = true;

    setReactionsHydrated(false);

    const loadStoredReactions = async () => {
      try {
        const raw = await AsyncStorage.getItem(getReactionStorageKey(ticketId));
        if (!mounted) {
          return;
        }
        if (!raw) {
          setMessageReactions({});
          setReactionsHydrated(true);
          return;
        }
        const parsed = JSON.parse(raw) as Record<number, string>;
        setMessageReactions(parsed && typeof parsed === 'object' ? parsed : {});
        setReactionsHydrated(true);
      } catch {
        if (mounted) {
          setMessageReactions({});
          setReactionsHydrated(true);
        }
      }
    };

    void loadStoredReactions();

    return () => {
      mounted = false;
    };
  }, [ticketId]);

  useEffect(() => {
    if (!reactionsHydrated) {
      return;
    }
    void AsyncStorage.setItem(getReactionStorageKey(ticketId), JSON.stringify(messageReactions));
  }, [ticketId, messageReactions, reactionsHydrated]);

  useEffect(() => {
    latestMessageIdRef.current = messages.length > 0 ? messages[messages.length - 1].id : null;
  }, [messages]);

  useEffect(() => {
    Animated.timing(trayAnim, {
      toValue: showAttachmentActions ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [showAttachmentActions]);

  useEffect(() => {
    if (Platform.OS !== 'ios') {
      return;
    }

    const updateOffset = (event: any) => {
      const keyboardHeight = event?.endCoordinates?.height || 0;
      setIosKeyboardOffset(Math.max(0, keyboardHeight - insets.bottom));
    };

    const showSubscription = Keyboard.addListener('keyboardWillShow', updateOffset);
    const changeFrameSubscription = Keyboard.addListener('keyboardWillChangeFrame', updateOffset);
    const hideSubscription = Keyboard.addListener('keyboardWillHide', () => {
      setIosKeyboardOffset(0);
    });

    return () => {
      showSubscription.remove();
      changeFrameSubscription.remove();
      hideSubscription.remove();
    };
  }, [insets.bottom]);

  useEffect(() => {
    if (Platform.OS !== 'android' || !attachmentAuthToken) {
      return;
    }

    const imageAttachments = messages.flatMap((message) =>
      (message.attachments || []).filter((attachment) => attachment.attachment_type === 'image')
    );

    if (imageAttachments.length === 0) {
      return;
    }

    const ensureCachedImages = async () => {
      const cacheDir = new Directory(Paths.cache, 'chat_attachments');
      cacheDir.create({ intermediates: true, idempotent: true });

      for (const attachment of imageAttachments) {
        if (cachedAttachmentUris[attachment.id] || inflightAttachmentDownloads.current.has(attachment.id)) {
          continue;
        }

        inflightAttachmentDownloads.current.add(attachment.id);

        try {
          const extension = attachment.file_name.includes('.')
            ? attachment.file_name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
            : 'jpg';
          const safeExtension = extension && extension.length > 0 ? extension : 'jpg';
          const targetFile = new File(cacheDir, `${attachment.id}.${safeExtension}`);

          if (targetFile.exists) {
            setCachedAttachmentUris((prev) => ({ ...prev, [attachment.id]: targetFile.uri }));
            continue;
          }

          const downloadUrl = buildAttachmentUrl(attachment.file_url);
          const downloadedFile = await File.downloadFileAsync(downloadUrl, targetFile, {
            headers: attachmentImageHeaders,
            idempotent: true,
          });
          setCachedAttachmentUris((prev) => ({ ...prev, [attachment.id]: downloadedFile.uri }));
        } catch (error) {
          console.error('Attachment image cache error:', error);
        } finally {
          inflightAttachmentDownloads.current.delete(attachment.id);
        }
      }
    };

    void ensureCachedImages();
  }, [messages, attachmentAuthToken, cachedAttachmentUris, attachmentImageHeaders]);

  const loadMessages = async (options?: {
    showLoading?: boolean;
    mode?: 'replace' | 'older';
    limit?: number;
    beforeMessageId?: number | null;
  }) => {
    const showLoading = options?.showLoading ?? true;
    const mode = options?.mode ?? 'replace';
    try {
      if (showLoading) {
        setIsLoading(true);
      }
      
      const response = await apiService.getChatTicketMessages(ticketId, {
        limit: options?.limit ?? messageWindowSizeRef.current,
        beforeMessageId: options?.beforeMessageId ?? null,
      });
      
      if (response.success && response.data) {
        // Map messages and add is_own_message property
        // Customer messages are "own messages", admin messages are "other messages"
        const messagesWithOwnership = response.data.messages.map(msg => ({
          ...msg,
          is_own_message: msg.sender_type === 'customer',
        }));
        const incomingLatestMessageId = messagesWithOwnership.length > 0
          ? messagesWithOwnership[messagesWithOwnership.length - 1].id
          : null;
        const shouldAnimateToLatest = mode === 'replace'
          && latestMessageIdRef.current !== null
          && incomingLatestMessageId !== null
          && incomingLatestMessageId !== latestMessageIdRef.current;

        const serverReactions = messagesWithOwnership.reduce<Record<number, string>>((acc, msg) => {
          if (msg.reaction) {
            acc[msg.id] = msg.reaction;
          }
          return acc;
        }, {});
        setHasMoreMessages(!!response.data.has_more);

        const previousStatus = ticketStatus;
        setTicketStatus(response.data.ticket.status);

        if (response.data.ticket.status === 'closed' && previousStatus !== 'closed' && !existingRating) {
          setTimeout(() => {
            setShowRatingModal(true);
          }, 1000);
        }

        if (mode === 'older') {
          setMessageReactions((prev) => ({ ...serverReactions, ...prev }));
          setMessages((prev) => {
            const existingIds = new Set(prev.map((message) => message.id));
            const olderMessages = messagesWithOwnership.filter((message) => !existingIds.has(message.id));
            return olderMessages.length > 0 ? [...olderMessages, ...prev] : prev;
          });
          messageWindowSizeRef.current += messagesWithOwnership.length;
        } else {
          setMessageReactions(serverReactions);
          if (JSON.stringify(messagesWithOwnership) !== JSON.stringify(messages)) {
            if (shouldAnimateToLatest) {
              pendingScrollToEndRef.current = true;
              pendingScrollAnimatedRef.current = true;
            }
            setMessages(messagesWithOwnership);
          }
        }
      } else {
        if (showLoading) {
          showToast.error('Error', response.message || 'Failed to load messages');
        }
      }
    } catch (error) {
      console.error('Load messages error:', error);
      if (showLoading) {
        showToast.error('Error', 'Failed to load conversation');
      }
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  };

  const handleLoadOlder = async () => {
    if (isLoadingOlder || !hasMoreMessages || messages.length === 0) {
      return;
    }

    setIsLoadingOlder(true);
    try {
      await loadMessages({
        showLoading: false,
        mode: 'older',
        limit: OLDER_MESSAGES_PAGE_SIZE,
        beforeMessageId: messages[0].id,
      });
    } finally {
      setIsLoadingOlder(false);
    }
  };
  const checkTypingIndicators = async () => {
    try {
      const response = await apiService.getTypingIndicator(ticketId, 'customer');
      
      if (response.success && response.data?.typing) {
        setIsTyping(response.data.typing.length > 0);
      }
    } catch (error) {
      // Silently fail
      console.error('Check typing error:', error);
    }
  };

  const sendTypingIndicator = async () => {
    try {
      await apiService.updateTypingIndicator(ticketId);
    } catch (error) {
      // Silently fail
      console.error('Send typing error:', error);
    }
  };

  const checkExistingRating = async () => {
    try {
      const response = await apiService.getTicketRating(ticketId);
      
      if (response.success && response.data?.rating) {
        setExistingRating(response.data.rating);
      }
    } catch (error) {
      console.error('Check rating error:', error);
    }
  };

  const handleSubmitRating = async () => {
    if (rating === 0) {
      showToast.error('Required', 'Please select a rating');
      return;
    }

    setIsSubmittingRating(true);

    try {
      const response = await apiService.submitTicketRating({
        ticket_id: ticketId,
        rating,
        feedback: ratingFeedback.trim() || null,
      });

      if (response.success) {
        showToast.success('Thank You!', 'Your rating has been submitted');
        setShowRatingModal(false);
        setExistingRating({ rating, feedback: ratingFeedback });
      } else {
        showToast.error('Error', response.message || 'Failed to submit rating');
      }
    } catch (error) {
      console.error('Submit rating error:', error);
      showToast.error('Error', 'Failed to submit rating');
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const handleInputChange = (text: string) => {
    // Check if a newline was just added (for auto-list formatting)
    if (text.length > inputText.length && text.endsWith('\n')) {
      const lines = text.slice(0, -1).split('\n'); // Remove the trailing newline for analysis
      const previousLine = lines[lines.length - 1];
      
      // Check for bullet list (starts with * or •)
      const bulletMatch = previousLine.match(/^(\s*)([*•-])\s+(.*)$/);
      if (bulletMatch) {
        const indent = bulletMatch[1];
        const content = bulletMatch[3];
        
        // If line is empty (just the bullet), remove it instead
        if (!content.trim()) {
          const beforeLine = lines.slice(0, -1).join('\n');
          setInputText(beforeLine + (beforeLine ? '\n' : ''));
          return;
        } else {
          // Add new bullet point
          setInputText(text + indent + '• ');
          return;
        }
      }
      
      // Check for numbered list (starts with number.)
      const numberedMatch = previousLine.match(/^(\s*)(\d+)\.\s+(.*)$/);
      if (numberedMatch) {
        const indent = numberedMatch[1];
        const currentNum = parseInt(numberedMatch[2]);
        const content = numberedMatch[3];
        
        // If line is empty (just the number), remove it instead
        if (!content.trim()) {
          const beforeLine = lines.slice(0, -1).join('\n');
          setInputText(beforeLine + (beforeLine ? '\n' : ''));
          return;
        } else {
          // Add next numbered item
          const nextNum = currentNum + 1;
          setInputText(text + indent + nextNum + '. ');
          return;
        }
      }
    }
    
    setInputText(text);
    
    // Send typing indicator
    sendTypingIndicator();
    
    // Clear previous timeout
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }
    
    // Set new timeout to stop typing indicator after 3 seconds
    const timeout = setTimeout(() => {
      // Timeout expired, typing indicator will automatically expire on backend
    }, 3000);
    
    setTypingTimeout(timeout);
  };
  const sendMessageText = async (messageText: string, options?: { restoreInputOnFail?: boolean }) => {
    const textToSend = messageText.trim();
    if (!textToSend || isSending) return;

    if (ticketStatus === 'closed') {
      showToast.error('Ticket Closed', 'This ticket is closed. Please create a new ticket.');
      return;
    }

    setIsSending(true);

    try {
      if (editingMessageId !== null) {
        const response = await apiService.updateChatMessage(ticketId, editingMessageId, textToSend);

        if (response.success) {
          setMessages((prev) => prev.map((msg) => (
            msg.id === editingMessageId
              ? { ...msg, message: textToSend }
              : msg
          )));
          setEditingMessageId(null);
          showToast.success('Updated', 'Message edited');
        } else {
          showToast.error('Error', response.message || 'Failed to edit message');
          if (options?.restoreInputOnFail) {
            setInputText(textToSend);
          }
        }
      } else {
        const payloadMessage = buildReplyPrefixedMessage(textToSend, replyTarget);
        const response = await apiService.sendChatMessage({
          ticket_id: ticketId,
          message: payloadMessage,
        });

        if (response.success) {
          pendingScrollToEndRef.current = true;
          pendingScrollAnimatedRef.current = true;
          await loadMessages({ showLoading: false, mode: 'replace', limit: messageWindowSizeRef.current });
          setReplyTarget(null);
        } else {
          showToast.error('Error', response.message || 'Failed to send message');
          if (options?.restoreInputOnFail) {
            setInputText(textToSend);
          }
        }
      }
    } catch (error) {
      console.error('Send message error:', error);
      showToast.error('Error', 'Failed to send message');
      if (options?.restoreInputOnFail) {
        setInputText(textToSend);
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleSendMessage = async () => {
    const messageText = inputText.trim();
    if (!messageText) return;

    setInputText('');
    await sendMessageText(messageText, { restoreInputOnFail: true });
  };

  const handleOptionButtonPress = async (optionText: string) => {
    if (!optionText.trim()) return;
    await sendMessageText(optionText);
  };

  const optimizeImageForUpload = async (uri: string, mimeType?: string) => {
    if (!mimeType?.startsWith('image/')) {
      return uri;
    }

    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1600 } }],
        {
          compress: 0.72,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );
      return result.uri;
    } catch (error) {
      console.error('Chat image optimization error:', error);
      return uri;
    }
  };

  const handlePickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permission.granted) {
        showToast.error('Permission Denied', 'Please allow photo access to send images');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const optimizedUri = await optimizeImageForUpload(asset.uri, asset.mimeType || 'image/jpeg');
        setShowAttachmentActions(false);
        await handleUploadFile(optimizedUri, asset.fileName || 'image.jpg');
      }
    } catch (error) {
      console.error('Pick image error:', error);
      showToast.error('Error', 'Failed to pick image');
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const optimizedUri = await optimizeImageForUpload(asset.uri, asset.mimeType);
        setShowAttachmentActions(false);
        await handleUploadFile(optimizedUri, asset.name);
      }
    } catch (error) {
      console.error('Pick document error:', error);
      showToast.error('Error', 'Failed to pick document');
    }
  };

  const handleUploadFile = async (fileUri: string, fileName: string) => {
    if (editingMessageId !== null) {
      showToast.error('Unavailable', 'Attachments are disabled while editing a message');
      return;
    }

    const pendingMessage = inputText.trim();
    if (pendingMessage) {
      setInputText('');
    }

    try {
      showToast.info('Uploading', 'Uploading file...');
      
      const payloadMessage = pendingMessage ? buildReplyPrefixedMessage(pendingMessage, replyTarget) : undefined;
      const response = await apiService.uploadChatAttachment(ticketId, fileUri, fileName, payloadMessage);
      
      if (response.success && response.data) {
        showToast.success('Success', 'File uploaded successfully');
        setReplyTarget(null);
        pendingScrollToEndRef.current = true;
        pendingScrollAnimatedRef.current = true;
        void loadMessages({ showLoading: false, mode: 'replace', limit: messageWindowSizeRef.current });
      } else {
        if (pendingMessage) {
          setInputText(pendingMessage);
        }
        showToast.error('Error', response.message || 'Failed to upload file');
      }
    } catch (error) {
      if (pendingMessage) {
        setInputText(pendingMessage);
      }
      console.error('Upload file error:', error);
      showToast.error('Error', 'Failed to upload file');
    }
  };

  const handleCloseTicket = () => {
    setShowCloseTicketConfirmModal(true);
  };

  const executeCloseTicket = async () => {
    try {
      const response = await apiService.closeChatTicket(ticketId);

      if (response.success) {
        showToast.success('Success', 'Ticket closed successfully');
        setTicketStatus('closed');
        navigation.goBack();
      } else {
        showToast.error('Error', response.message || 'Failed to close ticket');
      }
    } catch (error) {
      console.error('Close ticket error:', error);
      showToast.error('Error', 'Failed to close ticket');
    } finally {
      setShowCloseTicketConfirmModal(false);
    }
  };

  const executeDeleteMessage = async (messageId: number) => {
    try {
      setDeletingMessageId(messageId);
      const response = await apiService.deleteChatMessage(ticketId, messageId);
      if (response.success) {
        setMessages((prev) => prev.map((msg) => (
          msg.id === messageId
            ? {
              ...msg,
              message: DELETED_MESSAGE_SENTINEL,
              attachments: [],
              attachment_count: 0,
            }
            : msg
        )));
        if (editingMessageId === messageId) {
          setEditingMessageId(null);
          setInputText('');
        }
        if (replyTarget?.messageId === messageId) {
          setReplyTarget(null);
        }
        setMessageReactions((prev) => {
          if (!(messageId in prev)) return prev;
          const next = { ...prev };
          delete next[messageId];
          return next;
        });
        showToast.success('Deleted', 'Message deleted');
      } else {
        showToast.error('Error', response.message || 'Failed to delete message');
      }
    } catch (error) {
      console.error('Delete message error:', error);
      showToast.error('Error', 'Failed to delete message');
    } finally {
      setDeletingMessageId(null);
      setShowDeleteConfirmModal(false);
      setSelectedMessage(null);
    }
  };

  const handleOpenMessageActions = (message: TicketMessage) => {
    if (message.sender_type === 'system' || isMessageDeleted(decodeReplyMeta(message.message).body)) {
      return;
    }

    setSelectedMessage(message);
    setShowMessageActions(true);
  };

  const handleActionEdit = () => {
    if (!selectedMessage || !canEditMessage(selectedMessage)) {
      setShowMessageActions(false);
      return;
    }

    const parsed = decodeReplyMeta(selectedMessage.message);
    setEditingMessageId(selectedMessage.id);
    setReplyTarget(null);
    setInputText(parsed.body);
    setShowMessageActions(false);
  };

  const handleActionReply = () => {
    if (!selectedMessage) {
      return;
    }

    const parsed = decodeReplyMeta(selectedMessage.message);
    const snippet = parsed.body.replace(/\s+/g, ' ').trim().slice(0, 140);
    setReplyTarget({
      messageId: selectedMessage.id,
      senderName: selectedMessage.sender_name || 'User',
      snippet,
    });
    setEditingMessageId(null);
    setShowMessageActions(false);
  };

  const handleActionDownload = async () => {
    if (!selectedMessage || !selectedMessage.attachments || selectedMessage.attachments.length === 0) {
      setShowMessageActions(false);
      return;
    }

    setShowMessageActions(false);
    const first = selectedMessage.attachments[0];
    if (first.attachment_type === 'image') {
      setViewerImageUrl(buildAttachmentUrl(first.file_url));
      return;
    }

    showToast.info('Attachment', 'Preview for this file type is coming soon');
  };

  const handleActionReaction = async (emoji: string) => {
    if (!selectedMessage) {
      return;
    }

    const currentReaction = messageReactions[selectedMessage.id] || selectedMessage.reaction || '';
    const nextReaction = currentReaction === emoji ? '' : emoji;

    try {
      const response = await apiService.reactChatMessage(ticketId, selectedMessage.id, nextReaction);
      if (!response.success) {
        showToast.error('Error', response.message || 'Failed to react to message');
        return;
      }

      setMessageReactions((prev) => {
        const next = { ...prev };
        if (nextReaction) {
          next[selectedMessage.id] = nextReaction;
        } else {
          delete next[selectedMessage.id];
        }
        return next;
      });

      setMessages((prev) => prev.map((msg) => (
        msg.id === selectedMessage.id
          ? { ...msg, reaction: nextReaction || null }
          : msg
      )));

      setShowMessageActions(false);
    } catch (error) {
      console.error('React message error:', error);
      showToast.error('Error', 'Failed to react to message');
    }
  };

  const handleActionDelete = () => {
    if (!selectedMessage || !selectedMessage.is_own_message) {
      setShowMessageActions(false);
      return;
    }
    setShowMessageActions(false);
    setShowDeleteConfirmModal(true);
  };

  const buildAttachmentUrl = (fileUrl: string) => {
    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
      return fileUrl;
    }

    return `${API_BASE_URL.replace(/\/api$/, '')}${fileUrl}`;
  };

  const displayItems = useMemo<DisplayItem[]>(() => {
    const next: DisplayItem[] = [];
    let lastDateKey = '';

    messages.forEach((message) => {
      const createdAt = new Date(message.created_at);
      const safeDate = Number.isNaN(createdAt.getTime()) ? new Date() : createdAt;
      const dateKey = getDateKey(safeDate);

      if (dateKey !== lastDateKey) {
        next.push({
          type: 'separator',
          key: `sep-${dateKey}`,
          label: getDateDividerLabel(safeDate),
        });
        lastDateKey = dateKey;
      }

      next.push({
        type: 'message',
        key: `msg-${message.id}`,
        message,
      });
    });

    return next;
  }, [messages]);

  const jumpToMessage = (messageId: number) => {
    const index = displayItems.findIndex((item) => item.type === 'message' && item.message.id === messageId);
    if (index < 0) {
      showToast.info('Not found', 'Original message is not available in this thread');
      return;
    }

    flatListRef.current?.scrollToIndex({
      index,
      animated: true,
      viewPosition: 0.5,
    });
  };

  const renderLoadOlderControl = () => {
    if (!hasMoreMessages && !isLoadingOlder) {
      return null;
    }

    return (
      <View style={styles.loadOlderContainer}>
        <TouchableOpacity
          style={[styles.loadOlderButton, isLoadingOlder && styles.loadOlderButtonDisabled]}
          onPress={() => void handleLoadOlder()}
          disabled={isLoadingOlder}
          activeOpacity={0.85}
        >
          {isLoadingOlder ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Text style={styles.loadOlderButtonText}>Load older</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderAttachmentBlock = (attachments: TicketAttachment[], isOwnMessage: boolean) => {
    const imageAttachments = attachments.filter((attachment) => attachment.attachment_type === 'image');
    const fileAttachments = attachments.filter((attachment) => attachment.attachment_type !== 'image');
    const showTwoColumnGrid = imageAttachments.length > 1;

    return (
      <View style={styles.attachmentsContainer}>
        {imageAttachments.length > 0 && (
          <View style={styles.imageGrid}>
            {imageAttachments.map((attachment) => (
              <TouchableOpacity
                key={attachment.id}
                activeOpacity={0.9}
                onPress={() => setViewerImageUrl(cachedAttachmentUris[attachment.id] || buildAttachmentUrl(attachment.file_url))}
                style={[
                  styles.imageTile,
                  showTwoColumnGrid ? styles.imageTileHalf : styles.imageTileFull,
                ]}
              >
                <Image
                  source={{
                    uri: cachedAttachmentUris[attachment.id] || buildAttachmentUrl(attachment.file_url),
                    headers: attachmentImageHeaders,
                  }}
                  style={styles.imagePreview}
                  resizeMode="cover"
                  onError={(event) => {
                    console.error('Chat attachment image render error:', {
                      attachmentId: attachment.id,
                      uri: cachedAttachmentUris[attachment.id] || buildAttachmentUrl(attachment.file_url),
                      error: event.nativeEvent,
                    });
                  }}
                />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {fileAttachments.map((attachment) => (
          <TouchableOpacity
            key={attachment.id}
            style={styles.attachmentItem}
            onPress={() => {
              // TODO: Open attachment viewer/downloader
            }}
          >
            <Ionicons
              name={attachment.attachment_type === 'pdf' ? 'document-text' : 'attach'}
              size={16}
              color={isOwnMessage ? Colors.white : Colors.primary}
            />
            <Text
              style={[
                styles.attachmentName,
                isOwnMessage ? styles.attachmentNameOwn : styles.attachmentNameOther,
              ]}
              numberOfLines={1}
            >
              {attachment.file_name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderConversationItem = ({ item }: { item: DisplayItem }) => {
    if (item.type === 'separator') {
      return (
        <View style={styles.dateSeparatorContainer}>
          <Text style={styles.dateSeparatorText}>{item.label}</Text>
        </View>
      );
    }

    const messageItem = item.message;
    const isOwnMessage = messageItem.is_own_message;
    const isSystemMessage = messageItem.sender_type === 'system';
    const parsedMessage = decodeReplyMeta(messageItem.message);
    const isDeletedMessage = isMessageDeleted(parsedMessage.body);
    const messageText = isDeletedMessage ? DELETED_MESSAGE_TEXT : parsedMessage.body;
    const replyMeta = parsedMessage.reply;
    const reaction = messageReactions[messageItem.id] || messageItem.reaction || undefined;

    // System messages (centered)
    if (isSystemMessage) {
      return (
        <View style={styles.systemMessageContainer}>
          <View style={styles.systemMessageBubble}>
            <Text style={styles.systemMessageText}>{messageText}</Text>
          </View>
        </View>
      );
    }

    // Regular messages (customer or admin)
    return (
      <View style={[
        styles.messageContainer,
        isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer,
      ]}>
        {/* Avatar */}
        {!isOwnMessage && (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {messageItem.sender_name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        <View style={styles.messageContent}>
          {/* Sender Name */}
          <Text style={[
            styles.senderName,
            isOwnMessage ? styles.ownSenderName : styles.otherSenderName,
          ]}>
            {messageItem.sender_name}
          </Text>

          {/* Message Bubble */}
          <TouchableOpacity
            activeOpacity={0.9}
            onLongPress={() => handleOpenMessageActions(messageItem)}
            delayLongPress={350}
            disabled={deletingMessageId === messageItem.id || isDeletedMessage}
            style={[
              styles.messageBubble,
              reaction && styles.messageBubbleWithReaction,
              isOwnMessage ? styles.ownMessage : styles.otherMessage,
            ]}
          >
            {replyMeta && !isDeletedMessage && (
              <TouchableOpacity
                style={[
                  styles.replyPreview,
                  isOwnMessage ? styles.replyPreviewOwn : styles.replyPreviewOther,
                ]}
                onPress={() => jumpToMessage(replyMeta.messageId)}
                activeOpacity={0.85}
              >
                <Text style={[styles.replyPreviewSender, isOwnMessage ? styles.replyPreviewSenderOwn : styles.replyPreviewSenderOther]}>
                  {replyMeta.senderName}
                </Text>
                <Text style={[styles.replyPreviewText, isOwnMessage ? styles.replyPreviewTextOwn : styles.replyPreviewTextOther]} numberOfLines={1}>
                  {replyMeta.snippet}
                </Text>
              </TouchableOpacity>
            )}

            <View style={styles.formattedMessageContainer}>
              {isDeletedMessage ? (
                <Text style={[styles.deletedMessageText, isOwnMessage ? styles.deletedMessageTextOwn : styles.deletedMessageTextOther]}>
                  {DELETED_MESSAGE_TEXT}
                </Text>
              ) : (
                renderFormattedText(messageText, {
                  baseStyle: styles.messageText,
                  color: isOwnMessage ? Colors.white : Colors.text,
                  allowOptions: !isOwnMessage,
                  onOptionPress: !isOwnMessage ? (optionText: string) => {
                    void handleOptionButtonPress(optionText);
                  } : undefined,
                })
              )}
            </View>

            {!isDeletedMessage && messageItem.attachments && messageItem.attachments.length > 0 && renderAttachmentBlock(messageItem.attachments, isOwnMessage)}

            {reaction && !isDeletedMessage && (
              <View style={[styles.reactionBadge, isOwnMessage ? styles.reactionBadgeOwn : styles.reactionBadgeOther]}>
                <Text style={styles.reactionBadgeText}>{reaction}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Timestamp and persisted Freshdesk delivery state */}
          <View style={[
            styles.messageMeta,
            isOwnMessage ? styles.ownMessageMeta : styles.otherMessageMeta,
          ]}>
            <Text style={[
              styles.messageTime,
              isOwnMessage ? styles.ownMessageTime : styles.otherMessageTime,
            ]}>
              {new Date(messageItem.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {isOwnMessage && !isDeletedMessage && (
              <Ionicons
                name={messageItem.delivery_status === 'delivered' ? 'checkmark-done' : 'checkmark'}
                size={15}
                color={messageItem.delivery_status === 'delivered' ? Colors.primary : Colors.textMuted}
                accessibilityLabel={messageItem.delivery_status === 'delivered'
                  ? 'Delivered to Freshdesk'
                  : 'Saved locally, waiting to send'}
              />
            )}
          </View>
        </View>

        {/* Avatar for own messages */}
        {isOwnMessage && (
          <View style={[styles.avatar, styles.ownAvatar]}>
            <Text style={[styles.avatarText, styles.ownAvatarText]}>
              {messageItem.sender_name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <TopNavigation 
        title={ticketNumber}
        subtitle={subject}
        showBackButton
        onBackPress={() => navigation.goBack()}
      />

      {ticketStatus === 'closed' && (
        <View style={styles.closedBanner}>
          <Ionicons name="lock-closed" size={16} color={Colors.white} />
          <Text style={styles.closedBannerText}>This ticket is closed</Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading conversation...</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={displayItems}
          renderItem={renderConversationItem}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.messagesList}
          ListHeaderComponent={renderLoadOlderControl}
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          onContentSizeChange={() => {
            if (!pendingScrollToEndRef.current) {
              return;
            }

            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: pendingScrollAnimatedRef.current });
              pendingScrollToEndRef.current = false;
              pendingScrollAnimatedRef.current = false;
            }, 60);
          }}
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              flatListRef.current?.scrollToIndex({
                index: info.index,
                animated: true,
                viewPosition: 0.5,
              });
            }, 200);
          }}
        />
      )}

      {/* Typing Indicator */}
      {isTyping && (
        <View style={styles.typingIndicator}>
          <View style={styles.typingDots}>
            <View style={[styles.typingDot, styles.typingDot1]} />
            <View style={[styles.typingDot, styles.typingDot2]} />
            <View style={[styles.typingDot, styles.typingDot3]} />
          </View>
          <Text style={styles.typingText}>Support is typing...</Text>
        </View>
      )}

      <View
        style={[
          styles.composerWrapper,
          Platform.OS === 'ios' && iosKeyboardOffset > 0
            ? { marginBottom: iosKeyboardOffset }
            : null,
        ]}
      >
        {editingMessageId !== null && (
          <View style={styles.editorBanner}>
            <View style={styles.editorBannerContent}>
              <Ionicons name="create-outline" size={14} color={Colors.warning} />
              <Text style={styles.editorBannerText}>Editing message (5-minute limit)</Text>
            </View>
            <TouchableOpacity
              style={styles.editorBannerAction}
              onPress={() => {
                setEditingMessageId(null);
                setInputText('');
              }}
            >
              <Text style={styles.editorBannerActionText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {replyTarget && editingMessageId === null && (
          <View style={styles.replyBanner}>
            <View style={styles.replyBannerContent}>
              <Ionicons name="return-up-forward-outline" size={14} color={Colors.primary} />
              <Text style={styles.replyBannerText} numberOfLines={1}>
                Replying to {replyTarget.senderName}: {replyTarget.snippet}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.editorBannerAction}
              onPress={() => setReplyTarget(null)}
            >
              <Text style={styles.editorBannerActionText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Formatting Hint */}
        {inputText.length > 0 && (
          <View style={styles.formattingHint}>
            <Text style={styles.formattingHintText}>
              *bold* _italic_ ~strike~ • bullets 1. numbered {'>'} option • Press Enter to continue lists
            </Text>
          </View>
        )}

        {ticketStatus !== 'closed' && (
          <Animated.View
            style={[
              styles.attachmentTray,
              {
                height: trayAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 84],
                }),
                opacity: trayAnim,
                transform: [
                  {
                    translateY: trayAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [16, 0],
                    }),
                  },
                ],
              },
            ]}
            pointerEvents={showAttachmentActions ? 'auto' : 'none'}
          >
            <TouchableOpacity
              style={styles.attachmentTrayButton}
              onPress={handlePickImage}
            >
              <View style={[styles.attachmentTrayIcon, { backgroundColor: Colors.primary + '18' }]}>
                <Ionicons name="image" size={20} color={Colors.primary} />
              </View>
              <Text style={styles.attachmentTrayLabel}>Image</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.attachmentTrayButton}
              onPress={handlePickDocument}
            >
              <View style={[styles.attachmentTrayIcon, { backgroundColor: Colors.success + '18' }]}>
                <Ionicons name="document-text-outline" size={20} color={Colors.success} />
              </View>
              <Text style={styles.attachmentTrayLabel}>Document</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        <View style={styles.inputContainer}>
          <TouchableOpacity 
            style={styles.attachLauncherButton}
            onPress={() => setShowAttachmentActions((prev) => !prev)}
            disabled={ticketStatus === 'closed' || editingMessageId !== null}
          >
            <Ionicons
              name={showAttachmentActions ? 'close' : 'add'}
              size={24}
              color={ticketStatus === 'closed' || editingMessageId !== null ? Colors.textSecondary : Colors.primary}
            />
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder={ticketStatus === 'closed' ? 'Ticket closed' : (editingMessageId !== null ? 'Edit your message...' : 'Type your message...')}
            placeholderTextColor={Colors.textSecondary}
            value={inputText}
            onChangeText={handleInputChange}
            multiline
            maxLength={1000}
            editable={ticketStatus !== 'closed'}
          />

          <TouchableOpacity 
            style={[
              styles.sendButton,
              (!inputText.trim() || isSending || ticketStatus === 'closed') && styles.sendButtonDisabled
            ]}
            onPress={handleSendMessage}
            disabled={!inputText.trim() || isSending || ticketStatus === 'closed'}
          >
            {isSending ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Ionicons name="send" size={20} color={Colors.white} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Rating Modal */}
      {showRatingModal && !existingRating && (
        <View style={styles.modalOverlay}>
          <View style={styles.ratingModal}>
            <Text style={styles.ratingTitle}>Rate Your Experience</Text>
            <Text style={styles.ratingSubtitle}>How was your support experience?</Text>
            
            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setRating(star)}
                  style={styles.starButton}
                >
                  <Ionicons
                    name={star <= rating ? 'star' : 'star-outline'}
                    size={40}
                    color={star <= rating ? '#FFD700' : Colors.textSecondary}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.feedbackInput}
              placeholder="Additional feedback (optional)"
              placeholderTextColor={Colors.textSecondary}
              value={ratingFeedback}
              onChangeText={setRatingFeedback}
              multiline
              numberOfLines={3}
              maxLength={500}
            />

            <View style={styles.ratingButtonsContainer}>
              <TouchableOpacity
                style={[styles.ratingButton, styles.skipButton]}
                onPress={() => setShowRatingModal(false)}
              >
                <Text style={styles.skipButtonText}>Skip</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.ratingButton, styles.submitButton, rating === 0 && styles.submitButtonDisabled]}
                onPress={handleSubmitRating}
                disabled={isSubmittingRating || rating === 0}
              >
                {isSubmittingRating ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.submitButtonText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Full-Screen Image Viewer */}
      {viewerImageUrl !== null && (
        <Modal
          transparent={false}
          animationType="fade"
          onRequestClose={() => setViewerImageUrl(null)}
        >
          <View style={styles.imageViewerContainer}>
            <TouchableOpacity
              style={styles.imageViewerClose}
              onPress={() => setViewerImageUrl(null)}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.imageViewerScrollContent}
              maximumZoomScale={4}
              minimumZoomScale={1}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              centerContent
              bouncesZoom
            >
              <Image
                source={{
                  uri: viewerImageUrl,
                  headers: attachmentImageHeaders,
                }}
                style={styles.imageViewerImage}
                resizeMode="contain"
              />
            </ScrollView>
          </View>
        </Modal>
      )}

      {showMessageActions && selectedMessage && (
        <Modal
          transparent
          animationType="fade"
          onRequestClose={() => setShowMessageActions(false)}
        >
          <View style={styles.actionSheetOverlay}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowMessageActions(false)} />
            <View style={styles.actionSheet}>
              <Text style={styles.actionSheetTitle}>Message Actions</Text>

              <View style={styles.reactionRow}>
                {REACTION_CHOICES.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    style={styles.reactionButton}
                    onPress={() => { void handleActionReaction(emoji); }}
                  >
                    <Text style={styles.reactionButtonText}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {canEditMessage(selectedMessage) && (
                <TouchableOpacity style={styles.actionButton} onPress={handleActionEdit}>
                  <Ionicons name="create-outline" size={18} color={Colors.text} />
                  <Text style={styles.actionButtonText}>Edit (within 5 min)</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.actionButton} onPress={handleActionReply}>
                <Ionicons name="return-up-forward-outline" size={18} color={Colors.text} />
                <Text style={styles.actionButtonText}>Reply</Text>
              </TouchableOpacity>

              {selectedMessage.attachments && selectedMessage.attachments.length > 0 && (
                <TouchableOpacity style={styles.actionButton} onPress={handleActionDownload}>
                  <Ionicons name="download-outline" size={18} color={Colors.text} />
                  <Text style={styles.actionButtonText}>Download attachments</Text>
                </TouchableOpacity>
              )}

              {selectedMessage.is_own_message && (
                <TouchableOpacity style={styles.actionButton} onPress={handleActionDelete}>
                  <Ionicons name="trash-outline" size={18} color={Colors.error} />
                  <Text style={[styles.actionButtonText, { color: Colors.error }]}>Delete message</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Modal>
      )}

      {showDeleteConfirmModal && selectedMessage && (
        <Modal
          transparent
          animationType="fade"
          onRequestClose={() => setShowDeleteConfirmModal(false)}
        >
          <View style={styles.confirmOverlay}>
            <View style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>Delete Message</Text>
              <Text style={styles.confirmText}>Delete this message? This cannot be undone.</Text>
              <View style={styles.confirmActions}>
                <TouchableOpacity style={styles.confirmSecondary} onPress={() => setShowDeleteConfirmModal(false)}>
                  <Text style={styles.confirmSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.confirmDanger}
                  onPress={() => void executeDeleteMessage(selectedMessage.id)}
                  disabled={deletingMessageId !== null}
                >
                  <Text style={styles.confirmDangerText}>{deletingMessageId !== null ? 'Deleting...' : 'Delete'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {showCloseTicketConfirmModal && (
        <Modal
          transparent
          animationType="fade"
          onRequestClose={() => setShowCloseTicketConfirmModal(false)}
        >
          <View style={styles.confirmOverlay}>
            <View style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>Close Ticket</Text>
              <Text style={styles.confirmText}>Are you sure you want to close this ticket?</Text>
              <View style={styles.confirmActions}>
                <TouchableOpacity style={styles.confirmSecondary} onPress={() => setShowCloseTicketConfirmModal(false)}>
                  <Text style={styles.confirmSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmDanger} onPress={() => void executeCloseTicket()}>
                  <Text style={styles.confirmDangerText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
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
  closedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.error,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  closedBannerText: {
    fontSize: Typography.md,
    fontWeight: Typography.weights.bold,
    color: Colors.white,
  },
  messagesList: {
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  dateSeparatorContainer: {
    alignItems: 'center',
    marginBottom: Spacing.md,
    marginTop: Spacing.xs,
  },
  dateSeparatorText: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    backgroundColor: Colors.backgroundAlt,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
    maxWidth: '85%',
  },
  ownMessageContainer: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  otherMessageContainer: {
    alignSelf: 'flex-start',
  },
  messageContent: {
    flex: 1,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary + '30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ownAvatar: {
    backgroundColor: Colors.primary,
  },
  avatarText: {
    fontSize: Typography.xs,
    fontWeight: Typography.weights.bold,
    color: Colors.primary,
  },
  ownAvatarText: {
    color: Colors.white,
  },
  senderName: {
    fontSize: Typography.xs,
    fontWeight: '600',
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  ownSenderName: {
    color: Colors.textSecondary,
    textAlign: 'right',
  },
  otherSenderName: {
    color: Colors.textSecondary,
  },
  messageBubble: {
    padding: Spacing.md,
    borderRadius: 16,
    position: 'relative',
  },
  messageBubbleWithReaction: {
    marginBottom: 10,
  },
  ownMessage: {
    backgroundColor: Colors.primary,
    borderTopRightRadius: 4,
  },
  otherMessage: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  messageText: {
    ...CommonStyles.body,
    lineHeight: 20,
  },
  deletedMessageText: {
    ...CommonStyles.body,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  deletedMessageTextOwn: {
    color: 'rgba(255,255,255,0.88)',
  },
  deletedMessageTextOther: {
    color: Colors.textSecondary,
  },
  formattedMessageContainer: {
    width: '100%',
  },
  ownMessageText: {
    color: Colors.white,
  },
  otherMessageText: {
    color: Colors.text,
  },
  messageTime: {
    fontSize: Typography.xs,
    paddingHorizontal: 4,
  },
  messageMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 4,
  },
  ownMessageMeta: {
    justifyContent: 'flex-end',
  },
  otherMessageMeta: {
    justifyContent: 'flex-start',
  },
  ownMessageTime: {
    color: Colors.textSecondary,
    textAlign: 'right',
  },
  otherMessageTime: {
    color: Colors.textSecondary,
  },
  replyPreview: {
    borderRadius: 10,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  replyPreviewOwn: {
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  replyPreviewOther: {
    backgroundColor: Colors.backgroundAlt,
  },
  replyPreviewSender: {
    fontSize: Typography.xs,
    fontWeight: Typography.weights.semibold,
    marginBottom: 2,
  },
  replyPreviewSenderOwn: {
    color: Colors.white,
  },
  replyPreviewSenderOther: {
    color: Colors.primary,
  },
  replyPreviewText: {
    fontSize: Typography.xs,
  },
  replyPreviewTextOwn: {
    color: Colors.white,
  },
  replyPreviewTextOther: {
    color: Colors.textSecondary,
  },
  reactionBadge: {
    position: 'absolute',
    bottom: -12,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.background,
    zIndex: 5,
  },
  reactionBadgeOwn: {
    backgroundColor: Colors.white,
    right: 10,
  },
  reactionBadgeOther: {
    backgroundColor: Colors.white,
    left: 10,
  },
  reactionBadgeText: {
    fontSize: 14,
  },
  editorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  editorBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  editorBannerText: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
  },
  editorBannerAction: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  editorBannerActionText: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontWeight: Typography.weights.medium,
  },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  replyBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  replyBannerText: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    flex: 1,
  },
  actionSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: Spacing.md,
    gap: Spacing.xs,
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  actionSheetTitle: {
    ...CommonStyles.body,
    fontWeight: Typography.weights.semibold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  reactionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  reactionButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reactionButtonText: {
    fontSize: 18,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: 8,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionButtonText: {
    ...CommonStyles.body,
    color: Colors.text,
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  confirmTitle: {
    ...CommonStyles.h2,
    color: Colors.text,
  },
  confirmText: {
    ...CommonStyles.body,
    color: Colors.textSecondary,
  },
  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  confirmSecondary: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  confirmSecondaryText: {
    ...CommonStyles.body,
    color: Colors.textSecondary,
  },
  confirmDanger: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    backgroundColor: Colors.error,
  },
  confirmDangerText: {
    ...CommonStyles.body,
    color: Colors.white,
    fontWeight: Typography.weights.semibold,
  },
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: Spacing.md,
  },
  systemMessageBubble: {
    backgroundColor: Colors.backgroundAlt || Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 16,
  },
  systemMessageText: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
  },
  attachmentsContainer: {
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  imageTile: {
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: Colors.background,
  },
  imageTileFull: {
    width: '100%',
    aspectRatio: 1,
  },
  imageTileHalf: {
    width: '49%',
    aspectRatio: 1,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    gap: Spacing.xs,
  },
  attachmentName: {
    ...CommonStyles.caption,
    flex: 1,
  },
  attachmentNameOwn: {
    color: Colors.white,
  },
  attachmentNameOther: {
    color: Colors.text,
  },
  formattingHint: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  formattingHintText: {
    fontSize: Typography.xs - 1,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  attachmentTray: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    overflow: 'hidden',
  },
  attachmentTrayButton: {
    alignItems: 'center',
    gap: 6,
  },
  attachmentTrayIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachmentTrayLabel: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontWeight: Typography.weights.medium,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.sm,
  },
  composerWrapper: {
    backgroundColor: Colors.surface,
  },
  attachLauncherButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  input: {
    flex: 1,
    ...CommonStyles.body,
    backgroundColor: Colors.background,
    borderRadius: 20,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: Colors.textSecondary,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.background,
    gap: Spacing.sm,
  },
  typingDots: {
    flexDirection: 'row',
    gap: 4,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.textSecondary,
  },
  typingDot1: {
    opacity: 0.4,
  },
  typingDot2: {
    opacity: 0.6,
  },
  typingDot3: {
    opacity: 0.8,
  },
  typingText: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  loadOlderContainer: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  loadOlderButton: {
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 999,
    backgroundColor: Colors.backgroundAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  loadOlderButtonDisabled: {
    opacity: 0.7,
  },
  loadOlderButtonText: {
    ...CommonStyles.caption,
    color: Colors.primary,
    fontWeight: Typography.weights.semibold,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  ratingModal: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 400,
  },
  ratingTitle: {
    ...CommonStyles.h2,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  ratingSubtitle: {
    ...CommonStyles.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  starButton: {
    padding: Spacing.xs,
  },
  feedbackInput: {
    ...CommonStyles.body,
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    minHeight: 80,
    textAlignVertical: 'top',
    color: Colors.text,
  },
  ratingButtonsContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  ratingButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipButton: {
    backgroundColor: Colors.background,
  },
  skipButtonText: {
    ...CommonStyles.body,
    fontWeight: Typography.weights.semibold,
    color: Colors.textSecondary,
  },
  submitButton: {
    backgroundColor: Colors.primary,
  },
  submitButtonDisabled: {
    backgroundColor: Colors.textSecondary,
  },
  submitButtonText: {
    ...CommonStyles.body,
    fontWeight: Typography.weights.semibold,
    color: Colors.white,
  },
  imageViewerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  imageViewerClose: {
    position: 'absolute',
    top: 52,
    right: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerScrollContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
});
