import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ProductCatalogScreen from '../screens/Products/ProductCatalogScreen';
import ProductDetailScreen from '../screens/Products/ProductDetailScreen';
import { colors } from '../utils/colors';

const Stack = createNativeStackNavigator();

const ProductStack = () => {
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
        name="ProductCatalog"
        component={ProductCatalogScreen}
        options={{
          title: 'Products',
        }}
      />
      <Stack.Screen
        name="ProductDetail"
        component={ProductDetailScreen}
        options={{
          title: 'Product Details',
        }}
      />
    </Stack.Navigator>
  );
};

export default ProductStack;
