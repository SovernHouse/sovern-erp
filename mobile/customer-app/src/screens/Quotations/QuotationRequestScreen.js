import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors } from '../../utils/colors';
import { productService, quotationService } from '../../services/api';
import LoadingScreen from '../../components/LoadingScreen';
import { formatCurrency } from '../../utils/formatters';

const QuotationRequestScreen = ({ navigation }) => {
  const [step, setStep] = useState(1); // 1: Select Products, 2: Add Notes, 3: Review
  const [products, setProducts] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredProducts, setFilteredProducts] = useState([]);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const response = await productService.getAll();
      setProducts(response.data.data || []);
      setFilteredProducts(response.data.data || []);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    filterProducts();
  }, [searchQuery]);

  const filterProducts = () => {
    if (!searchQuery) {
      setFilteredProducts(products);
      return;
    }

    const filtered = products.filter(
      (p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredProducts(filtered);
  };

  const handleSelectProduct = (product) => {
    const existingIndex = selectedProducts.findIndex((p) => p.id === product.id);

    if (existingIndex > -1) {
      const updated = [...selectedProducts];
      updated.splice(existingIndex, 1);
      setSelectedProducts(updated);
    } else {
      setSelectedProducts([...selectedProducts, { ...product, requestedQty: 1 }]);
    }
  };

  const handleQuantityChange = (productId, qty) => {
    const updated = selectedProducts.map((p) =>
      p.id === productId ? { ...p, requestedQty: Math.max(1, qty) } : p
    );
    setSelectedProducts(updated);
  };

  const handleSubmitQuote = async () => {
    if (selectedProducts.length === 0) {
      Alert.alert('No Products', 'Please select at least one product');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        items: selectedProducts.map((p) => ({
          productId: p.id,
          quantity: p.requestedQty,
        })),
        notes: notes,
      };

      await quotationService.create(payload);
      Alert.alert(
        'Success',
        'Your quotation request has been submitted',
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.navigate('OrderList');
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to submit quotation request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  const totalItems = selectedProducts.reduce((sum, p) => sum + p.requestedQty, 0);

  // Step 1: Select Products
  if (step === 1) {
    return (
      <View style={styles.container}>
        <View style={styles.searchContainer}>
          <Icon name="search" size={20} color={colors.gray400} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products..."
            placeholderTextColor={colors.gray400}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="close-circle" size={20} color={colors.gray400} />
            </TouchableOpacity>
          )}
        </View>

        <FlatList
          data={filteredProducts}
          renderItem={({ item }) => {
            const isSelected = selectedProducts.some((p) => p.id === item.id);
            return (
              <TouchableOpacity
                style={[
                  styles.productItem,
                  isSelected && styles.productItemSelected,
                ]}
                onPress={() => handleSelectProduct(item)}
              >
                <View style={styles.checkBox}>
                  {isSelected && (
                    <Icon name="checkmark" size={16} color={colors.white} />
                  )}
                </View>
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{item.name}</Text>
                  <Text style={styles.productSku}>SKU: {item.sku}</Text>
                  <Text style={styles.productPrice}>
                    {formatCurrency(item.price)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          scrollEnabled={true}
        />

        <View style={styles.stepFooter}>
          <TouchableOpacity
            style={[styles.nextButton, selectedProducts.length === 0 && styles.buttonDisabled]}
            onPress={() => setStep(2)}
            disabled={selectedProducts.length === 0}
          >
            <Text style={styles.nextButtonText}>
              Next ({totalItems} items)
            </Text>
            <Icon name="chevron-forward" size={20} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Step 2: Add Notes
  if (step === 2) {
    return (
      <View style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Selected Products Summary */}
          <View style={styles.summarySection}>
            <Text style={styles.sectionTitle}>Selected Products</Text>
            {selectedProducts.map((product) => (
              <View key={product.id} style={styles.summaryItem}>
                <View style={styles.summaryLeft}>
                  <Text style={styles.summaryProductName}>
                    {product.name}
                  </Text>
                  <Text style={styles.summarySku}>SKU: {product.sku}</Text>
                </View>
                <View style={styles.summaryQty}>
                  <TouchableOpacity
                    onPress={() =>
                      handleQuantityChange(
                        product.id,
                        product.requestedQty - 1
                      )
                    }
                  >
                    <Icon name="remove-circle" size={20} color={colors.primary} />
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{product.requestedQty}</Text>
                  <TouchableOpacity
                    onPress={() =>
                      handleQuantityChange(
                        product.id,
                        product.requestedQty + 1
                      )
                    }
                  >
                    <Icon name="add-circle" size={20} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>

          {/* Notes Section */}
          <View style={styles.notesSection}>
            <Text style={styles.sectionTitle}>Special Requirements</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Add any special requirements, delivery preferences, or other notes..."
              placeholderTextColor={colors.gray400}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
          </View>
        </ScrollView>

        <View style={styles.stepFooter}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setStep(1)}
          >
            <Icon name="chevron-back" size={20} color={colors.primary} />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.nextButton}
            onPress={() => setStep(3)}
          >
            <Text style={styles.nextButtonText}>Review</Text>
            <Icon name="chevron-forward" size={20} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Step 3: Review
  if (step === 3) {
    return (
      <View style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.reviewSection}>
            <Text style={styles.sectionTitle}>Quotation Summary</Text>

            {/* Items */}
            <View style={styles.reviewCard}>
              <Text style={styles.reviewCardTitle}>Items ({totalItems})</Text>
              {selectedProducts.map((product) => (
                <View key={product.id} style={styles.reviewItem}>
                  <View style={styles.reviewItemLeft}>
                    <Text style={styles.reviewItemName}>
                      {product.name}
                    </Text>
                    <Text style={styles.reviewItemQty}>
                      Qty: {product.requestedQty}
                    </Text>
                  </View>
                  <Text style={styles.reviewItemPrice}>
                    {formatCurrency(product.price * product.requestedQty)}
                  </Text>
                </View>
              ))}
            </View>

            {/* Notes */}
            {notes && (
              <View style={styles.reviewCard}>
                <Text style={styles.reviewCardTitle}>Special Requirements</Text>
                <Text style={styles.reviewNotes}>{notes}</Text>
              </View>
            )}

            {/* Confirmation */}
            <View style={styles.confirmationBox}>
              <Icon name="information-circle" size={24} color={colors.info} />
              <View style={styles.confirmationContent}>
                <Text style={styles.confirmationTitle}>Ready to submit?</Text>
                <Text style={styles.confirmationText}>
                  We'll review your quotation request and send you a detailed quote
                  within 24-48 hours
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={styles.stepFooter}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setStep(2)}
            disabled={submitting}
          >
            <Icon name="chevron-back" size={20} color={colors.primary} />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.nextButton, styles.submitButton, submitting && styles.buttonDisabled]}
            onPress={handleSubmitQuote}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <>
                <Text style={styles.nextButtonText}>Submit Request</Text>
                <Icon name="send" size={20} color={colors.white} />
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.gray100,
    borderRadius: 8,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    marginLeft: 8,
    color: colors.gray900,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: colors.gray50,
  },
  productItemSelected: {
    backgroundColor: colors.primaryLight,
  },
  checkBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    backgroundColor: colors.primary,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray900,
  },
  productSku: {
    fontSize: 11,
    color: colors.gray600,
    marginTop: 4,
  },
  productPrice: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 4,
  },
  summarySection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray900,
    marginBottom: 12,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: colors.gray50,
    borderRadius: 8,
    marginBottom: 8,
  },
  summaryLeft: {
    flex: 1,
  },
  summaryProductName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray900,
  },
  summarySku: {
    fontSize: 11,
    color: colors.gray600,
    marginTop: 4,
  },
  summaryQty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  qtyText: {
    minWidth: 30,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
  },
  notesSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: 8,
    padding: 12,
    fontSize: 13,
    color: colors.gray900,
    minHeight: 120,
  },
  reviewSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  reviewCard: {
    backgroundColor: colors.gray50,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  reviewCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray900,
    marginBottom: 12,
  },
  reviewItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  reviewItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  reviewItemLeft: {
    flex: 1,
  },
  reviewItemName: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.gray900,
  },
  reviewItemQty: {
    fontSize: 11,
    color: colors.gray600,
    marginTop: 2,
  },
  reviewItemPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  reviewNotes: {
    fontSize: 13,
    color: colors.gray600,
    lineHeight: 20,
  },
  confirmationBox: {
    flexDirection: 'row',
    backgroundColor: colors.infoLight,
    borderRadius: 8,
    padding: 12,
    gap: 12,
    marginTop: 12,
  },
  confirmationContent: {
    flex: 1,
  },
  confirmationTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray900,
  },
  confirmationText: {
    fontSize: 12,
    color: colors.gray600,
    marginTop: 4,
    lineHeight: 18,
  },
  stepFooter: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  backButton: {
    flex: 0.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    gap: 6,
  },
  backButtonText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: 8,
    gap: 6,
  },
  nextButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 14,
  },
  submitButton: {
    backgroundColor: colors.accent,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default QuotationRequestScreen;
