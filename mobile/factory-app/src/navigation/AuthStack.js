import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/stack';
import LoginScreen from '../screens/Auth/LoginScreen';

const Stack = createNativeStackNavigator();

const AuthStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: true,
      }}
    >
      <Stack.Screen
        name="Login"
        component={LoginScreen}
      />
    </Stack.Navigator>
  );
};

export default AuthStack;
