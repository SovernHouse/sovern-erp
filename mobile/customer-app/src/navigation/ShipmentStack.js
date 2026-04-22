import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ShipmentListScreen from '../screens/Shipments/ShipmentListScreen';
import ShipmentTrackerScreen from '../screens/Shipments/ShipmentTrackerScreen';
import { colors } from '../utils/colors';

const Stack = createNativeStackNavigator();

const ShipmentStack = () => {
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
        name="ShipmentList"
        component={ShipmentListScreen}
        options={{
          title: 'Shipments',
        }}
      />
      <Stack.Screen
        name="ShipmentTracker"
        component={ShipmentTrackerScreen}
        options={{
          title: 'Track Shipment',
        }}
      />
    </Stack.Navigator>
  );
};

export default ShipmentStack;
