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
import { shipmentAPI, poAPI } from '../../services/api';
import LoadingScreen from '../../components/LoadingScreen';

const ShipmentFormScreen = ({ route, navigation }) => {
  const shipmentId = route.params?.shipmentId;
  const [shipment, setShipment] = useState(null);
  const [pos, setPOs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDatePickers, setShowDatePickers] = useState({});

  // Form fields
  const [poNumber, setPoNumber] = useState('');
  const [vesselName, setVesselName] = useState('');
  const [containerNumber, setContainerNumber] = useState('');
  const [originPort, setOriginPort] = useState('');
  const [destinationPort, setDestinationPort] = useState('');
  const [departureDate, setDepartureDate] = useState(new Date());
  const [arrivalDate, setArrivalDate] = useState(new Date());
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const posResponse = await poAPI.getAll();
      setPOs(posResponse.data);

      if (shipmentId) {
        const shipmentResponse = await shipmentAPI.getById(shipmentId);
        const data = shipmentResponse.data;
        setShipment(data);
        setPoNumber(data.poNumber);
        setVesselName(data.vesselName || '');
        setContainerNumber(data.containerNumber || '');
        setOriginPort(data.originPort || '');
        setDestinationPort(data.destinationPort || '');
        setDepartureDate(new Date(data.departureDate || new Date()));
        setArrivalDate(new Date(data.arrivalDate || new Date()));
        setCarrier(data.carrier || '');
        setTrackingNumber(data.trackingNumber || '');
        setNotes(data.notes || '');
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (field, date) => {
    if (field === 'departure') {
      setDepartureDate(date);
    } else if (field === 'arrival') {
      setArrivalDate(date);
    }
    setShowDatePickers((prev) => ({ ...prev, [field]: false }));
  };

  const handleSave = async () => {
    if (!poNumber.trim()) {
      Alert.alert('Error', 'Please select a purchase order');
      return;
    }
    if (!vesselName.trim()) {
      Alert.alert('Error', 'Please enter vessel name');
      return;
    }

    const formData = {
      poNumber,
      vesselName,
      containerNumber,
      originPort,
      destinationPort,
      departureDate: departureDate.toISOString(),
      arrivalDate: arrivalDate.toISOString(),
      carrier,
      trackingNumber,
      notes,
    };

    try {
      setSaving(true);
      if (shipmentId) {
        await shipmentAPI.update(shipmentId, formData);
        Alert.alert('Success', 'Shipment updated successfully', [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]);
      } else {
        const response = await shipmentAPI.create(formData);
        Alert.alert('Success', 'Shipment created successfully', [
          {
            text: 'OK',
            onPress: () => {
              navigation.navigate('ShipmentList');
            },
          },
        ]);
      }
    } catch (error) {
      console.error('Error saving shipment:', error);
      Alert.alert('Error', 'Failed to save shipment');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingScreen message="Loading shipment details..." />;
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
          {/* Form Title */}
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>
              {shipmentId ? 'Edit Shipment' : 'Create New Shipment'}
            </Text>
            {shipment && (
              <Text style={styles.shipmentNumber}>{shipment.shipmentNumber}</Text>
            )}
          </View>

          {/* Purchase Order Selection */}
          <FormSection title="Purchase Order">
            <View style={styles.poSelector}>
              <Icon name="file-document" size={18} color={colors.primary} />
              <TextInput
                style={styles.selectInput}
                placeholder="Select Purchase Order"
                placeholderTextColor={colors.textMuted}
                value={poNumber}
                onChangeText={setPoNumber}
              />
            </View>
            {pos.length > 0 && (
              <View style={styles.poList}>
                {pos.slice(0, 5).map((po) => (
                  <TouchableOpacity
                    key={po.id}
                    style={styles.poOption}
                    onPress={() => setPoNumber(po.poNumber)}
                  >
                    <Text style={styles.poOptionText}>{po.poNumber}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </FormSection>

          {/* Vessel Information */}
          <FormSection title="Vessel Information">
            <FormField
              label="Vessel Name *"
              value={vesselName}
              onChangeText={setVesselName}
              placeholder="Enter vessel name"
              icon="ship"
            />
            <FormField
              label="Container Number"
              value={containerNumber}
              onChangeText={setContainerNumber}
              placeholder="e.g., CONT123456"
              icon="package-variant"
            />
            <FormField
              label="Carrier"
              value={carrier}
              onChangeText={setCarrier}
              placeholder="Enter carrier name"
              icon="truck-fast"
            />
            <FormField
              label="Tracking Number"
              value={trackingNumber}
              onChangeText={setTrackingNumber}
              placeholder="Enter tracking number"
              icon="barcode"
            />
          </FormSection>

          {/* Port Information */}
          <FormSection title="Ports">
            <FormField
              label="Origin Port"
              value={originPort}
              onChangeText={setOriginPort}
              placeholder="e.g., Shanghai"
              icon="map-marker"
            />
            <FormField
              label="Destination Port"
              value={destinationPort}
              onChangeText={setDestinationPort}
              placeholder="e.g., Hamburg"
              icon="flag"
            />
          </FormSection>

          {/* Dates */}
          <FormSection title="Dates">
            <FormDateField
              label="Departure Date"
              value={departureDate}
              onPress={() => setShowDatePickers((prev) => ({ ...prev, departure: !prev.departure }))}
              icon="calendar-outline"
            />
            {showDatePickers.departure && (
              <DateTimePicker
                value={departureDate}
                mode="date"
                display="default"
                onChange={(event, date) => handleDateChange('departure', date)}
              />
            )}

            <FormDateField
              label="Arrival Date"
              value={arrivalDate}
              onPress={() => setShowDatePickers((prev) => ({ ...prev, arrival: !prev.arrival }))}
              icon="calendar-outline"
            />
            {showDatePickers.arrival && (
              <DateTimePicker
                value={arrivalDate}
                mode="date"
                display="default"
                onChange={(event, date) => handleDateChange('arrival', date)}
              />
            )}
          </FormSection>

          {/* Notes */}
          <FormSection title="Additional Notes">
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
                <Text style={styles.saveButtonText}>Save Shipment</Text>
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

const FormDateField = ({ label, value, onPress, icon }) => (
  <View style={styles.formGroup}>
    <Text style={styles.label}>{label}</Text>
    <TouchableOpacity style={styles.dateButton} onPress={onPress}>
      {icon && <Icon name={icon} size={18} color={colors.primary} style={styles.fieldIcon} />}
      <Text style={styles.dateButtonText}>{formatDate(value)}</Text>
    </TouchableOpacity>
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
  formHeader: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  shipmentNumber: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 6,
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
  poSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    marginBottom: 8,
    height: 44,
  },
  selectInput: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    marginLeft: 8,
  },
  poList: {
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: 200,
  },
  poOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  poOptionText: {
    fontSize: 13,
    color: colors.text,
  },
  notesInput: {
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
  charCount: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 6,
    textAlign: 'right',
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

export default ShipmentFormScreen;
