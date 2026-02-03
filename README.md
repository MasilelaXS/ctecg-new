# My CTECG App

A comprehensive React Native mobile application for CTECG Internet customers to manage their accounts, view usage, billing, and get support.

## Features

### 🏠 Dashboard
- Real-time service status and connection information
- Account overview with customer details
- Quick action buttons for common tasks
- Recent alerts and notifications
- Support ticket summary

### 📊 Usage Monitoring
- Current month usage breakdown (download/upload)
- Daily usage charts and trends
- Historical usage data
- Uncapped plan status indicators
- Usage alerts and notifications

### 💳 Billing & Payments
- Current balance and outstanding invoices
- Payment history and recent transactions
- Auto-payment status and settings
- Invoice details and downloads
- Payment method management

### 🚨 Outages & Status
- Real-time service outage notifications
- Maintenance schedules and updates
- Facebook-style status updates
- Service restoration updates

### 💬 Support & FAQ
- Comprehensive FAQ with 12+ topics
- Expandable/collapsible FAQ sections
- Contact support form with priority levels
- Issue reporting with category selection
- Contact information and business hours

### 🔐 Authentication
- Secure login with token-based authentication
- Persistent session management
- Auto-logout on token expiration
- Secure credential storage

## Technical Stack

### Frontend
- **React Native** with TypeScript
- **Expo SDK 53** for development and building
- **React Navigation** for routing and navigation
- **Expo Vector Icons** for iconography
- **React Native Safe Area Context** for screen handling

### Architecture
- **Context API** for state management
- **API Service Layer** for backend communication
- **Custom Component Library** with consistent design
- **TypeScript** for type safety
- **Modular Structure** for maintainability

### Design System
- **Facebook-inspired UI** with modern card layouts
- **Custom Color Palette** with brand consistency
- **Typography System** with defined scales
- **Responsive Design** for various screen sizes
- **Dark/Light theme ready** color system

## Project Structure

```
src/
├── components/           # Reusable UI components
│   ├── Card.tsx         # Base card component
│   ├── CustomButton.tsx # Styled button component
│   ├── Header.tsx       # Header component
│   ├── LoadingSpinner.tsx # Loading indicator
│   ├── PaymentWebView.tsx # Payment web interface
│   ├── TopNavigation.tsx # Navigation header
│   └── UncappedUsageCard.tsx # Usage display card
├── constants/           # App constants and configuration
│   ├── api.ts          # API endpoints and configuration
│   ├── colors.ts       # Color palette
│   └── Design.ts       # Design system constants
├── contexts/           # React Context providers
│   └── AuthContext.tsx # Authentication context
├── navigation/         # Navigation configuration
│   └── AppNavigator.tsx # Main navigation setup
├── screens/           # App screens
│   ├── BillingScreen.tsx
│   ├── ComprehensiveDataScreen.tsx
│   ├── DashboardScreen.tsx
│   ├── FAQScreen.tsx
│   ├── LoginScreen.tsx
│   ├── OutageScreen.tsx
│   ├── ProfileScreen.tsx
│   ├── SupportScreen.tsx
│   └── UsageScreen.tsx
├── services/          # API and external services
│   ├── api.ts         # Main API service
│   └── api.tsx        # API utilities
├── types/             # TypeScript type definitions
│   ├── api.ts         # API response types
│   └── index.ts       # General types
└── utils/             # Utility functions
    ├── customerTypeUtils.tsx
    ├── customerValidation.tsx
    └── helpers.ts
```

## Getting Started

### Prerequisites
- Node.js (version 18 or higher)
- npm or yarn
- Expo CLI
- Android Studio (for Android development)
- Xcode (for iOS development, macOS only)

### Installation

1. Clone the repository
```bash
git clone https://github.com/MasilelaXS/ctecg-new.git
cd ctecg-new
```

2. Install dependencies
```bash
npm install
```

3. Start the development server
```bash
npx expo start
```

4. Run on device/simulator
- Scan QR code with Expo Go app (Android/iOS)
- Press 'a' for Android emulator
- Press 'i' for iOS simulator

### Configuration

Update the API endpoint in `src/constants/api.ts`:
```typescript
export const BASE_URL = 'https://your-api-endpoint.com/api';
```

## API Integration

The app integrates with CTECG's backend API for:
- User authentication and session management
- Dashboard data and account information
- Usage statistics and billing data
- Support ticket management
- Service status and outage information

### API Endpoints
- `/auth.php` - Authentication endpoints
- `/mobile-api.php` - Main mobile API endpoints
- Dashboard, usage, billing, and support data

## Key Features Implementation

### Navigation Structure
- **Stack Navigator** for screen transitions
- **Tab Navigator** for main app sections
- **Modal Navigation** for FAQ and overlays
- **Deep Linking** support for notifications

### State Management
- **AuthContext** for authentication state
- **Local State** for screen-specific data
- **API Service Layer** for data fetching
- **Secure Storage** for sensitive data

### Error Handling
- **Network Error Handling** with retry mechanisms
- **API Error Processing** with user-friendly messages
- **Offline Support** with cached data
- **Loading States** for better UX

## Development Notes

### Recent Updates
- ✅ Implemented FAQ screen separation from support
- ✅ Added stack navigation for better routing
- ✅ Enhanced TopNavigation with back button support
- ✅ Fixed navigation structure and screen accessibility
- ✅ Cleaned up project dependencies
- ✅ Removed conflicting expo-router files

### Known Issues
- Navigation to 'Support' needs nested navigation structure
- Some TypeScript warnings for navigation types
- Package versions need updating for latest Expo

### Future Enhancements
- Push notifications for outages and billing
- Biometric authentication
- Offline data synchronization
- Payment gateway integration
- Multi-language support

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is proprietary software for CTECG Internet Services.

## Support

For technical support or questions:
- Email: support@ctecg.co.za
- Phone: +27 (0)76 979 0642
- WhatsApp: 076 979 0642

---

**CTECG Internet Services** - Connecting South Africa
