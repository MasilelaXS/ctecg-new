// Customer ID validation utilities

/**
 * Validates customer ID format according to the PIT-/PIT[number]- pattern
 * Supports formats like:
 * - PIT-123-
 * - PIT123-
 * - PIT-123
 * - PIT123
 */
export const validateCustomerID = (customerID: string): boolean => {
  if (!customerID) return false;
  
  // Remove any whitespace
  const cleanID = customerID.trim().toUpperCase();
  
  // Pattern matches:
  // PIT- followed by numbers and optionally ending with -
  // OR PIT followed by numbers and optionally ending with -
  const patterns = [
    /^PIT-\d+-?$/,  // PIT-123- or PIT-123
    /^PIT\d+-?$/    // PIT123- or PIT123
  ];
  
  return patterns.some(pattern => pattern.test(cleanID));
};

/**
 * Normalizes customer ID to standard format (PIT-XXX-)
 */
export const normalizeCustomerID = (customerID: string): string => {
  if (!customerID) return '';
  
  const cleanID = customerID.trim().toUpperCase();
  
  // Extract numbers from the ID
  const numbers = cleanID.match(/\d+/)?.[0];
  if (!numbers) return customerID;
  
  // Return normalized format: PIT-XXX-
  return `PIT-${numbers}-`;
};

/**
 * Extracts the numeric part from a customer ID
 */
export const extractCustomerNumber = (customerID: string): string | null => {
  if (!customerID) return null;
  
  const match = customerID.match(/\d+/);
  return match ? match[0] : null;
};

/**
 * Checks if a customer ID format is valid for the system
 */
export const isValidPITFormat = (customerID: string): { 
  isValid: boolean; 
  normalized?: string; 
  error?: string; 
} => {
  if (!customerID) {
    return { isValid: false, error: 'Customer ID is required' };
  }

  const isValid = validateCustomerID(customerID);
  
  if (!isValid) {
    return { 
      isValid: false, 
      error: 'Invalid format. Expected format: PIT-123- or PIT123-' 
    };
  }

  const normalized = normalizeCustomerID(customerID);
  return { isValid: true, normalized };
};
