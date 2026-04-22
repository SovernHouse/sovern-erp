import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppNavigator from './src/navigation/AppNavigator';
import { colors } from './src/utils/colors';

const App = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    const bootstrapAsync = async () => {
      try {
        // Check if user token exists
        const userToken = await AsyncStorage.getItem('userToken');
        const userData = await AsyncStorage.getItem('userData');

        if (userToken && userData) {
          setIsSignedIn(true);
          setInitialRoute('Main');
        } else {
          setIsSignedIn(false);
          setInitialRoute('Auth');
        }
      } catch (e) {
        console.error('Failed to restore session:', e);
        setIsSignedIn(false);
        setInitialRoute('Auth');
      } finally {
        setIsLoading(false);
      }
    };

    bootstrapAsync();
  }, []);

  if (isLoading) {
    return (
      <SafeAreaProvider>
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: colors.white,
          }}
        >
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <AppNavigator isSignedIn={isSignedIn} />
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

export default App;
