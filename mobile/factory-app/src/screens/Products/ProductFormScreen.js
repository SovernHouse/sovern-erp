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
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../../utils/colors';
import { productAPI } from '../../services/api';
import LoadingScreen from '../../components/LoadingScreen';

const ProductFormScreen = ({ route, navigation }) => {
  const productId = route.params?.productId;
  const [loading, setLoading] = useState(productId ? true : false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [currentPrice, setCurrentPrice] = useState('');
  const [specifications, setSpecifications] = useState('');
  const [moq, setMoq] = useState('');

  const units = ['pcs', 'kg', 'meter', 'roll', 'box', 'set'];

  useEffect(() => {
    if (productId) {
      fetchProductDetails();
    }
  }, []);

  const fetchProductDetails = async () => {
    try {
      setLoading(true);
      const response = await productAPI.getById(productId);
      const product = response.data;
      setName(product.name || '');
      setSku(product.sku || '');
      setDescription(product.description || '');
      setCategory(product.category || '');
      setUnit(product.unit || 'pcs');
      setCurrentPrice(product.currentPrice?.toString() || '');
      setSpecifications(product.specifications || '');
      setMoq(product.moq?.toString() || '');
    } catch (error) {
      console.error('Error fetching product:', error);
      Alert.alert('Error', 'Failed to load product details');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter product name');
      return;
    }
    if (!sku.trim()) {
      Alert.alert('Error', 'Please enter SKU');
      return;
    }
    if (!currentPrice) {
      Alert.alert('Error', 'Please enter current price');
      return;
    }

    const formData = {
      name,
      sku,
      description,
      category,
      unit,
      currentPrice: parseFloat(currentPrice),
      specifications,
      moq: moq ? parseInt(moq) : null,
    };

    try {
      setSaving(true);
      if (productId) {
        await productAPI.update(productId, formData);
        Alert.alert('Success', 'Product updated successfully', [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]);
      } else {
        await productAPI.create(formData);
        Alert.alert('Success', 'Product created successfully', [
          {
            text: 'OK',
            onPress: () => navigation.navigate('ProductList'),
          },
        ]);
      }
    } catch (error) {
      console.error('Error saving product:', error);
      Alert.alert('Error', 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingScreen message="Loading product..." />;
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
            <Text style={styles.title}>
              {productId ? 'Edit Product' : 'Add New Product'}
            </Text>
          </View>

          {/* Basic Information */}
          <FormSection title="Basic Information">
            <FormField
              label="Product Name *"
              value={name}
              onChangeText={setName}
              placeholder="e.g., Engineered Wooden Floor"
              icon="package-variant"
            />

            <FormField
              label="SKU *"
              value={sku}
              onChangeText={setSku}
              placeholder="e.g., WF-001"
              icon="barcode"
            />

            <FormField
              label="Category"
              value={category}
              onChangeText={setCategory}
              placeholder="e.g., Flooring, Tiles"
              icon="folder"
            />

            <View style={styles.formGroup}>
              <Text style={styles.label}>Unit *</Text>
              <View style={styles.unitSelector}>
                {units.map((u) => (
                  <TouchableOpacity
                    key={u}
                    style={[
                      styles.unitButton,
                      unit === u && styles.unitButtonActive,
                    ]}
                    onPress={() => setUnit(u)}
                  >
                    <Text
                      style={[
                        styles.unitButtonText,
                        unit === u && styles.unitButtonTextActive,
                      ]}
                    >
                      {u}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </FormSection>

          {/* Description */}
          <FormSection title="Description">
            <TextInput
              style={styles.textareaInput}
              placeholder="Product description and details..."
              placeholderTextColor={colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </FormSection>

          {/* Pricing */}
          <FormSection title="Pricing">
            <FormField
              label="Current Price *"
              value={currentPrice}
              onChangeText={setCurrentPrice}
              placeholder="0.00"
              icon="currency-usd"
              keyboardType="decimal-pad"
            />

            <FormField
              label="Minimum Order Quantity"
              value={moq}
              onChangeText={setMoq}
              placeholder="e.g., 100"
              icon="counter"
              keyboardType="number-pad"
            />
          </FormSection>

          {/* Specifications */}
          <FormSection title="Specifications">
            <TextInput
              style={styles.textareaInput}
              placeholder="Technical specifications, dimensions, materials, etc..."
              placeholderTextColor={colors.textMuted}
              value={specifications}
              onChangeText={setSpecifications}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </FormSection>
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
            disabled={saving}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Icon name="check-circle" size={18} color="#fff" />
                <Text style={styles.saveButtonText}>
                  {productId ? 'Update Product' : 'Create Product'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const FormSection = ({ title, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
);

const FormField = ({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  keyboardType = 'default',
}) => (
  <View style={styles.formGroup}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.inputWrapper}>
      {icon && <Icon name={icon} size={18} color={colors.primary} style={styles.fieldIcon} />}
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
      />
    </View>
  </View>
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
  section: {
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
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
  fieldIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
  },
  unitSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  unitButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  unitButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  unitButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text,
  },
  unitButtonTextActive: {
    color: '#fff',
  },
  textareaInput: {
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.text,
    minHeight: 100,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 20,
    paddingTop: 12,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default ProductFormScreen;
