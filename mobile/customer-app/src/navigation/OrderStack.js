import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import OrderListScreen from '../screens/Orders/OrderListScreen';
import OrderDetailScreen from '../screens/Orders/OrderDetailScreen';
import QuotationRequestScreen from '../screens/Quotations/QuotationRequestScreen';
import { colors } from '../utils/colors';

const Stack = createNativeStackNavigator();

const OrderStack = () => {
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
        name="OrderList"
        component={OrderListScreen}
        options={{
          title: 'Orders',
        }}
      />
      <Stack.Screen
        name="OrderDetail"
        component={OrderDetailScreen}
        options={{
          title: 'Order Details',
        }}
      />
      <Stack.Screen
        name="RequestQuote"
        component={QuotationRequestScreen}
        options={{
          title: 'Request Quote',
        }}
      />
    </Stack.Navigator>
  );
};

export default OrderStack;
