import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/stack';
import AuthStack from './AuthStack';
import MainTabs from './MainTabs';

const Stack = createNativeStackNavigator();

const AppNavigator = ({ userToken }) => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {userToken == null ? (
        <Stack.Screen
          name="Auth"
          component={AuthStack}
          options={{
            animationEnabled: false,
          }}
        />
      ) : (
        <Stack.Screen
          name="Main"
          component={MainTabs}
          options={{
            animationEnabled: false,
          }}
        />
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;
