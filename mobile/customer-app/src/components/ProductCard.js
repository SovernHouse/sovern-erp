import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors } from '../utils/colors';
import { formatCurrency } from '../utils/formatters';

const ProductCard = ({ product, onPress }) => {
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: product.image }}
          style={styles.image}
          resizeMode="cover"
        />
        {product.discount && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>
              -{product.discount}%
            </Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>

        <Text style={styles.sku}>SKU: {product.sku}</Text>

        <View style={styles.specsRow}>
          {product.dimension && (
            <Text style={styles.spec}>
              {product.dimension}
            </Text>
          )}
          {product.grade && (
            <Text style={styles.spec}>
              {product.grade}
            </Text>
          )}
        </View>

        <View style={styles.footer}>
          <View>
            <Text style={styles.price}>
              {formatCurrency(product.price)}
            </Text>
            {product.originalPrice && (
              <Text style={styles.originalPrice}>
                {formatCurrency(product.originalPrice)}
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.addButton}
            activeOpacity={0.7}
          >
            <Icon name="add-circle" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    marginHorizontal: 8,
    flex: 1,
    maxWidth: '48%',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imageContainer: {
    width: '100%',
    height: 180,
    backgroundColor: colors.gray100,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: colors.error,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  discountText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  content: {
    padding: 12,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray900,
    marginBottom: 4,
  },
  sku: {
    fontSize: 11,
    color: colors.gray500,
    marginBottom: 8,
  },
  specsRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  spec: {
    fontSize: 10,
    color: colors.gray600,
    marginRight: 8,
    backgroundColor: colors.gray100,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
  },
  originalPrice: {
    fontSize: 12,
    color: colors.gray400,
    textDecorationLine: 'line-through',
    marginTop: 2,
  },
  addButton: {
    padding: 4,
  },
});

export default ProductCard;
