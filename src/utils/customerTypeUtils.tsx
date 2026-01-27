// Customer type detection and display utility
export interface CustomerTypeInfo {
  cleanName: string;
  customerType: string;
  serviceType: string;
  displayBadge: boolean;
  badgeColor: string;
  description: string;
}

export const detectCustomerType = (fullName: string): CustomerTypeInfo => {
  const name = fullName.trim();
  
  // Check for Planet IT Tree clients (PIT- or PIT[number]- at the beginning)
  if (name.match(/^PIT-|^PIT\d+-/)) {
    const cleanName = name.replace(/^PIT-?(\d+)?-?\s*/, '');
    return {
      cleanName,
      customerType: 'Planet IT Tree Client',
      serviceType: 'Acquired ISP Customer',
      displayBadge: true,
      badgeColor: '#9C27B0', // Purple
      description: 'Customer from Planet IT Tree (acquired ISP)'
    };
  }
  
  // Check for service type markers at the end
  if (name.endsWith('###')) {
    const cleanName = name.replace(/###$/, '').trim();
    return {
      cleanName,
      customerType: 'LTE Customer',
      serviceType: 'LTE Connection',
      displayBadge: true,
      badgeColor: '#FF9800', // Orange
      description: 'LTE wireless internet service'
    };
  }
  
  if (name.endsWith('++')) {
    const cleanName = name.replace(/\+\+$/, '').trim();
    return {
      cleanName,
      customerType: 'Other ISP',
      serviceType: 'Alternative ISP',
      displayBadge: true,
      badgeColor: '#2196F3', // Blue
      description: 'Customer from other internet service provider'
    };
  }
  
  if (name.endsWith('***')) {
    const cleanName = name.replace(/\*\*\*$/, '').trim();
    return {
      cleanName,
      customerType: 'Fibre Customer',
      serviceType: 'Fibre Connection',
      displayBadge: true,
      badgeColor: '#4CAF50', // Green
      description: 'High-speed fibre internet service'
    };
  }
  
  if (name.endsWith('*') && !name.endsWith('**')) {
    const cleanName = name.replace(/\*$/, '').trim();
    return {
      cleanName,
      customerType: 'VoIP Only',
      serviceType: 'Voice Service',
      displayBadge: true,
      badgeColor: '#795548', // Brown
      description: 'Voice over IP service only'
    };
  }
  
  // Default case - regular customer
  return {
    cleanName: name,
    customerType: 'Standard Customer',
    serviceType: 'Standard Service',
    displayBadge: false,
    badgeColor: '#757575', // Gray
    description: 'Standard internet service customer'
  };
};

export const formatCustomerName = (fullName: string): string => {
  const { cleanName } = detectCustomerType(fullName);
  return cleanName;
};

export const getServiceTypeDisplay = (fullName: string): string => {
  const { serviceType } = detectCustomerType(fullName);
  return serviceType;
};
