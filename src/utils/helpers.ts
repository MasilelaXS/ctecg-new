import { Platform } from 'react-native';
import * as Device from 'expo-device';

// Get a unique device ID
export function getDeviceId(): string {
  if (Platform.OS === 'ios') {
    // For iOS, we can use the device name + model as a fallback
    return `ios_${Device.deviceName}_${Device.modelName}`.replace(/\s+/g, '_');
  } else {
    // For Android, we can use device info
    return `android_${Device.modelName}_${Device.brand}`.replace(/\s+/g, '_');
  }
}

// Format currency values
export function formatCurrency(amount: string | number): string {
  const numValue = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `R${numValue.toFixed(2)}`;
}

// Format data usage values
export function formatDataUsage(usage: string): string {
  if (usage.includes('GB')) {
    return usage;
  }
  
  const numValue = parseFloat(usage);
  if (numValue >= 1024) {
    return `${(numValue / 1024).toFixed(2)}GB`;
  }
  return `${numValue.toFixed(2)}MB`;
}

// Format date strings
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Generate ticket number
export function generateTicketNumber(): string {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
  const timeStr = now.getTime().toString().slice(-4);
  return `CTECG-${dateStr}-${timeStr}`;
}

// Validate email
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate phone number (South African format)
export function isValidPhoneNumber(phone: string): boolean {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Check for SA mobile numbers (10 digits starting with 0, or 11 digits starting with 27)
  return /^(0[6-8][0-9]{8}|27[6-8][0-9]{8})$/.test(cleaned);
}

// Get priority color
export function getPriorityColor(priority: string): string {
  switch (priority.toLowerCase()) {
    case 'urgent':
      return '#dc3545'; // Red
    case 'high':
      return '#fd7e14'; // Orange
    case 'medium':
      return '#ffc107'; // Yellow
    case 'low':
      return '#28a745'; // Green
    default:
      return '#6c757d'; // Gray
  }
}

// Get status color
export function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'active':
    case 'open':
    case 'resolved':
      return '#28a745'; // Green
    case 'in-progress':
    case 'investigating':
    case 'fixing':
      return '#ffc107'; // Yellow
    case 'inactive':
    case 'closed':
      return '#6c757d'; // Gray
    case 'suspended':
    case 'reported':
      return '#dc3545'; // Red
    default:
      return '#6c757d'; // Gray
  }
}

// Truncate text
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}

// Parse usage percentage
export function calculateUsagePercentage(used: string, total: string): number {
  const usedNum = parseFloat(used.replace(/[^\d.]/g, ''));
  const totalNum = parseFloat(total.replace(/[^\d.]/g, ''));
  
  if (totalNum === 0) return 0;
  
  return Math.min((usedNum / totalNum) * 100, 100);
}

// Format time remaining
export function formatTimeRemaining(dateString: string): string {
  const targetDate = new Date(dateString);
  const now = new Date();
  const diffMs = targetDate.getTime() - now.getTime();
  
  if (diffMs <= 0) {
    return 'Overdue';
  }
  
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} remaining`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} remaining`;
  } else {
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${minutes} minute${minutes > 1 ? 's' : ''} remaining`;
  }
}
