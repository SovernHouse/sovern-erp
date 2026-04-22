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
  Slider,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ImagePicker from 'react-native-image-picker';
import { colors } from '../../utils/colors';
import { productionAPI } from '../../services/api';
import LoadingScreen from '../../components/LoadingScreen';
import ProductionProgressBar from '../../components/ProductionProgressBar';
import { PRODUCTION_STATUS } from '../../utils/constants';

const ProductionUpdateScreen = ({ route, navigation }) => {
  const { productionId } = route.params;
  const [production, setProduction] = useState(null);
  const [percentComplete, setPercentComplete] = useState(0);
  const [status, setStatus] = useState(PRODUCTION_STATUS.IN_PROGRESS);
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const statusOptions = [
    { value: PRODUCTION_STATUS.NOT_STARTED, label: 'Not Started', icon: 'circle-outline' },
    { value: PRODUCTION_STATUS.IN_PROGRESS, label: 'In Progress', icon: 'sync' },
    { value: PRODUCTION_STATUS.ON_HOLD, label: 'On Hold', icon: 'pause-circle-outline' },
    { value: PRODUCTION_STATUS.QUALITY_CHECK, label: 'Quality Check', icon: 'clipboard-check' },
    { value: PRODUCTION_STATUS.COMPLETED, label: 'Completed', icon: 'check-circle' },
  ];

  useEffect(() => {
    fetchProductionDetails();
  }, []);

  const fetchProductionDetails = async () => {
    try {
      setLoading(true);
      const response = await productionAPI.getById(productionId);
      setProduction(response.data);
      setPercentComplete(response.data.percentComplete || 0);
      setStatus(response.data.status || PRODUCTION_STATUS.IN_PROGRESS);
      setNotes(response.data.notes || '');
      setPhotos(response.data.photos || []);
    } catch (error) {
      console.error('Error fetching production details:', error);
      Alert.alert('Error', 'Failed to load production details');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPhoto = () => {
    ImagePicker.launchCamera(
      {
        mediaType: 'photo',
        quality: 0.7,
        cameraType: 'back',
      },
      (response) => {
        if (response.didCancel) {
          console.log('User cancelled image picker');
        } else if (response.errorCode) {
          Alert.alert('Error', 'Failed to capture photo');
        } else {
          const newPhoto = {
            uri: response.assets[0].uri,
            type: response.assets[0].type,
            fileName: response.assets[0].fileName,
          };
          setPhotos([...photos, newPhoto]);
        }
      }
    );
  };

  const handleRemovePhoto = (index) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleUpdateProduction = async () => {
    if (percentComplete < 0 || percentComplete > 100) {
      Alert.alert('Error', 'Progress must be between 0 and 100%');
      return;
    }

    Alert.alert(
      'Update Production Status',
      'Are you sure you want to update the production status?',
      [
        {
          text: 'Cancel',
          onPress: () => {},
          style: 'cancel',
        },
        {
          text: 'Update',
          onPress: async () => {
            await updateProduction();
          },
          style: 'default',
        },
      ]
    );
  };

  const updateProduction = async () => {
    try {
      setUpdating(true);

      // First update the status
      await productionAPI.updateStatus(
        productionId,
        percentComplete,
        status,
        notes
      );

      // Upload photos if any
      if (photos.length > 0) {
        for (const photo of photos) {
          if (photo.uri && !photo.id) {
            try {
              await productionAPI.uploadPhoto(productionId, photo);
            } catch (photoError) {
              console.error('Error uploading photo:', photoError);
            }
          }
        }
      }

      Alert.alert('Success', 'Production status updated successfully', [
        {
          text: 'OK',
          onPress: () => {
            navigation.goBack();
          },
        },
      ]);
    } catch (error) {
      console.error('Error updating production:', error);
      Alert.alert('Error', 'Failed to update production status');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return <LoadingScreen message="Loading production details..." />;
  }

  if (!production) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" size={48} color={colors.danger} />
          <Text style={styles.errorText}>Production order not found</Text>
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
          {/* Header Info */}
          <View style={styles.headerCard}>
            <Text style={styles.poNumber}>{production.poNumber}</Text>
            <Text style={styles.supplier}>{production.supplier}</Text>
            <View style={styles.headerDivider} />
            <View style={styles.headerInfo}>
              <HeaderInfoItem label="Items" value={`${production.items?.length || 0}`} />
              <HeaderInfoItem label="Total Qty" value={`${production.totalQuantity || 0}`} />
            </View>
          </View>

          {/* Progress Section */}
          <View style={styles.section}>
            <View style={styles.progressHeader}>
              <Text style={styles.sectionTitle}>Production Progress</Text>
              <Text style={styles.progressValue}>{Math.round(percentComplete)}%</Text>
            </View>
            <ProductionProgressBar
              percentage={percentComplete}
              height={12}
              showLabel={false}
            />

            {/* Slider */}
            <View style={styles.sliderContainer}>
              <Text style={styles.sliderLabel}>Adjust Progress</Text>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={100}
                value={percentComplete}
                onValueChange={setPercentComplete}
                step={5}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor={colors.border}
              />
              <View style={styles.sliderLabels}>
                <Text style={styles.sliderLabelSmall}>0%</Text>
                <Text style={styles.sliderLabelSmall}>{Math.round(percentComplete)}%</Text>
                <Text style={styles.sliderLabelSmall}>100%</Text>
              </View>
            </View>

            {/* Quick Buttons */}
            <View style={styles.quickButtonsRow}>
              <QuickProgressButton label="25%" onPress={() => setPercentComplete(25)} />
              <QuickProgressButton label="50%" onPress={() => setPercentComplete(50)} />
              <QuickProgressButton label="75%" onPress={() => setPercentComplete(75)} />
              <QuickProgressButton label="100%" onPress={() => setPercentComplete(100)} />
            </View>
          </View>

          {/* Status Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Production Status</Text>
            <View style={styles.statusGrid}>
              {statusOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.statusButton,
                    status === option.value && styles.statusButtonActive,
                  ]}
                  onPress={() => setStatus(option.value)}
                >
                  <Icon
                    name={option.icon}
                    size={20}
                    color={status === option.value ? colors.surface : colors.primary}
                  />
                  <Text
                    style={[
                      styles.statusButtonLabel,
                      status === option.value && styles.statusButtonLabelActive,
                    ]}
                    numberOfLines={2}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Items Status */}
          {production.items && production.items.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Item Status</Text>
              <View style={styles.itemsList}>
                {production.items.map((item, index) => (
                  <View key={index} style={styles.itemCheckRow}>
                    <Icon
                      name={item.completed ? 'check-circle' : 'circle-outline'}
                      size={20}
                      color={item.completed ? colors.success : colors.textSecondary}
                    />
                    <View style={styles.itemCheckInfo}>
                      <Text style={styles.itemCheckName}>{item.productName}</Text>
                      <Text style={styles.itemCheckQty}>Qty: {item.quantity}</Text>
                    </View>
                    {item.completed && (
                      <Text style={styles.completedBadge}>✓ Done</Text>
                    )}
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Photos Section */}
          <View style={styles.section}>
            <View style={styles.photosHeader}>
              <Text style={styles.sectionTitle}>Production Photos</Text>
              <TouchableOpacity
                style={styles.addPhotoButton}
                onPress={handleAddPhoto}
              >
                <Icon name="camera-plus" size={18} color={colors.primary} />
                <Text style={styles.addPhotoText}>Add Photo</Text>
              </TouchableOpacity>
            </View>

            {photos.length > 0 ? (
              <View style={styles.photosGrid}>
                {photos.map((photo, index) => (
                  <View key={index} style={styles.photoContainer}>
                    <Image
                      source={{ uri: photo.uri }}
                      style={styles.photoImage}
                    />
                    <TouchableOpacity
                      style={styles.removePhotoButton}
                      onPress={() => handleRemovePhoto(index)}
                    >
                      <Icon name="close-circle" size={24} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.noPhotosPlaceholder}>
                <Icon name="camera-off" size={40} color={colors.textMuted} />
                <Text style={styles.noPhotosText}>No photos yet</Text>
              </View>
            )}
          </View>

          {/* Notes Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes & Comments</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Add notes about production progress..."
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
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
            disabled={updating}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.updateButton, updating && styles.buttonDisabled]}
            onPress={handleUpdateProduction}
            disabled={updating}
          >
            {updating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Icon name="check-circle" size={18} color="#fff" />
                <Text style={styles.updateButtonText}>Save Update</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const HeaderInfoItem = ({ label, value }) => (
  <View style={styles.headerInfoItem}>
    <Text style={styles.headerInfoLabel}>{label}</Text>
    <Text style={styles.headerInfoValue}>{value}</Text>
  </View>
);

const QuickProgressButton = ({ label, onPress }) => (
  <TouchableOpacity style={styles.quickButton} onPress={onPress}>
    <Text style={styles.quickButtonText}>{label}</Text>
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
  headerCard: {
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
  poNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  supplier: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  headerDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  headerInfo: {
    flexDirection: 'row',
    gap: 24,
  },
  headerInfoItem: {
    flex: 1,
  },
  headerInfoLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  headerInfoValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
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
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  progressValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
  },
  sliderContainer: {
    marginTop: 16,
  },
  sliderLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  sliderLabelSmall: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  quickButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  quickButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: colors.lighter,
    borderRadius: 8,
    alignItems: 'center',
  },
  quickButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusButton: {
    width: '31%',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 6,
  },
  statusButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  statusButtonLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  statusButtonLabelActive: {
    color: colors.surface,
  },
  itemsList: {
    gap: 10,
  },
  itemCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.background,
    borderRadius: 8,
  },
  itemCheckInfo: {
    flex: 1,
  },
  itemCheckName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  itemCheckQty: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  completedBadge: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.success,
  },
  photosHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: colors.lighter,
    borderRadius: 6,
  },
  addPhotoText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoContainer: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.background,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
  },
  noPhotosPlaceholder: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.background,
    borderRadius: 8,
  },
  noPhotosText: {
    fontSize: 12,
    color: colors.textSecondary,
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
  updateButton: {
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
  updateButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default ProductionUpdateScreen;
