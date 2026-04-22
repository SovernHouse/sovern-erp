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
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../../utils/colors';
import { formatDate } from '../../utils/formatters';
import { poAPI } from '../../services/api';
import LoadingScreen from '../../components/LoadingScreen';
import StatusBadge from '../../components/StatusBadge';

const POConfirmScreen = ({ route, navigation }) => {
  const { poId } = route.params;
  const [po, setPO] = useState(null);
  const [deliveryDate, setDeliveryDate] = useState(new Date());
  const [notes, setNotes] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    fetchPODetails();
  }, []);

  const fetchPODetails = async () => {
    try {
      setLoading(true);
      const response = await poAPI.getById(poId);
      setPO(response.data);
      if (response.data.deliveryDate) {
        setDeliveryDate(new Date(response.data.deliveryDate));
      }
      if (response.data.notes) {
        setNotes(response.data.notes);
      }
    } catch (error) {
      console.error('Error fetching PO:', error);
      Alert.alert('Error', 'Failed to load purchase order');
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setDeliveryDate(selectedDate);
    }
  };

  const handleConfirm = async () => {
    if (!deliveryDate) {
      Alert.alert('Error', 'Please select a delivery date');
      return;
    }

    Alert.alert(
      'Confirm Purchase Order',
      'Are you sure you want to confirm this purchase order?',
      [
        {
          text: 'Cancel',
          onPress: () => {},
          style: 'cancel',
        },
        {
          text: 'Confirm',
          onPress: async () => {
            await confirmPO();
          },
          style: 'default',
        },
      ]
    );
  };

  const confirmPO = async () => {
    try {
      setConfirming(true);
      await poAPI.confirmPO(poId, deliveryDate.toISOString(), notes);
      Alert.alert('Success', 'Purchase order confirmed successfully', [
        {
          text: 'OK',
          onPress: () => {
            navigation.navigate('Orders');
          },
        },
      ]);
    } catch (error) {
      console.error('Error confirming PO:', error);
      Alert.alert('Error', 'Failed to confirm purchase order');
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return <LoadingScreen message="Loading purchase order..." />;
  }

  if (!po) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" size={48} color={colors.danger} />
          <Text style={styles.errorText}>Purchase order not found</Text>
        </View>
      </SafeAreaView>
    );
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
          {/* PO Summary Card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Text style={styles.poNumber}>{po.poNumber}</Text>
              <StatusBadge status={po.status} size="large" />
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryContent}>
              <SummaryItem label="Supplier" value={po.supplier?.name} />
              <SummaryItem label="Total Items" value={`${po.items?.length || 0}`} />
              <SummaryItem label="Total Quantity" value={`${po.totalQuantity} units`} />
              <SummaryItem label="Total Value" value={`$${po.totalValue?.toLocaleString()}`} />
            </View>
          </View>

          {/* Confirmation Form */}
          <View style={styles.formSection}>
            <Text style={styles.formTitle}>Confirm Purchase Order</Text>

            {/* Delivery Date */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Delivery Date *</Text>
              <TouchableOpacity
                style={styles.datePickerButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Icon
                  name="calendar"
                  size={20}
                  color={colors.primary}
                  style={styles.dateIcon}
                />
                <Text style={styles.datePickerText}>
                  {formatDate(deliveryDate)}
                </Text>
              </TouchableOpacity>
              {Platform.OS === 'ios' && showDatePicker && (
                <View style={styles.datePickerContainer}>
                  <DateTimePicker
                    value={deliveryDate}
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
                  value={deliveryDate}
                  mode="date"
                  display="default"
                  onChange={handleDateChange}
                />
              )}
            </View>

            {/* Notes */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="Add any special instructions or notes..."
                placeholderTextColor={colors.textMuted}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              <Text style={styles.charCount}>
                {notes.length}/500
              </Text>
            </View>

            {/* Items List */}
            <View style={styles.itemsSection}>
              <Text style={styles.label}>Items Summary</Text>
              {po.items && po.items.length > 0 ? (
                <View style={styles.itemsList}>
                  {po.items.map((item, index) => (
                    <View key={index} style={styles.itemRow}>
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName}>{item.productName}</Text>
                        <Text style={styles.itemDetails}>
                          {item.quantity} × ${item.unitPrice}
                        </Text>
                      </View>
                      <Text style={styles.itemTotal}>
                        ${(item.quantity * item.unitPrice).toLocaleString()}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

            {/* Confirmation Checklist */}
            <View style={styles.checklistSection}>
              <Text style={styles.label}>Confirmation Checklist</Text>
              <ChecklistItem
                icon="check-circle-outline"
                label="Delivery date agreed with supplier"
              />
              <ChecklistItem
                icon="check-circle-outline"
                label="All specifications are clear"
              />
              <ChecklistItem
                icon="check-circle-outline"
                label="Pricing is acceptable"
              />
              <ChecklistItem
                icon="check-circle-outline"
                label="Payment terms are agreed"
              />
            </View>
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
            disabled={confirming}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.confirmButton, confirming && styles.buttonDisabled]}
            onPress={handleConfirm}
            disabled={confirming}
          >
            {confirming ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Icon name="check-circle" size={20} color="#fff" />
                <Text style={styles.confirmButtonText}>Confirm Order</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const SummaryItem = ({ label, value }) => (
  <View style={styles.summaryItem}>
    <Text style={styles.summaryLabel}>{label}</Text>
    <Text style={styles.summaryValue}>{value}</Text>
  </View>
);

const ChecklistItem = ({ icon, label }) => (
  <View style={styles.checklistItem}>
    <Icon name={icon} size={20} color={colors.success} />
    <Text style={styles.checklistLabel}>{label}</Text>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  errorText: {
    fontSize: 16,
    color: colors.text,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    margin: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  poNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 12,
  },
  summaryContent: {
    gap: 8,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
  },
  formSection: {
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
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  dateIcon: {},
  datePickerText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
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
  notesInput: {
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 13,
    color: colors.text,
    minHeight: 100,
  },
  charCount: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 6,
    textAlign: 'right',
  },
  itemsSection: {
    marginBottom: 16,
  },
  itemsList: {
    backgroundColor: colors.background,
    borderRadius: 8,
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  itemDetails: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  itemTotal: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.primary,
  },
  checklistSection: {
    marginTop: 16,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  checklistLabel: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '500',
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
  confirmButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default POConfirmScreen;
