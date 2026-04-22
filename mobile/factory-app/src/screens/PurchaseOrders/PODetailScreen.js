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
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../../utils/colors';
import { formatDate, formatCurrency, daysUntil } from '../../utils/formatters';
import { poAPI } from '../../services/api';
import LoadingScreen from '../../components/LoadingScreen';
import StatusBadge from '../../components/StatusBadge';
import { LABEL_STATUS, PO_STATUS } from '../../utils/constants';

const PODetailScreen = ({ route, navigation }) => {
  const { poId } = route.params;
  const [po, setPO] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchPODetails();
  }, [poId]);

  const fetchPODetails = async () => {
    try {
      setLoading(true);
      const response = await poAPI.getById(poId);
      setPO(response.data);
    } catch (error) {
      console.error('Error fetching PO details:', error);
      Alert.alert('Error', 'Failed to load purchase order details');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPO = () => {
    navigation.navigate('POConfirmStack', { poId });
  };

  const handleRejectPO = () => {
    Alert.prompt(
      'Reject Purchase Order',
      'Please provide a reason for rejection:',
      [
        {
          text: 'Cancel',
          onPress: () => {},
          style: 'cancel',
        },
        {
          text: 'Reject',
          onPress: async (reason) => {
            if (!reason?.trim()) {
              Alert.alert('Error', 'Please provide a reason');
              return;
            }
            await rejectPO(reason);
          },
          style: 'destructive',
        },
      ],
      'plain-text'
    );
  };

  const rejectPO = async (reason) => {
    try {
      setActionLoading(true);
      await poAPI.rejectPO(poId, reason);
      Alert.alert('Success', 'Purchase order rejected successfully');
      fetchPODetails();
    } catch (error) {
      console.error('Error rejecting PO:', error);
      Alert.alert('Error', 'Failed to reject purchase order');
    } finally {
      setActionLoading(false);
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

  const daysLeft = daysUntil(po.deliveryDate);
  const isOverdue = daysLeft < 0;
  const canConfirm = po.status === PO_STATUS.DRAFT;
  const canReject = [PO_STATUS.DRAFT, PO_STATUS.CONFIRMED].includes(po.status);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header Card */}
        <View style={styles.headerCard}>
          <View style={styles.titleRow}>
            <View style={styles.titleContent}>
              <Text style={styles.poNumber}>{po.poNumber}</Text>
              <Text style={styles.supplier}>{po.supplier?.name}</Text>
            </View>
            <StatusBadge
              status={po.status}
              label={LABEL_STATUS[po.status]}
              size="large"
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.infoGrid}>
            <InfoItem label="PO Date" value={formatDate(po.poDate)} />
            <InfoItem label="Delivery Date" value={formatDate(po.deliveryDate)} />
            <InfoItem label="Total Value" value={formatCurrency(po.totalValue)} />
            <InfoItem label="Total Quantity" value={`${po.totalQuantity} units`} />
          </View>

          <View style={styles.deliveryAlert}>
            <Icon
              name={isOverdue ? 'alert-circle' : 'calendar-outline'}
              size={20}
              color={isOverdue ? colors.danger : colors.primary}
            />
            <Text
              style={[
                styles.deliveryText,
                isOverdue && styles.deliveryTextOverdue,
              ]}
            >
              {isOverdue
                ? `${Math.abs(daysLeft)} days overdue`
                : `${daysLeft} days remaining`}
            </Text>
          </View>
        </View>

        {/* Items Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items ({po.items?.length || 0})</Text>
          {po.items && po.items.length > 0 ? (
            <View style={styles.itemsContainer}>
              {po.items.map((item, index) => (
                <View key={index} style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <View style={styles.itemTitleContainer}>
                      <Text style={styles.itemName}>{item.productName}</Text>
                      <Text style={styles.itemSKU}>SKU: {item.sku}</Text>
                    </View>
                    <Text style={styles.itemPrice}>
                      {formatCurrency(item.unitPrice)}
                    </Text>
                  </View>

                  <View style={styles.itemDetails}>
                    <View style={styles.itemDetail}>
                      <Text style={styles.detailLabel}>Quantity</Text>
                      <Text style={styles.detailValue}>{item.quantity} units</Text>
                    </View>
                    <View style={styles.itemDetail}>
                      <Text style={styles.detailLabel}>Total</Text>
                      <Text style={styles.detailValue}>
                        {formatCurrency(item.quantity * item.unitPrice)}
                      </Text>
                    </View>
                    <View style={styles.itemDetail}>
                      <Text style={styles.detailLabel}>Unit</Text>
                      <Text style={styles.detailValue}>{item.unit || 'pcs'}</Text>
                    </View>
                  </View>

                  {item.specifications && (
                    <View style={styles.specContainer}>
                      <Text style={styles.specLabel}>Specifications:</Text>
                      <Text style={styles.specValue}>{item.specifications}</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.noItems}>No items in this purchase order</Text>
          )}
        </View>

        {/* Notes Section */}
        {po.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <View style={styles.notesBox}>
              <Text style={styles.notesText}>{po.notes}</Text>
            </View>
          </View>
        )}

        {/* Special Requirements */}
        {po.specialRequirements && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Special Requirements</Text>
            <View style={styles.requirementsBox}>
              <Text style={styles.requirementsText}>
                {po.specialRequirements}
              </Text>
            </View>
          </View>
        )}

        {/* Contact Info */}
        {po.contactInfo && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact Information</Text>
            <View style={styles.contactCard}>
              <InfoItem label="Contact Person" value={po.contactInfo.name} />
              <InfoItem label="Email" value={po.contactInfo.email} />
              <InfoItem label="Phone" value={po.contactInfo.phone} />
            </View>
          </View>
        )}

        {/* Action Buttons */}
        {(canConfirm || canReject) && (
          <View style={styles.actionSection}>
            {canConfirm && (
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleConfirmPO}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Icon name="check-circle" size={20} color="#fff" />
                    <Text style={styles.confirmButtonText}>Confirm Order</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {canReject && (
              <TouchableOpacity
                style={styles.rejectButton}
                onPress={handleRejectPO}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color={colors.danger} />
                ) : (
                  <>
                    <Icon name="close-circle" size={20} color={colors.danger} />
                    <Text style={styles.rejectButtonText}>Reject Order</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const InfoItem = ({ label, value }) => (
  <View style={styles.infoItem}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
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
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  titleContent: {
    flex: 1,
  },
  poNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  supplier: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  infoGrid: {
    gap: 12,
    marginBottom: 12,
  },
  infoItem: {
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  deliveryAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.lighter,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  deliveryText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  deliveryTextOverdue: {
    color: colors.danger,
  },
  section: {
    backgroundColor: colors.surface,
    margin: 16,
    marginTop: 8,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  itemsContainer: {
    gap: 12,
  },
  itemCard: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  itemTitleContainer: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  itemSKU: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.primary,
  },
  itemDetails: {
    flexDirection: 'row',
    gap: 12,
  },
  itemDetail: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  specContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  specLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  specValue: {
    fontSize: 12,
    color: colors.text,
    lineHeight: 16,
  },
  noItems: {
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  notesBox: {
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.info,
  },
  notesText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  requirementsBox: {
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  },
  requirementsText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  contactCard: {
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: 8,
  },
  actionSection: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 24,
  },
  confirmButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
    paddingVertical: 12,
    borderRadius: 8,
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
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.danger,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  rejectButtonText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default PODetailScreen;
