import React, { useState, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Ionicons';
import HomeStack from './HomeStack';
import ProductStack from './ProductStack';
import OrderStack from './OrderStack';
import ShipmentStack from './ShipmentStack';
import MoreStack from './MoreStack';
import { colors } from '../utils/colors';

const Tab = createBottomTabNavigator();

const MainTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.gray400,
        tabBarStyle: {
          borderTopColor: colors.gray200,
          borderTopWidth: 1,
          backgroundColor: colors.white,
          paddingBottom: 5,
          paddingTop: 5,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
          marginTop: -8,
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'HomeStack') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'ProductStack') {
            iconName = focused ? 'cube' : 'cube-outline';
          } else if (route.name === 'OrderStack') {
            iconName = focused ? 'receipt' : 'receipt-outline';
          } else if (route.name === 'ShipmentStack') {
            iconName = focused ? 'truck' : 'truck-outline';
          } else if (route.name === 'MoreStack') {
            iconName = focused ? 'menu' : 'menu-outline';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="HomeStack"
        component={HomeStack}
        options={{
          tabBarLabel: 'Home',
        }}
      />
      <Tab.Screen
        name="ProductStack"
        component={ProductStack}
        options={{
          tabBarLabel: 'Products',
        }}
      />
      <Tab.Screen
        name="OrderStack"
        component={OrderStack}
        options={{
          tabBarLabel: 'Orders',
        }}
      />
      <Tab.Screen
        name="ShipmentStack"
        component={ShipmentStack}
        options={{
          tabBarLabel: 'Shipments',
        }}
      />
      <Tab.Screen
        name="MoreStack"
        component={MoreStack}
        options={{
          tabBarLabel: 'More',
        }}
      />
    </Tab.Navigator>
  );
};

export default MainTabs;
