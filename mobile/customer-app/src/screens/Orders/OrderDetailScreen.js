import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors } from '../../utils/colors';
import { orderService } from '../../services/api';
import LoadingScreen from '../../components/LoadingScreen';
import OrderTrackerVertical from '../../components/OrderTrackerVertical';
import StatusBadge from '../../components/StatusBadge';
import { formatDate, formatCurrency, formatOrderNumber } from '../../utils/formatters';

const OrderDetailScreen = ({ route, navigation }) => {
  const { orderId } = route.params;
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrder();
  }, []);

  const loadOrder = async () => {
    try {
      const response = await orderService.getById(orderId);
      setOrder(response.data);
    } catch (error) {
      console.error('Error loading order:', error);
      Alert.alert('Error', 'Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (!order) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Order not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Order Header */}
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.orderNumber}>{order.number}</Text>
              <Text style={styles.orderDate}>
                {formatDate(order.createdAt, 'MMM DD, YYYY HH:mm')}
              </Text>
            </View>
            <StatusBadge status={order.status} />
          </View>
          <View style={styles.headerAmount}>
            <Text style={styles.label}>Order Amount</Text>
            <Text style={styles.amount}>{formatCurrency(order.total)}</Text>
          </View>
        </View>

        {/* Order Tracker */}
        <View style={styles.trackerSection}>
          <Text style={styles.sectionTitle}>Order Progress</Text>
          <OrderTrackerVertical
            currentStage={order.status}
            stages={order.stages || {}}
            estimates={order.estimates || {}}
          />
        </View>

        {/* Order Info Grid */}
        <View style={styles.infoGrid}>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>PO Number</Text>
            <Text style={styles.infoValue}>{order.poNumber || 'N/A'}</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Payment Status</Text>
            <Text
              style={[
                styles.infoValue,
                {
                  color:
                    order.paymentStatus === 'paid' ? colors.success : colors.warning,
                },
              ]}
            >
              {order.paymentStatus?.charAt(0).toUpperCase() +
                order.paymentStatus?.slice(1)}
            </Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Delivery Address</Text>
            <Text style={styles.infoValue} numberOfLines={2}>
              {order.deliveryAddress || 'N/A'}
            </Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Delivery Date</Text>
            <Text style={styles.infoValue}>
              {order.estimatedDelivery
                ? formatDate(order.estimatedDelivery, 'MMM DD')
                : 'N/A'}
            </Text>
          </View>
        </View>

        {/* Order Items */}
        <View style={styles.itemsSection}>
          <Text style={styles.sectionTitle}>Order Items</Text>
          {order.items && order.items.length > 0 ? (
            order.items.map((item, index) => (
              <View key={index} style={styles.itemCard}>
                <View style={styles.itemLeft}>
                  <Text style={styles.itemName}>{item.productName}</Text>
                  <Text style={styles.itemSku}>SKU: {item.sku}</Text>
                </View>
                <View style={styles.itemRight}>
                  <Text style={styles.itemQty}>Qty: {item.quantity}</Text>
                  <Text style={styles.itemPrice}>{formatCurrency(item.price)}</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No items</Text>
          )}
        </View>

        {/* Documents Section */}
        <View style={styles.documentsSection}>
          <Text style={styles.sectionTitle}>Documents</Text>
          {order.documents && order.documents.length > 0 ? (
            order.documents.map((doc, index) => (
              <TouchableOpacity key={index} style={styles.documentItem}>
                <Icon name="document" size={20} color={colors.primary} />
                <View style={styles.documentInfo}>
                  <Text style={styles.documentName}>{doc.name}</Text>
                  <Text style={styles.documentSize}>{doc.size}</Text>
                </View>
                <Icon name="download" size={20} color={colors.gray400} />
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.emptyText}>No documents</Text>
          )}
        </View>

        {/* Shipment Link */}
        {order.shipmentId && (
          <TouchableOpacity
            style={styles.shipmentLink}
            onPress={() =>
              navigation
                .getParent()
                .navigate('ShipmentStack', {
                  screen: 'ShipmentTracker',
                  params: { shipmentId: order.shipmentId },
                })
            }
          >
            <Icon name="truck" size={20} color={colors.primary} />
            <View style={styles.shipmentLinkContent}>
              <Text style={styles.shipmentLinkTitle}>View Shipment</Text>
              <Text style={styles.shipmentLinkSubtitle}>
                {order.shipmentNumber}
              </Text>
            </View>
            <Icon name="chevron-forward" size={20} color={colors.gray300} />
          </TouchableOpacity>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonPrimary]}
            onPress={() => {
              Alert.alert('Request Quote', 'Request a new quote for this order?', [
                { text: 'Cancel', onPress: () => {}, style: 'cancel' },
                {
                  text: 'Request',
                  onPress: () => {
                    navigation.getParent().navigate('OrderStack', {
                      screen: 'RequestQuote',
                    });
                  },
                },
              ]);
            }}
          >
            <Icon name="document-text" size={18} color={colors.white} />
            <Text style={styles.actionButtonText}>Request Quote</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonSecondary]}
            onPress={() => {
              Alert.alert('File Claim', 'File a claim for this order?', [
                { text: 'Cancel', onPress: () => {}, style: 'cancel' },
                {
                  text: 'File',
                  onPress: () => {
                    navigation.getParent().navigate('MoreStack', {
                      screen: 'ClaimForm',
                      params: { orderId: order.id },
                    });
                  },
                },
              ]);
            }}
          >
            <Icon name="alert-circle" size={18} color={colors.primary} />
            <Text style={styles.actionButtonTextSecondary}>File Claim</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
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
  orderNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray900,
  },
  orderDate: {
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
  trackerSection: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    backgroundColor: colors.white,
    marginVertical: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray900,
    marginHorizontal: 4,
    marginBottom: 12,
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
    fontSize: 12,
    color: colors.gray600,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    marginTop: 4,
  },
  documentsSection: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.gray50,
    borderRadius: 8,
    marginBottom: 8,
    gap: 12,
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.gray900,
  },
  documentSize: {
    fontSize: 11,
    color: colors.gray600,
    marginTop: 2,
  },
  shipmentLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginVertical: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
    gap: 12,
  },
  shipmentLinkContent: {
    flex: 1,
  },
  shipmentLinkTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray900,
  },
  shipmentLinkSubtitle: {
    fontSize: 11,
    color: colors.gray600,
    marginTop: 2,
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
    borderColor: colors.primary,
  },
  actionButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 13,
  },
  actionButtonTextSecondary: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 13,
  },
});

export default OrderDetailScreen;
