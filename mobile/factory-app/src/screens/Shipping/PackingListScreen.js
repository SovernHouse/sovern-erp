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
import { colors } from '../../utils/colors';
import { packingListAPI } from '../../services/api';
import LoadingScreen from '../../components/LoadingScreen';

const PackingListScreen = ({ route, navigation }) => {
  const { shipmentId } = route.params;
  const [packingList, setPackingList] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingIndex, setEditingIndex] = useState(-1);

  const [itemForm, setItemForm] = useState({
    productName: '',
    quantity: '',
    packages: '',
    weight: '',
    weightUnit: 'kg',
    length: '',
    width: '',
    height: '',
    dimensionUnit: 'cm',
    notes: '',
  });

  useEffect(() => {
    fetchPackingList();
  }, []);

  const fetchPackingList = async () => {
    try {
      setLoading(true);
      const response = await packingListAPI.getByShipment(shipmentId);
      setPackingList(response.data);
      setItems(response.data?.items || []);
    } catch (error) {
      console.error('Error fetching packing list:', error);
      // Initialize empty packing list
      setPackingList({ shipmentId, items: [] });
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setItemForm({
      productName: '',
      quantity: '',
      packages: '',
      weight: '',
      weightUnit: 'kg',
      length: '',
      width: '',
      height: '',
      dimensionUnit: 'cm',
      notes: '',
    });
    setEditingIndex(-1);
  };

  const handleAddOrUpdate = () => {
    if (!itemForm.productName.trim()) {
      Alert.alert('Error', 'Please enter product name');
      return;
    }
    if (!itemForm.quantity) {
      Alert.alert('Error', 'Please enter quantity');
      return;
    }

    if (editingIndex >= 0) {
      const updatedItems = [...items];
      updatedItems[editingIndex] = itemForm;
      setItems(updatedItems);
    } else {
      setItems([...items, itemForm]);
    }
    resetForm();
  };

  const handleRemoveItem = (index) => {
    Alert.alert('Remove Item', 'Are you sure you want to remove this item?', [
      {
        text: 'Cancel',
        onPress: () => {},
        style: 'cancel',
      },
      {
        text: 'Remove',
        onPress: () => {
          setItems(items.filter((_, i) => i !== index));
        },
        style: 'destructive',
      },
    ]);
  };

  const handleEditItem = (index) => {
    setItemForm(items[index]);
    setEditingIndex(index);
  };

  const handleSave = async () => {
    if (items.length === 0) {
      Alert.alert('Error', 'Please add at least one item');
      return;
    }

    try {
      setSaving(true);
      if (packingList?.id) {
        await packingListAPI.update(packingList.id, items);
      } else {
        await packingListAPI.create(shipmentId, items);
      }
      Alert.alert('Success', 'Packing list saved successfully', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      console.error('Error saving packing list:', error);
      Alert.alert('Error', 'Failed to save packing list');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingScreen message="Loading packing list..." />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView
          style={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Packing List Details</Text>
            <Text style={styles.subtitle}>Shipment: {shipmentId}</Text>
          </View>

          {/* Form Section */}
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>
              {editingIndex >= 0 ? 'Edit Item' : 'Add New Item'}
            </Text>

            <FormField
              label="Product Name *"
              value={itemForm.productName}
              onChangeText={(text) => setItemForm({ ...itemForm, productName: text })}
              placeholder="e.g., Wooden Flooring"
              icon="package-variant"
            />

            <FormField
              label="Quantity (units) *"
              value={itemForm.quantity}
              onChangeText={(text) => setItemForm({ ...itemForm, quantity: text })}
              placeholder="e.g., 100"
              icon="counter"
              keyboardType="decimal-pad"
            />

            <FormField
              label="Number of Packages"
              value={itemForm.packages}
              onChangeText={(text) => setItemForm({ ...itemForm, packages: text })}
              placeholder="e.g., 10"
              icon="layers"
              keyboardType="decimal-pad"
            />

            {/* Weight Section */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Weight</Text>
              <View style={styles.rowInput}>
                <View style={styles.rowInputField}>
                  <TextInput
                    style={styles.input}
                    placeholder="Weight"
                    placeholderTextColor={colors.textMuted}
                    value={itemForm.weight}
                    onChangeText={(text) => setItemForm({ ...itemForm, weight: text })}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.unitSelector}>
                  <Text style={styles.unitText}>{itemForm.weightUnit}</Text>
                </View>
              </View>
            </View>

            {/* Dimensions Section */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Dimensions</Text>
              <View style={styles.dimensionsGrid}>
                <View style={styles.dimensionField}>
                  <TextInput
                    style={styles.input}
                    placeholder="Length"
                    placeholderTextColor={colors.textMuted}
                    value={itemForm.length}
                    onChangeText={(text) => setItemForm({ ...itemForm, length: text })}
                    keyboardType="decimal-pad"
                  />
                  <Text style={styles.dimensionUnit}>L</Text>
                </View>
                <View style={styles.dimensionField}>
                  <TextInput
                    style={styles.input}
                    placeholder="Width"
                    placeholderTextColor={colors.textMuted}
                    value={itemForm.width}
                    onChangeText={(text) => setItemForm({ ...itemForm, width: text })}
                    keyboardType="decimal-pad"
                  />
                  <Text style={styles.dimensionUnit}>W</Text>
                </View>
                <View style={styles.dimensionField}>
                  <TextInput
                    style={styles.input}
                    placeholder="Height"
                    placeholderTextColor={colors.textMuted}
                    value={itemForm.height}
                    onChangeText={(text) => setItemForm({ ...itemForm, height: text })}
                    keyboardType="decimal-pad"
                  />
                  <Text style={styles.dimensionUnit}>H</Text>
                </View>
                <View style={styles.unitSelector}>
                  <Text style={styles.unitText}>{itemForm.dimensionUnit}</Text>
                </View>
              </View>
            </View>

            <FormField
              label="Notes"
              value={itemForm.notes}
              onChangeText={(text) => setItemForm({ ...itemForm, notes: text })}
              placeholder="Add special instructions..."
              icon="note-outline"
              multiline
            />

            {/* Form Actions */}
            <View style={styles.formActions}>
              <TouchableOpacity
                style={styles.cancelFormButton}
                onPress={resetForm}
              >
                <Icon name="close" size={18} color={colors.text} />
                <Text style={styles.cancelFormButtonText}>Reset</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.addItemButton}
                onPress={handleAddOrUpdate}
              >
                <Icon
                  name={editingIndex >= 0 ? 'pencil' : 'plus-circle'}
                  size={18}
                  color="#fff"
                />
                <Text style={styles.addItemButtonText}>
                  {editingIndex >= 0 ? 'Update Item' : 'Add Item'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Items List */}
          {items.length > 0 && (
            <View style={styles.itemsListCard}>
              <Text style={styles.itemsListTitle}>Items ({items.length})</Text>
              {items.map((item, index) => (
                <View key={index} style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>{item.productName}</Text>
                      <Text style={styles.itemQty}>Qty: {item.quantity} units</Text>
                    </View>
                    <View style={styles.itemActions}>
                      <TouchableOpacity
                        style={styles.itemActionButton}
                        onPress={() => handleEditItem(index)}
                      >
                        <Icon name="pencil" size={16} color={colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.itemActionButton}
                        onPress={() => handleRemoveItem(index)}
                      >
                        <Icon name="trash-can" size={16} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {(item.weight || item.packages) && (
                    <View style={styles.itemDetails}>
                      {item.packages && (
                        <Text style={styles.itemDetailText}>
                          Packages: {item.packages}
                        </Text>
                      )}
                      {item.weight && (
                        <Text style={styles.itemDetailText}>
                          Weight: {item.weight} {item.weightUnit}
                        </Text>
                      )}
                    </View>
                  )}

                  {(item.length || item.width || item.height) && (
                    <View style={styles.itemDetails}>
                      <Text style={styles.itemDetailText}>
                        Dimensions: {item.length || '?'} × {item.width || '?'} × {item.height || '?'} {item.dimensionUnit}
                      </Text>
                    </View>
                  )}

                  {item.notes && (
                    <Text style={styles.itemNotes}>{item.notes}</Text>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Summary */}
          {items.length > 0 && (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Summary</Text>
              <SummaryRow
                label="Total Items"
                value={items.length}
              />
              <SummaryRow
                label="Total Quantity"
                value={items.reduce((sum, item) => sum + parseInt(item.quantity || 0), 0)}
              />
              <SummaryRow
                label="Total Packages"
                value={items.reduce((sum, item) => sum + parseInt(item.packages || 0), 0)}
              />
              <SummaryRow
                label="Total Weight"
                value={`${items.reduce((sum, item) => sum + parseFloat(item.weight || 0), 0).toFixed(2)} kg`}
              />
            </View>
          )}
        </ScrollView>

        {/* Save Button */}
        {items.length > 0 && (
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
                  <Text style={styles.saveButtonText}>Save Packing List</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const FormField = ({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  keyboardType = 'default',
  multiline = false,
}) => (
  <View style={styles.formGroup}>
    <Text style={styles.label}>{label}</Text>
    <View style={[styles.inputWrapper, multiline && styles.inputWrapperMultiline]}>
      {icon && <Icon name={icon} size={18} color={colors.primary} style={styles.fieldIcon} />}
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
      />
    </View>
  </View>
);

const SummaryRow = ({ label, value }) => (
  <View style={styles.summaryRow}>
    <Text style={styles.summaryLabel}>{label}</Text>
    <Text style={styles.summaryValue}>{value}</Text>
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
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  formCard: {
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
  formTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
    paddingBottom: 12,
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
  inputWrapperMultiline: {
    alignItems: 'flex-start',
    paddingVertical: 10,
    minHeight: 100,
  },
  fieldIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
  },
  inputMultiline: {
    paddingRight: 8,
  },
  section: {
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  rowInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowInputField: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    height: 44,
  },
  unitSelector: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unitText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
  },
  dimensionsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dimensionField: {
    flex: 1,
    position: 'relative',
  },
  dimensionUnit: {
    position: 'absolute',
    right: 10,
    top: 12,
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  formActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  cancelFormButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border,
    gap: 6,
  },
  cancelFormButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  addItemButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.primary,
    gap: 6,
  },
  addItemButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  itemsListCard: {
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
  itemsListTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemCard: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  itemQty: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  itemActions: {
    flexDirection: 'row',
    gap: 6,
  },
  itemActionButton: {
    padding: 6,
  },
  itemDetails: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: colors.lighter,
    borderRadius: 6,
  },
  itemDetailText: {
    fontSize: 11,
    color: colors.text,
    lineHeight: 16,
  },
  itemNotes: {
    fontSize: 11,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 8,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
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

export default PackingListScreen;
