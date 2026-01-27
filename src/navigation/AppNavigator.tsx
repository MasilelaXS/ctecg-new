import React from 'react';
import { TouchableWithoutFeedback, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import DashboardScreen from '../screens/DashboardScreen';
import UsageScreen from '../screens/UsageScreen';
import BillingScreen from '../screens/BillingScreen';
import SupportScreen from '../screens/SupportScreen';
import FAQScreen from '../screens/FAQScreen';
import VerifyOTPScreen from '../screens/VerifyOTPScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import ForgotEmailScreen from '../screens/ForgotEmailScreen';
import CreatePasswordScreen from '../screens/CreatePasswordScreen';
import LoginScreen from '../screens/LoginScreen';
import LinkAccountScreen from '../screens/LinkAccountScreen';
import MakePaymentScreen from '../screens/MakePaymentScreen';
import OutageDetailsScreen from '../screens/OutageDetailsScreen';
import { Colors, Typography } from '../constants/Design';

export type RootStackParamList = {
  Login: undefined;
  VerifyOTP: { email: string; password: string };
  ResetPassword: undefined;
  ForgotEmail: undefined;
  CreatePassword: { userId: number; email: string };
  MainTabs: undefined;
  FAQ: undefined;
  Dashboard: undefined;
  LinkAccount: undefined;
  MakePayment: undefined;
  OutageDetails: { notification: any };
};

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<RootStackParamList>();

function TabNavigator() {
  const insets = useSafeAreaInsets();
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          switch (route.name) {
            case 'Dashboard':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Usage':
              iconName = focused ? 'bar-chart' : 'bar-chart-outline';
              break;
            case 'Billing':
              iconName = focused ? 'card' : 'card-outline';
              break;
            case 'Support':
              iconName = focused ? 'help-circle' : 'help-circle-outline';
              break;
            default:
              iconName = 'home-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E0E0E0',
          borderTopWidth: 1,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
          height: 60 + Math.max(insets.bottom, 0),
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        tabBarLabelStyle: {
          fontSize: Typography.xs,
          fontWeight: Typography.weights.medium,
          letterSpacing: Typography.letterSpacing.wide,
          marginBottom: 4,
        },
        tabBarButton: (props) => (
          <TouchableWithoutFeedback onPress={props.onPress}>
            <View style={props.style}>
              {props.children}
            </View>
          </TouchableWithoutFeedback>
        ),
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Usage" component={UsageScreen} />
      <Tab.Screen name="Billing" component={BillingScreen} />
      <Tab.Screen name="Support" component={SupportScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user } = useAuth();

  return (
    <Stack.Navigator 
      screenOptions={{ 
        headerShown: false,
        animation: 'slide_from_right'
      }}
    >
      {!user ? (
        // Auth Stack
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="VerifyOTP" component={VerifyOTPScreen} />
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
          <Stack.Screen name="ForgotEmail" component={ForgotEmailScreen} />
          <Stack.Screen name="CreatePassword" component={CreatePasswordScreen} />
        </>
      ) : (
        // Main App Stack
        <>
          <Stack.Screen name="MainTabs" component={TabNavigator} />
          <Stack.Screen name="FAQ" component={FAQScreen} />
          <Stack.Screen name="LinkAccount" component={LinkAccountScreen} />
          <Stack.Screen name="MakePayment" component={MakePaymentScreen} />
          <Stack.Screen name="OutageDetails" component={OutageDetailsScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
