import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors } from '../../utils/colors';
import { claimService, orderService } from '../../services/api';
import LoadingScreen from '../../components/LoadingScreen';

const ClaimFormScreen = ({ route, navigation }) => {
  const { orderId } = route.params || {};

  const [step, setStep] = useState(1); // 1: Select Order, 2: Details, 3: Upload Photos, 4: Review
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [claimType, setClaimType] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState([]);
  const [priority, setPriority] = useState('medium');
  const [loading, setLoading] = useState(step === 1);
  const [submitting, setSubmitting] = useState(false);

  const claimTypes = ['Damage', 'Wrong Item', 'Quantity Shortage', 'Quality Issue', 'Other'];
  const priorityOptions = ['low', 'medium', 'high', 'urgent'];

  useEffect(() => {
    if (step === 1) {
      loadOrders();
    }
  }, [step]);

  const loadOrders = async () => {
    try {
      const response = await orderService.getAll({ status: 'delivered' });
      setOrders(response.data.data || []);

      // If orderId provided in params, select it
      if (orderId) {
        const order = response.data.data.find((o) => o.id === orderId);
        if (order) {
          setSelectedOrder(order);
          setStep(2);
        }
      }
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOrder = (order) => {
    setSelectedOrder(order);
    setSelectedItems([]);
    setStep(2);
  };

  const handleSelectItem = (item) => {
    const isSelected = selectedItems.some((i) => i.id === item.id);
    if (isSelected) {
      setSelectedItems(selectedItems.filter((i) => i.id !== item.id));
    } else {
      setSelectedItems([...selectedItems, item]);
    }
  };

  const handleSubmitClaim = async () => {
    if (!selectedOrder || selectedItems.length === 0) {
      Alert.alert('Missing Info', 'Please select order and items');
      return;
    }

    if (!claimType) {
      Alert.alert('Missing Info', 'Please select claim type');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        orderId: selectedOrder.id,
        itemIds: selectedItems.map((i) => i.id),
        type: claimType,
        description: description,
        priority: priority,
        photos: photos.map((p) => p.uri), // Mock - in real app, would upload photos
      };

      await claimService.create(payload);
      Alert.alert(
        'Success',
        'Claim submitted successfully. Our team will review it shortly.',
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.navigate('ClaimList');
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to submit claim');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && step === 1) {
    return <LoadingScreen />;
  }

  // Step 1: Select Order
  if (step === 1) {
    return (
      <View style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.stepTitle}>Select Order</Text>
          <Text style={styles.stepDescription}>
            Choose the order you want to file a claim for
          </Text>

          {orders.length > 0 ? (
            orders.map((order) => (
              <TouchableOpacity
                key={order.id}
                style={styles.orderSelectCard}
                onPress={() => handleSelectOrder(order)}
              >
                <View style={styles.orderSelectInfo}>
                  <Text style={styles.orderSelectNumber}>{order.number}</Text>
                  <Text style={styles.orderSelectDate}>
                    Delivered {order.deliveredDate}
                  </Text>
                  <Text style={styles.orderSelectItems}>
                    {order.itemCount} items
                  </Text>
                </View>
                <Icon name="chevron-forward" size={24} color={colors.primary} />
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyMessage}>
              <Icon name="inbox-outline" size={48} color={colors.gray300} />
              <Text style={styles.emptyText}>No delivered orders found</Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  // Step 2: Select Items & Details
  if (step === 2) {
    return (
      <View style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.stepTitle}>Order Details</Text>

          {/* Order Summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>{selectedOrder?.number}</Text>
            <Text style={styles.summaryText}>{selectedOrder?.itemCount} items</Text>
          </View>

          {/* Select Items */}
          <Text style={styles.sectionTitle}>Affected Items</Text>
          {selectedOrder?.items?.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.itemCheckBox,
                selectedItems.some((i) => i.id === item.id) && styles.itemCheckBoxSelected,
              ]}
              onPress={() => handleSelectItem(item)}
            >
              <View style={styles.checkBox}>
                {selectedItems.some((i) => i.id === item.id) && (
                  <Icon name="checkmark" size={16} color={colors.white} />
                )}
              </View>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.productName}</Text>
                <Text style={styles.itemDetails}>Qty: {item.quantity}</Text>
              </View>
            </TouchableOpacity>
          ))}

          {/* Claim Type */}
          <Text style={styles.sectionTitle}>Claim Type</Text>
          <View style={styles.typeGrid}>
            {claimTypes.map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.typeChip,
                  claimType === type && styles.typeChipSelected,
                ]}
                onPress={() => setClaimType(type)}
              >
                <Text
                  style={[
                    styles.typeChipText,
                    claimType === type && styles.typeChipTextSelected,
                  ]}
                >
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Priority */}
          <Text style={styles.sectionTitle}>Priority</Text>
          <View style={styles.priorityGrid}>
            {priorityOptions.map((p) => (
              <TouchableOpacity
                key={p}
                style={[
                  styles.priorityOption,
                  priority === p && styles.priorityOptionSelected,
                ]}
                onPress={() => setPriority(p)}
              >
                <Text
                  style={[
                    styles.priorityText,
                    priority === p && styles.priorityTextSelected,
                  ]}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Description */}
          <Text style={styles.sectionTitle}>Description</Text>
          <TextInput
            style={styles.descriptionInput}
            placeholder="Describe the issue in detail..."
            placeholderTextColor={colors.gray400}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
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
            style={[
              styles.nextButton,
              selectedItems.length === 0 && styles.buttonDisabled,
            ]}
            onPress={() => setStep(3)}
            disabled={selectedItems.length === 0}
          >
            <Text style={styles.nextButtonText}>Continue</Text>
            <Icon name="chevron-forward" size={20} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Step 3: Upload Photos
  if (step === 3) {
    return (
      <View style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.stepTitle}>Add Photos</Text>
          <Text style={styles.stepDescription}>
            Upload photos of the damaged or affected items (optional but recommended)
          </Text>

          <TouchableOpacity style={styles.uploadButton}>
            <Icon name="camera" size={32} color={colors.primary} />
            <Text style={styles.uploadText}>Take Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.uploadButton}>
            <Icon name="image" size={32} color={colors.primary} />
            <Text style={styles.uploadText}>Choose from Gallery</Text>
          </TouchableOpacity>

          {photos.length > 0 && (
            <View style={styles.photosSection}>
              <Text style={styles.sectionTitle}>Uploaded Photos ({photos.length})</Text>
              {photos.map((photo, index) => (
                <View key={index} style={styles.photoItem}>
                  <Icon name="image" size={24} color={colors.primary} />
                  <Text style={styles.photoName} numberOfLines={1}>
                    Photo {index + 1}
                  </Text>
                  <TouchableOpacity onPress={() => setPhotos(photos.filter((_, i) => i !== index))}>
                    <Icon name="close" size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        <View style={styles.stepFooter}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setStep(2)}
          >
            <Icon name="chevron-back" size={20} color={colors.primary} />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.nextButton}
            onPress={() => setStep(4)}
          >
            <Text style={styles.nextButtonText}>Review</Text>
            <Icon name="chevron-forward" size={20} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Step 4: Review
  if (step === 4) {
    return (
      <View style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.stepTitle}>Review Claim</Text>

          <View style={styles.reviewCard}>
            <Text style={styles.reviewCardTitle}>Order</Text>
            <Text style={styles.reviewValue}>{selectedOrder?.number}</Text>
          </View>

          <View style={styles.reviewCard}>
            <Text style={styles.reviewCardTitle}>Affected Items</Text>
            {selectedItems.map((item) => (
              <Text key={item.id} style={styles.reviewValue}>
                • {item.productName}
              </Text>
            ))}
          </View>

          <View style={styles.reviewCard}>
            <Text style={styles.reviewCardTitle}>Claim Type</Text>
            <Text style={styles.reviewValue}>{claimType}</Text>
          </View>

          <View style={styles.reviewCard}>
            <Text style={styles.reviewCardTitle}>Priority</Text>
            <Text style={styles.reviewValue}>
              {priority.charAt(0).toUpperCase() + priority.slice(1)}
            </Text>
          </View>

          {description && (
            <View style={styles.reviewCard}>
              <Text style={styles.reviewCardTitle}>Description</Text>
              <Text style={styles.reviewValue}>{description}</Text>
            </View>
          )}

          {photos.length > 0 && (
            <View style={styles.reviewCard}>
              <Text style={styles.reviewCardTitle}>Photos</Text>
              <Text style={styles.reviewValue}>{photos.length} photo(s) attached</Text>
            </View>
          )}

          <View style={styles.confirmationBox}>
            <Icon name="information-circle" size={24} color={colors.info} />
            <Text style={styles.confirmationText}>
              We will review your claim and get back to you within 2-3 business days
            </Text>
          </View>
        </ScrollView>

        <View style={styles.stepFooter}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setStep(3)}
            disabled={submitting}
          >
            <Icon name="chevron-back" size={20} color={colors.primary} />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.nextButton, submitting && styles.buttonDisabled]}
            onPress={handleSubmitClaim}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <>
                <Text style={styles.nextButtonText}>Submit Claim</Text>
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
  stepTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.gray900,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 6,
  },
  stepDescription: {
    fontSize: 13,
    color: colors.gray600,
    marginHorizontal: 16,
    marginBottom: 16,
    lineHeight: 18,
  },
  orderSelectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.gray50,
    borderRadius: 8,
  },
  orderSelectInfo: {
    flex: 1,
  },
  orderSelectNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray900,
  },
  orderSelectDate: {
    fontSize: 12,
    color: colors.gray600,
    marginTop: 4,
  },
  orderSelectItems: {
    fontSize: 12,
    color: colors.gray600,
    marginTop: 4,
  },
  emptyMessage: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: colors.gray500,
    marginTop: 12,
  },
  summaryCard: {
    marginHorizontal: 16,
    marginBottom: 20,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray900,
  },
  summaryText: {
    fontSize: 12,
    color: colors.gray600,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray900,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 10,
  },
  itemCheckBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.gray50,
    borderRadius: 8,
  },
  itemCheckBoxSelected: {
    backgroundColor: colors.primaryLight,
  },
  checkBox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    backgroundColor: colors.primary,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray900,
  },
  itemDetails: {
    fontSize: 11,
    color: colors.gray600,
    marginTop: 2,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: 16,
    gap: 8,
    marginBottom: 16,
  },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.gray300,
    backgroundColor: colors.white,
  },
  typeChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeChipText: {
    fontSize: 12,
    color: colors.gray600,
    fontWeight: '500',
  },
  typeChipTextSelected: {
    color: colors.white,
  },
  priorityGrid: {
    flexDirection: 'row',
    marginHorizontal: 16,
    gap: 8,
    marginBottom: 16,
  },
  priorityOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.gray300,
    alignItems: 'center',
  },
  priorityOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  priorityText: {
    fontSize: 12,
    color: colors.gray600,
    fontWeight: '500',
  },
  priorityTextSelected: {
    color: colors.white,
  },
  descriptionInput: {
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: 8,
    fontSize: 13,
    color: colors.gray900,
    minHeight: 120,
  },
  uploadButton: {
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
  },
  uploadText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  photosSection: {
    marginHorizontal: 16,
    marginTop: 12,
  },
  photoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    backgroundColor: colors.gray50,
    borderRadius: 8,
    gap: 12,
  },
  photoName: {
    flex: 1,
    fontSize: 13,
    color: colors.gray900,
  },
  reviewCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.gray50,
    borderRadius: 8,
  },
  reviewCardTitle: {
    fontSize: 12,
    color: colors.gray600,
    marginBottom: 6,
  },
  reviewValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray900,
  },
  confirmationBox: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 20,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.infoLight,
    borderRadius: 8,
    gap: 12,
  },
  confirmationText: {
    flex: 1,
    fontSize: 12,
    color: colors.gray700,
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
    gap: 4,
  },
  backButtonText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: 8,
    gap: 4,
  },
  nextButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 13,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default ClaimFormScreen;
