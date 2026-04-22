import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../utils/colors';

// Screens
import DashboardScreen from '../screens/Dashboard/DashboardScreen';
import POListScreen from '../screens/PurchaseOrders/POListScreen';
import PODetailScreen from '../screens/PurchaseOrders/PODetailScreen';
import POConfirmScreen from '../screens/PurchaseOrders/POConfirmScreen';
import ProductionListScreen from '../screens/Production/ProductionListScreen';
import ProductionUpdateScreen from '../screens/Production/ProductionUpdateScreen';
import ProductionCalendarScreen from '../screens/Production/ProductionCalendarScreen';
import ShipmentListScreen from '../screens/Shipping/ShipmentListScreen';
import ShipmentFormScreen from '../screens/Shipping/ShipmentFormScreen';
import DocumentUploadScreen from '../screens/Shipping/DocumentUploadScreen';
import PackingListScreen from '../screens/Shipping/PackingListScreen';
import ProductListScreen from '../screens/Products/ProductListScreen';
import ProductFormScreen from '../screens/Products/ProductFormScreen';
import PriceUpdateScreen from '../screens/Products/PriceUpdateScreen';
import InspectionListScreen from '../screens/Inspections/InspectionListScreen';
import InspectionDetailScreen from '../screens/Inspections/InspectionDetailScreen';
import InspectionPrepScreen from '../screens/Inspections/InspectionPrepScreen';
import ProfileScreen from '../screens/Profile/ProfileScreen';
import MoreScreen from '../screens/More/MoreScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Dashboard Stack
const DashboardStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.primary,
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 18,
        },
      }}
    >
      <Stack.Screen
        name="DashboardHome"
        component={DashboardScreen}
        options={{
          title: 'Dashboard',
        }}
      />
      <Stack.Screen
        name="PODetail"
        component={PODetailScreen}
        options={{
          title: 'Purchase Order',
        }}
      />
      <Stack.Screen
        name="POConfirm"
        component={POConfirmScreen}
        options={{
          title: 'Confirm Order',
        }}
      />
      <Stack.Screen
        name="ProductionUpdate"
        component={ProductionUpdateScreen}
        options={{
          title: 'Update Production',
        }}
      />
      <Stack.Screen
        name="DocumentUpload"
        component={DocumentUploadScreen}
        options={{
          title: 'Upload Documents',
        }}
      />
      <Stack.Screen
        name="InspectionDetail"
        component={InspectionDetailScreen}
        options={{
          title: 'Inspection Details',
        }}
      />
    </Stack.Navigator>
  );
};

// Orders Stack
const OrdersStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.primary,
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 18,
        },
      }}
    >
      <Stack.Screen
        name="POList"
        component={POListScreen}
        options={{
          title: 'Purchase Orders',
        }}
      />
      <Stack.Screen
        name="PODetailStack"
        component={PODetailScreen}
        options={{
          title: 'Purchase Order Details',
        }}
      />
      <Stack.Screen
        name="POConfirmStack"
        component={POConfirmScreen}
        options={{
          title: 'Confirm Purchase Order',
        }}
      />
    </Stack.Navigator>
  );
};

// Production Stack
const ProductionStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.primary,
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 18,
        },
      }}
    >
      <Stack.Screen
        name="ProductionListHome"
        component={ProductionListScreen}
        options={{
          title: 'Production Orders',
        }}
      />
      <Stack.Screen
        name="ProductionUpdateStack"
        component={ProductionUpdateScreen}
        options={{
          title: 'Update Production Status',
        }}
      />
      <Stack.Screen
        name="ProductionCalendar"
        component={ProductionCalendarScreen}
        options={{
          title: 'Production Calendar',
        }}
      />
      <Stack.Screen
        name="ShipmentList"
        component={ShipmentListScreen}
        options={{
          title: 'Shipments',
        }}
      />
      <Stack.Screen
        name="ShipmentForm"
        component={ShipmentFormScreen}
        options={{
          title: 'Shipment Details',
        }}
      />
      <Stack.Screen
        name="DocumentUploadStack"
        component={DocumentUploadScreen}
        options={{
          title: 'Shipping Documents',
        }}
      />
      <Stack.Screen
        name="PackingList"
        component={PackingListScreen}
        options={{
          title: 'Packing List',
        }}
      />
    </Stack.Navigator>
  );
};

// More Stack
const MoreStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.primary,
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 18,
        },
      }}
    >
      <Stack.Screen
        name="MoreHome"
        component={MoreScreen}
        options={{
          title: 'More Options',
        }}
      />
      <Stack.Screen
        name="ProductList"
        component={ProductListScreen}
        options={{
          title: 'Products',
        }}
      />
      <Stack.Screen
        name="ProductForm"
        component={ProductFormScreen}
        options={{
          title: 'Product Details',
        }}
      />
      <Stack.Screen
        name="PriceUpdate"
        component={PriceUpdateScreen}
        options={{
          title: 'Update Prices',
        }}
      />
      <Stack.Screen
        name="InspectionList"
        component={InspectionListScreen}
        options={{
          title: 'Inspections',
        }}
      />
      <Stack.Screen
        name="InspectionDetailStack"
        component={InspectionDetailScreen}
        options={{
          title: 'Inspection Report',
        }}
      />
      <Stack.Screen
        name="InspectionPrep"
        component={InspectionPrepScreen}
        options={{
          title: 'Prepare for Inspection',
        }}
      />
      <Stack.Screen
        name="ProfileStack"
        component={ProfileScreen}
        options={{
          title: 'Factory Profile',
        }}
      />
    </Stack.Navigator>
  );
};

// Main Tabs Navigator
const MainTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Dashboard') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Orders') {
            iconName = focused ? 'clipboard-list' : 'clipboard-list-outline';
          } else if (route.name === 'Production') {
            iconName = focused ? 'factory' : 'factory';
          } else if (route.name === 'More') {
            iconName = focused ? 'menu' : 'menu';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardStack}
        options={{
          title: 'Dashboard',
        }}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersStack}
        options={{
          title: 'Orders',
        }}
      />
      <Tab.Screen
        name="Production"
        component={ProductionStack}
        options={{
          title: 'Production',
        }}
      />
      <Tab.Screen
        name="More"
        component={MoreStack}
        options={{
          title: 'More',
        }}
      />
    </Tab.Navigator>
  );
};

export default MainTabs;
