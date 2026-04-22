import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors } from '../../utils/colors';
import { quotationService } from '../../services/api';
import LoadingScreen from '../../components/LoadingScreen';
import StatusBadge from '../../components/StatusBadge';
import { formatDate, formatCurrency } from '../../utils/formatters';

const QuotationDetailScreen = ({ route, navigation }) => {
  const { quotationId } = route.params;
  const [quotation, setQuotation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState(false);

  useEffect(() => {
    loadQuotation();
  }, []);

  const loadQuotation = async () => {
    try {
      const response = await quotationService.getById(quotationId);
      setQuotation(response.data);
    } catch (error) {
      console.error('Error loading quotation:', error);
      Alert.alert('Error', 'Failed to load quotation');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    Alert.alert(
      'Accept Quotation',
      'Accept this quotation and create an order?',
      [
        { text: 'Cancel', onPress: () => {}, style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            setActioning(true);
            try {
              await quotationService.accept(quotationId);
              Alert.alert('Success', 'Quotation accepted. Order created.', [
                {
                  text: 'OK',
                  onPress: () =>
                    navigation.navigate('QuotationList'),
                },
              ]);
            } catch (error) {
              Alert.alert('Error', 'Failed to accept quotation');
            } finally {
              setActioning(false);
            }
          },
        },
      ]
    );
  };

  const handleReject = async () => {
    Alert.alert(
      'Reject Quotation',
      'Are you sure you want to reject this quotation?',
      [
        { text: 'Cancel', onPress: () => {}, style: 'cancel' },
        {
          text: 'Reject',
          onPress: async () => {
            setActioning(true);
            try {
              await quotationService.reject(quotationId);
              Alert.alert('Success', 'Quotation rejected', [
                {
                  text: 'OK',
                  onPress: () =>
                    navigation.navigate('QuotationList'),
                },
              ]);
            } catch (error) {
              Alert.alert('Error', 'Failed to reject quotation');
            } finally {
              setActioning(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (!quotation) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Quotation not found</Text>
      </View>
    );
  }

  const canAccept = ['sent', 'viewed'].includes(quotation.status);
  const canReject = ['sent', 'viewed'].includes(quotation.status);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header Card */}
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.quotationNumber}>{quotation.number}</Text>
              <Text style={styles.quotationDate}>
                {formatDate(quotation.createdAt, 'MMM DD, YYYY')}
              </Text>
            </View>
            <StatusBadge status={quotation.status} />
          </View>
          <View style={styles.headerAmount}>
            <Text style={styles.label}>Quotation Amount</Text>
            <Text style={styles.amount}>{formatCurrency(quotation.total)}</Text>
          </View>
        </View>

        {/* Info Grid */}
        <View style={styles.infoGrid}>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Valid Until</Text>
            <Text style={styles.infoValue}>
              {quotation.expiryDate
                ? formatDate(quotation.expiryDate, 'MMM DD, YYYY')
                : 'N/A'}
            </Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Items</Text>
            <Text style={styles.infoValue}>{quotation.items?.length || 0}</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Discount</Text>
            <Text style={styles.infoValue}>
              {quotation.discountAmount ? formatCurrency(quotation.discountAmount) : 'None'}
            </Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Tax</Text>
            <Text style={styles.infoValue}>
              {quotation.taxAmount ? formatCurrency(quotation.taxAmount) : 'Calculated'}
            </Text>
          </View>
        </View>

        {/* Items Section */}
        <View style={styles.itemsSection}>
          <Text style={styles.sectionTitle}>Line Items</Text>
          {quotation.items && quotation.items.length > 0 ? (
            quotation.items.map((item, index) => (
              <View key={index} style={styles.itemCard}>
                <View style={styles.itemLeft}>
                  <Text style={styles.itemName}>{item.productName}</Text>
                  <Text style={styles.itemSku}>SKU: {item.sku}</Text>
                </View>
                <View style={styles.itemRight}>
                  <Text style={styles.itemQty}>Qty: {item.quantity}</Text>
                  <Text style={styles.itemPrice}>
                    {formatCurrency(item.unitPrice)}
                  </Text>
                  <Text style={styles.itemTotal}>
                    {formatCurrency(item.totalPrice)}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No items</Text>
          )}
        </View>

        {/* Summary Section */}
        <View style={styles.summarySection}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(quotation.subtotal || quotation.total)}
            </Text>
          </View>
          {quotation.discountAmount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Discount</Text>
              <Text style={[styles.summaryValue, { color: colors.accent }]}>
                -{formatCurrency(quotation.discountAmount)}
              </Text>
            </View>
          )}
          {quotation.taxAmount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tax</Text>
              <Text style={styles.summaryValue}>
                {formatCurrency(quotation.taxAmount)}
              </Text>
            </View>
          )}
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatCurrency(quotation.total)}</Text>
          </View>
        </View>

        {/* Notes */}
        {quotation.notes && (
          <View style={styles.notesSection}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{quotation.notes}</Text>
            </View>
          </View>
        )}

        {/* Terms */}
        {quotation.terms && (
          <View style={styles.termsSection}>
            <Text style={styles.sectionTitle}>Terms & Conditions</Text>
            <View style={styles.termsCard}>
              <Text style={styles.termsText}>{quotation.terms}</Text>
            </View>
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Action Buttons */}
      {(canAccept || canReject) && (
        <View style={styles.actionButtons}>
          {canReject && (
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.actionButtonSecondary,
                actioning && styles.buttonDisabled,
              ]}
              onPress={handleReject}
              disabled={actioning}
            >
              {actioning ? (
                <ActivityIndicator color={colors.error} size="small" />
              ) : (
                <>
                  <Icon name="close-circle" size={18} color={colors.error} />
                  <Text style={styles.actionButtonTextSecondary}>Reject</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {canAccept && (
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.actionButtonPrimary,
                actioning && styles.buttonDisabled,
              ]}
              onPress={handleAccept}
              disabled={actioning}
            >
              {actioning ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <>
                  <Icon name="checkmark-circle" size={18} color={colors.white} />
                  <Text style={styles.actionButtonText}>Accept</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
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
  headerCard: {
    backgroundColor: colors.primaryLight,
    marginHorizontal: 12,
    marginVertical: 12,
    borderRadius: 12,
    padding: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  quotationNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray900,
  },
  quotationDate: {
    fontSize: 12,
    color: colors.gray600,
    marginTop: 4,
  },
  headerAmount: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.white,
  },
  label: {
    fontSize: 12,
    color: colors.gray600,
  },
  amount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
    marginTop: 4,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  infoCard: {
    flex: 1,
    minWidth: '48%',
    backgroundColor: colors.gray50,
    borderRadius: 8,
    padding: 12,
  },
  infoLabel: {
    fontSize: 11,
    color: colors.gray600,
    marginBottom: 6,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray900,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray900,
    marginHorizontal: 4,
    marginBottom: 12,
  },
  itemsSection: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  itemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: colors.gray50,
    borderRadius: 8,
    marginBottom: 8,
  },
  itemLeft: {
    flex: 1,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.gray900,
  },
  itemSku: {
    fontSize: 11,
    color: colors.gray600,
    marginTop: 4,
  },
  itemRight: {
    alignItems: 'flex-end',
  },
  itemQty: {
    fontSize: 11,
    color: colors.gray600,
  },
  itemPrice: {
    fontSize: 12,
    color: colors.gray600,
    marginTop: 2,
  },
  itemTotal: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    marginTop: 2,
  },
  summarySection: {
    marginHorizontal: 12,
    marginVertical: 8,
    backgroundColor: colors.gray50,
    borderRadius: 8,
    padding: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  summaryLabel: {
    fontSize: 13,
    color: colors.gray600,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray900,
  },
  totalRow: {
    borderBottomWidth: 0,
    paddingTop: 12,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.gray900,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  notesSection: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  notesCard: {
    backgroundColor: colors.infoLight,
    borderRadius: 8,
    padding: 12,
  },
  notesText: {
    fontSize: 13,
    color: colors.gray700,
    lineHeight: 20,
  },
  termsSection: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  termsCard: {
    backgroundColor: colors.gray50,
    borderRadius: 8,
    padding: 12,
  },
  termsText: {
    fontSize: 12,
    color: colors.gray600,
    lineHeight: 18,
  },
  emptyText: {
    fontSize: 13,
    color: colors.gray500,
    textAlign: 'center',
    paddingVertical: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  actionButtonPrimary: {
    backgroundColor: colors.primary,
  },
  actionButtonSecondary: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.error,
  },
  actionButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 13,
  },
  actionButtonTextSecondary: {
    color: colors.error,
    fontWeight: '600',
    fontSize: 13,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default QuotationDetailScreen;
