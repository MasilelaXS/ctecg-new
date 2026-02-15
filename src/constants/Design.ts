// Vodacom-inspired design constants for CTECG

export const Colors = {
  // Primary Colors
  primary: '#cc0000', // CTECG Red (Vodacom-inspired)
  primaryDark: '#a30000',
  primaryLight: '#ff3333',
  
  // Background Colors
  background: '#FFFFFF',
  backgroundAlt: '#F5F5F5',
  surface: '#FAFAFA',
  card: '#FFFFFF',
  white: '#FFFFFF',
  
  // Text Colors
  text: '#1A1A1A',
  textSecondary: '#666666',
  textMuted: '#999999',
  textInverse: '#FFFFFF',
  
  // Status Colors
  success: '#00C851',
  warning: '#FF8800',
  error: '#FF4444',
  info: '#33B5E5',
  
  // Accent Colors
  accent: '#F5F5F5',
  border: '#E0E0E0',
  shadow: 'rgba(0, 0, 0, 0.1)',
  
  // Data Visualization
  chart1: '#cc0000',
  chart2: '#ff3333',
  chart3: '#666666',
  chart4: '#33B5E5',
};

export const Typography = {
  // Font Sizes
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  
  // Font Weights
  weights: {
    light: '300' as const,
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },
  
  // Line Heights
  lineHeights: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.6,
    loose: 1.8,
  },
  
  // Letter Spacing
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 0.5,
    wider: 0.8,
    widest: 1.2,
  },
  
  // Helper text styles
  bodySmall: {
    fontSize: 12,
    fontWeight: '400' as const,
  },
  bodySmallBold: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  bodyMedium: {
    fontSize: 14,
    fontWeight: '400' as const,
  },
  bodyLargeBold: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

export const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  round: 50,
};

export const Shadows = {
  small: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  medium: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 4,
  },
  large: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 8,
  },
};

export const Layout = {
  // Screen padding
  screenPadding: Spacing.md,
  
  // Container widths
  maxWidth: 400,
  
  // Tab bar height
  tabBarHeight: 60,
  
  // Header height
  headerHeight: 56,
};

// Common component styles following Vodacom design principles
export const CommonStyles = {
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Layout.screenPadding,
  },
  
  card: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginVertical: Spacing.sm,
    ...Shadows.medium,
  },
  
  section: {
    marginBottom: Spacing.lg,
  },
  
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  
  spaceBetween: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  
  centered: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  
  // Text styles
  h1: {
    fontSize: Typography.xxxl,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
    letterSpacing: Typography.letterSpacing.normal,
  },
  
  h2: {
    fontSize: Typography.xxl,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
    letterSpacing: Typography.letterSpacing.normal,
  },
  
  h3: {
    fontSize: Typography.xl,
    fontWeight: Typography.weights.semibold,
    color: Colors.text,
    letterSpacing: Typography.letterSpacing.wide,
  },
  
  body: {
    fontSize: Typography.md,
    fontWeight: Typography.weights.regular,
    color: Colors.text,
    lineHeight: Typography.md * Typography.lineHeights.normal,
  },
  
  caption: {
    fontSize: Typography.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.textSecondary,
    letterSpacing: Typography.letterSpacing.wide,
  },
  
  // Button text style
  buttonText: {
    fontSize: Typography.md,
    fontWeight: Typography.weights.semibold,
    letterSpacing: Typography.letterSpacing.wide,
    textTransform: 'uppercase' as const,
  },
};
