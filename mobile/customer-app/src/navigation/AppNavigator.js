import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AuthStack from './AuthStack';
import MainTabs from './MainTabs';

const Stack = createNativeStackNavigator();

const AppNavigator = ({ isSignedIn }) => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {isSignedIn ? (
        <Stack.Screen
          name="Main"
          component={MainTabs}
          options={{
            animationEnabled: false,
          }}
        />
      ) : (
        <Stack.Screen
          name="Auth"
          component={AuthStack}
          options={{
            animationEnabled: false,
          }}
        />
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;
