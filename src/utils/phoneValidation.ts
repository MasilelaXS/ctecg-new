/**
 * South African Phone Number Validation and Formatting
 * 
 * Valid formats:
 * - 0769790642 (local format, 10 digits)
 * - +27769790642 (international format, 11 digits with +27)
 * - 27769790642 (international without +, 11 digits)
 * 
 * Mobile prefixes: 06x, 07x, 08x (Vodacom, MTN, Cell C, Telkom, etc.)
 */

export interface PhoneValidationResult {
  isValid: boolean;
  formatted: string; // Always in +27 format
  local: string; // Always in 0 format
  error?: string;
}

const SA_MOBILE_PREFIXES = [
  '060', '061', '062', '063', '064', '065', '066', '067', '068', '069', // Various operators
  '071', '072', '073', '074', '076', '078', '079', // MTN, Vodacom, Cell C
  '081', '082', '083', '084', // Vodacom, MTN
];

/**
 * Normalize phone number to international format (+27XXXXXXXXX)
 */
export function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // If starts with +27, keep it
  if (cleaned.startsWith('+27')) {
    return cleaned;
  }
  
  // If starts with 27 (no +), add the +
  if (cleaned.startsWith('27') && cleaned.length === 11) {
    return '+' + cleaned;
  }
  
  // If starts with 0, replace with +27
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    return '+27' + cleaned.substring(1);
  }
  
  // If no prefix, assume it's missing the 0 and add +27
  if (cleaned.length === 9) {
    return '+27' + cleaned;
  }
  
  return cleaned;
}

/**
 * Convert to local format (0XXXXXXXXX)
 */
export function toLocalFormat(phone: string): string {
  const normalized = normalizePhoneNumber(phone);
  
  if (normalized.startsWith('+27')) {
    return '0' + normalized.substring(3);
  }
  
  return phone;
}

/**
 * Format phone number for display (0XX XXX XXXX)
 */
export function formatPhoneForDisplay(phone: string): string {
  const local = toLocalFormat(phone);
  
  // Remove any non-digits
  const digits = local.replace(/\D/g, '');
  
  if (digits.length !== 10) {
    return phone; // Return as-is if not valid length
  }
  
  // Format as 0XX XXX XXXX
  return `${digits.substring(0, 3)} ${digits.substring(3, 6)} ${digits.substring(6)}`;
}

/**
 * Validate South African phone number
 */
export function validateSAPhoneNumber(phone: string): PhoneValidationResult {
  if (!phone || phone.trim().length === 0) {
    return {
      isValid: false,
      formatted: '',
      local: '',
      error: 'Phone number is required'
    };
  }
  
  const normalized = normalizePhoneNumber(phone);
  const local = toLocalFormat(phone);
  
  // Check length (should be +27XXXXXXXXX = 12 chars)
  if (normalized.length !== 12 || !normalized.startsWith('+27')) {
    return {
      isValid: false,
      formatted: normalized,
      local: local,
      error: 'Phone number must be 10 digits (e.g., 0769790642)'
    };
  }
  
  // Extract digits after +27
  const digits = normalized.substring(3);
  
  // Check if it's all digits
  if (!/^\d{9}$/.test(digits)) {
    return {
      isValid: false,
      formatted: normalized,
      local: local,
      error: 'Phone number must contain only digits'
    };
  }
  
  // Check mobile prefix (first digit after country code should be 6, 7, or 8)
  const firstDigit = digits.charAt(0);
  if (!['6', '7', '8'].includes(firstDigit)) {
    return {
      isValid: false,
      formatted: normalized,
      local: local,
      error: `Invalid mobile prefix. Must start with 06x, 07x, or 08x (e.g., 0769790642)`
    };
  }
  
  return {
    isValid: true,
    formatted: normalized,
    local: local
  };
}

/**
 * Format phone input as user types (progressive formatting)
 */
export function formatPhoneInput(input: string): string {
  // Remove all non-digits
  const digits = input.replace(/\D/g, '');
  
  // Limit to 10 digits
  const limited = digits.substring(0, 10);
  
  // Apply formatting progressively
  if (limited.length <= 3) {
    return limited;
  } else if (limited.length <= 6) {
    return `${limited.substring(0, 3)} ${limited.substring(3)}`;
  } else {
    return `${limited.substring(0, 3)} ${limited.substring(3, 6)} ${limited.substring(6)}`;
  }
}

/**
 * Check if two phone numbers are the same (normalized comparison)
 */
export function phoneNumbersMatch(phone1: string, phone2: string): boolean {
  const normalized1 = normalizePhoneNumber(phone1);
  const normalized2 = normalizePhoneNumber(phone2);
  return normalized1 === normalized2;
}
