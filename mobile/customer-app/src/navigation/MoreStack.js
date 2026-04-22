import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MoreScreen from '../screens/More/MoreScreen';
import ProfileScreen from '../screens/Profile/ProfileScreen';
import NotificationSettingsScreen from '../screens/Profile/NotificationSettingsScreen';
import QuotationListScreen from '../screens/Quotations/QuotationListScreen';
import QuotationDetailScreen from '../screens/Quotations/QuotationDetailScreen';
import ClaimListScreen from '../screens/Claims/ClaimListScreen';
import ClaimFormScreen from '../screens/Claims/ClaimFormScreen';
import ClaimDetailScreen from '../screens/Claims/ClaimDetailScreen';
import { colors } from '../utils/colors';

const Stack = createNativeStackNavigator();

const MoreStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.white,
          borderBottomColor: colors.gray200,
          borderBottomWidth: 1,
        },
        headerTintColor: colors.primary,
        headerTitleStyle: {
          fontWeight: '600',
          color: colors.gray900,
        },
      }}
    >
      <Stack.Screen
        name="MoreScreen"
        component={MoreScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profile',
        }}
      />
      <Stack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={{
          title: 'Notification Settings',
        }}
      />
      <Stack.Screen
        name="Quotations"
        component={QuotationListScreen}
        options={{
          title: 'Quotations',
        }}
      />
      <Stack.Screen
        name="QuotationDetail"
        component={QuotationDetailScreen}
        options={{
          title: 'Quotation Details',
        }}
      />
      <Stack.Screen
        name="Claims"
        component={ClaimListScreen}
        options={{
          title: 'Claims',
        }}
      />
      <Stack.Screen
        name="ClaimForm"
        component={ClaimFormScreen}
        options={{
          title: 'File Claim',
        }}
      />
      <Stack.Screen
        name="ClaimDetail"
        component={ClaimDetailScreen}
        options={{
          title: 'Claim Details',
        }}
      />
    </Stack.Navigator>
  );
};

export default MoreStack;
