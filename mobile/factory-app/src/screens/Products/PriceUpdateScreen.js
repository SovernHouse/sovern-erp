import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../../utils/colors';
import { formatDate } from '../../utils/formatters';
import { priceAPI, productAPI } from '../../services/api';
import LoadingScreen from '../../components/LoadingScreen';

const PriceUpdateScreen = ({ navigation }) => {
  const [products, setProducts] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [newPrice, setNewPrice] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await productAPI.getAll({ limit: 100 });
      setProducts(response.data);
    } catch (error) {
      console.error('Error fetching products:', error);
      Alert.alert('Error', 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const toggleProductSelection = (productId) => {
    if (selectedProducts.includes(productId)) {
      setSelectedProducts(selectedProducts.filter((id) => id !== productId));
    } else {
      setSelectedProducts([...selectedProducts, productId]);
    }
  };

  const handleSelectAll = () => {
    if (selectedProducts.length === filteredProducts.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(filteredProducts.map((p) => p.id));
    }
  };

  const handleDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setEffectiveDate(selectedDate);
    }
  };

  const handleUpdatePrices = async () => {
    if (selectedProducts.length === 0) {
      Alert.alert('Error', 'Please select at least one product');
      return;
    }
    if (!newPrice) {
      Alert.alert('Error', 'Please enter new price');
      return;
    }

    Alert.alert(
      'Update Prices',
      `Are you sure you want to update prices for ${selectedProducts.length} product(s)?`,
      [
        {
          text: 'Cancel',
          onPress: () => {},
          style: 'cancel',
        },
        {
          text: 'Update',
          onPress: async () => {
            await updatePrices();
          },
          style: 'default',
        },
      ]
    );
  };

  const updatePrices = async () => {
    try {
      setUpdating(true);
      const updates = selectedProducts.map((productId) => ({
        productId,
        price: parseFloat(newPrice),
        effectiveDate: effectiveDate.toISOString(),
      }));

      await priceAPI.updateMultiplePrices(updates);
      Alert.alert('Success', 'Prices updated successfully', [
        {
          text: 'OK',
          onPress: () => {
            setSelectedProducts([]);
            setNewPrice('');
            setEffectiveDate(new Date());
            fetchProducts();
          },
        },
      ]);
    } catch (error) {
      console.error('Error updating prices:', error);
      Alert.alert('Error', 'Failed to update prices');
    } finally {
      setUpdating(false);
    }
  };

  const filteredProducts = products.filter(
    (product) =>
      product.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return <LoadingScreen message="Loading products..." />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Update Product Prices</Text>
            <Text style={styles.subtitle}>
              {selectedProducts.length} product(s) selected
            </Text>
          </View>

          {/* Price Input */}
          <View style={styles.priceCard}>
            <Text style={styles.cardTitle}>New Price</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Price *</Text>
              <View style={styles.inputWrapper}>
                <Icon name="currency-usd" size={18} color={colors.primary} />
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                  value={newPrice}
                  onChangeText={setNewPrice}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Effective Date</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Icon name="calendar" size={18} color={colors.primary} />
                <Text style={styles.dateButtonText}>{formatDate(effectiveDate)}</Text>
              </TouchableOpacity>
              {Platform.OS === 'ios' && showDatePicker && (
                <View style={styles.datePickerContainer}>
                  <DateTimePicker
                    value={effectiveDate}
                    mode="date"
                    display="spinner"
                    onChange={handleDateChange}
                  />
                  <TouchableOpacity
                    style={styles.datePickerDone}
                    onPress={() => setShowDatePicker(false)}
                  >
                    <Text style={styles.datePickerDoneText}>Done</Text>
                  </TouchableOpacity>
                </View>
              )}
              {Platform.OS === 'android' && showDatePicker && (
                <DateTimePicker
                  value={effectiveDate}
                  mode="date"
                  display="default"
                  onChange={handleDateChange}
                />
              )}
            </View>
          </View>

          {/* Product Selection */}
          <View style={styles.selectionCard}>
            <View style={styles.selectionHeader}>
              <Text style={styles.cardTitle}>Select Products</Text>
              <TouchableOpacity
                style={styles.selectAllButton}
                onPress={handleSelectAll}
              >
                <Icon
                  name={
                    selectedProducts.length === filteredProducts.length
                      ? 'checkbox-marked'
                      : 'checkbox-blank-outline'
                  }
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.selectAllText}>
                  {selectedProducts.length === filteredProducts.length ? 'Deselect All' : 'Select All'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={styles.searchWrapper}>
              <Icon name="magnify" size={18} color={colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search products..."
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Icon name="close" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Product List */}
            <FlatList
              data={filteredProducts}
              renderItem={({ item }) => (
                <ProductSelectionItem
                  product={item}
                  selected={selectedProducts.includes(item.id)}
                  onToggle={() => toggleProductSelection(item.id)}
                />
              )}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              style={styles.productsList}
            />
          </View>
        </ScrollView>

        {/* Action Button */}
        {selectedProducts.length > 0 && (
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.updateButton, updating && styles.buttonDisabled]}
              onPress={handleUpdatePrices}
              disabled={updating}
            >
              {updating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Icon name="check-circle" size={18} color="#fff" />
                  <Text style={styles.updateButtonText}>
                    Update {selectedProducts.length} Price(s)
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const ProductSelectionItem = ({ product, selected, onToggle }) => (
  <TouchableOpacity
    style={[styles.productItem, selected && styles.productItemSelected]}
    onPress={onToggle}
  >
    <View style={styles.checkboxContainer}>
      <Icon
        name={selected ? 'checkbox-marked' : 'checkbox-blank-outline'}
        size={20}
        color={selected ? colors.primary : colors.textSecondary}
      />
    </View>

    <View style={styles.productInfo}>
      <Text style={styles.productName}>{product.name}</Text>
      <View style={styles.productDetails}>
        <Text style={styles.sku}>SKU: {product.sku}</Text>
        <Text style={styles.currentPrice}>
          Current: ${product.currentPrice?.toFixed(2) || 'N/A'}
        </Text>
      </View>
    </View>

    <Icon name="chevron-right" size={20} color={colors.textSecondary} />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContainer: {
    flex: 1,
    paddingBottom: 100,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 6,
  },
  priceCard: {
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  formGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    height: 44,
  },
  input: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    marginLeft: 8,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    height: 44,
  },
  dateButtonText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '500',
    marginLeft: 8,
  },
  datePickerContainer: {
    backgroundColor: colors.background,
    borderRadius: 8,
    marginTop: 8,
    padding: 12,
  },
  datePickerDone: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.primary,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  datePickerDoneText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  selectionCard: {
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    marginBottom: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: colors.text,
    marginLeft: 6,
  },
  productsList: {
    maxHeight: 400,
  },
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  productItemSelected: {
    backgroundColor: colors.lighter,
  },
  checkboxContainer: {
    paddingRight: 4,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  productDetails: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  sku: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  currentPrice: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '500',
  },
  buttonContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    paddingTop: 12,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  updateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  updateButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default PriceUpdateScreen;
