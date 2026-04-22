import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors } from '../../utils/colors';
import { productService } from '../../services/api';
import LoadingScreen from '../../components/LoadingScreen';
import { formatCurrency } from '../../utils/formatters';

const ProductDetailScreen = ({ route, navigation }) => {
  const { productId } = route.params;
  const [product, setProduct] = useState(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProduct();
  }, []);

  const loadProduct = async () => {
    try {
      const response = await productService.getById(productId);
      setProduct(response.data);
    } catch (error) {
      console.error('Error loading product:', error);
      Alert.alert('Error', 'Failed to load product details');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToQuote = () => {
    Alert.alert(
      'Add to Quote',
      `Add ${quantity} unit(s) of ${product.name} to your quote?`,
      [
        { text: 'Cancel', onPress: () => {}, style: 'cancel' },
        {
          text: 'Add',
          onPress: () => {
            // Handle add to quote
            Alert.alert('Success', 'Product added to quote');
          },
        },
      ]
    );
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (!product) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Product not found</Text>
      </View>
    );
  }

  const images = product.images || [product.image];

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Image Carousel */}
        <View style={styles.carouselContainer}>
          <Image
            source={{ uri: images[selectedImageIndex] }}
            style={styles.mainImage}
            resizeMode="cover"
          />
          {product.discount && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>-{product.discount}%</Text>
            </View>
          )}
        </View>

        {/* Image Thumbnails */}
        {images.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.thumbnailContainer}
            contentContainerStyle={styles.thumbnailContent}
          >
            {images.map((image, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => setSelectedImageIndex(index)}
              >
                <Image
                  source={{ uri: image }}
                  style={[
                    styles.thumbnail,
                    selectedImageIndex === index && styles.thumbnailActive,
                  ]}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Product Info */}
        <View style={styles.infoSection}>
          <Text style={styles.productName}>{product.name}</Text>
          <Text style={styles.sku}>SKU: {product.sku}</Text>

          {/* Price Section */}
          <View style={styles.priceSection}>
            <Text style={styles.price}>{formatCurrency(product.price)}</Text>
            {product.originalPrice && (
              <Text style={styles.originalPrice}>
                {formatCurrency(product.originalPrice)}
              </Text>
            )}
          </View>

          {/* Specifications Table */}
          <View style={styles.specsContainer}>
            <Text style={styles.specsTitle}>Specifications</Text>

            {product.dimension && (
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Dimension</Text>
                <Text style={styles.specValue}>{product.dimension}</Text>
              </View>
            )}

            {product.grade && (
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Grade</Text>
                <Text style={styles.specValue}>{product.grade}</Text>
              </View>
            )}

            {product.thickness && (
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Thickness</Text>
                <Text style={styles.specValue}>{product.thickness}</Text>
              </View>
            )}

            {product.finish && (
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Finish</Text>
                <Text style={styles.specValue}>{product.finish}</Text>
              </View>
            )}

            {product.moq && (
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Minimum Order Qty</Text>
                <Text style={styles.specValue}>{product.moq} units</Text>
              </View>
            )}

            {product.leadTime && (
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Lead Time</Text>
                <Text style={styles.specValue}>{product.leadTime} days</Text>
              </View>
            )}
          </View>

          {/* Description */}
          {product.description && (
            <View style={styles.descriptionSection}>
              <Text style={styles.descriptionTitle}>Description</Text>
              <Text style={styles.descriptionText}>{product.description}</Text>
            </View>
          )}

          {/* Related Products */}
          {product.relatedProducts && product.relatedProducts.length > 0 && (
            <View style={styles.relatedSection}>
              <Text style={styles.relatedTitle}>Related Products</Text>
              <FlatList
                data={product.relatedProducts}
                horizontal
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.relatedCard}
                    onPress={() =>
                      navigation.push('ProductDetail', { productId: item.id })
                    }
                  >
                    <Image
                      source={{ uri: item.image }}
                      style={styles.relatedImage}
                      resizeMode="cover"
                    />
                    <Text style={styles.relatedName} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <Text style={styles.relatedPrice}>
                      {formatCurrency(item.price)}
                    </Text>
                  </TouchableOpacity>
                )}
                keyExtractor={(item) => item.id.toString()}
                scrollEnabled={true}
              />
            </View>
          )}

          <View style={{ height: 20 }} />
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.quantityControl}>
          <TouchableOpacity
            onPress={() => setQuantity(Math.max(1, quantity - 1))}
            style={styles.quantityButton}
          >
            <Icon name="remove" size={20} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.quantityText}>{quantity}</Text>
          <TouchableOpacity
            onPress={() => setQuantity(quantity + 1)}
            style={styles.quantityButton}
          >
            <Icon name="add" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.addButton}
          onPress={handleAddToQuote}
        >
          <Icon name="document-text" size={20} color={colors.white} />
          <Text style={styles.addButtonText}>Add to Quote</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  carouselContainer: {
    width: '100%',
    height: 300,
    backgroundColor: colors.gray100,
    position: 'relative',
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },
  discountBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: colors.error,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  discountText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 14,
  },
  thumbnailContainer: {
    maxHeight: 100,
  },
  thumbnailContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.gray300,
  },
  thumbnailActive: {
    borderColor: colors.primary,
  },
  infoSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  productName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.gray900,
    marginBottom: 4,
  },
  sku: {
    fontSize: 12,
    color: colors.gray500,
    marginBottom: 12,
  },
  priceSection: {
    marginBottom: 20,
  },
  price: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primary,
  },
  originalPrice: {
    fontSize: 14,
    color: colors.gray400,
    textDecorationLine: 'line-through',
    marginTop: 4,
  },
  specsContainer: {
    marginBottom: 20,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
    paddingTop: 16,
  },
  specsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray900,
    marginBottom: 12,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  specLabel: {
    fontSize: 13,
    color: colors.gray600,
    fontWeight: '500',
  },
  specValue: {
    fontSize: 13,
    color: colors.gray900,
    fontWeight: '600',
  },
  descriptionSection: {
    marginBottom: 20,
  },
  descriptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray900,
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 13,
    color: colors.gray600,
    lineHeight: 20,
  },
  relatedSection: {
    marginBottom: 20,
  },
  relatedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray900,
    marginBottom: 12,
  },
  relatedCard: {
    width: 140,
    marginRight: 12,
    backgroundColor: colors.gray50,
    borderRadius: 8,
    overflow: 'hidden',
  },
  relatedImage: {
    width: '100%',
    height: 100,
  },
  relatedName: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.gray900,
    padding: 8,
  },
  relatedPrice: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.primary,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: colors.gray500,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
    gap: 12,
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: 8,
    backgroundColor: colors.gray50,
  },
  quantityButton: {
    padding: 8,
  },
  quantityText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray900,
    minWidth: 30,
    textAlign: 'center',
  },
  addButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  addButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 14,
  },
});

export default ProductDetailScreen;
