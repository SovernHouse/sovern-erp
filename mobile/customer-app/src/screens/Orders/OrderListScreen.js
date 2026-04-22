import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors } from '../../utils/colors';
import { orderService } from '../../services/api';
import StatusBadge from '../../components/StatusBadge';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import { formatDate, formatCurrency } from '../../utils/formatters';

const OrderListScreen = ({ navigation }) => {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const statusFilters = [
    { id: 'all', label: 'All' },
    { id: 'confirmed', label: 'Active' },
    { id: 'shipped', label: 'Shipped' },
    { id: 'delivered', label: 'Delivered' },
  ];

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const response = await orderService.getAll();
      setOrders(response.data.data || []);
      setFilteredOrders(response.data.data || []);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadOrders().finally(() => setRefreshing(false));
  }, []);

  useEffect(() => {
    filterOrders();
  }, [selectedStatus]);

  const filterOrders = () => {
    if (selectedStatus === 'all') {
      setFilteredOrders(orders);
    } else {
      setFilteredOrders(orders.filter((o) => o.status === selectedStatus));
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <View style={styles.container}>
      {/* Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {statusFilters.map((filter) => (
          <TouchableOpacity
            key={filter.id}
            style={[
              styles.filterChip,
              selectedStatus === filter.id && styles.filterChipActive,
            ]}
            onPress={() => setSelectedStatus(filter.id)}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedStatus === filter.id && styles.filterChipTextActive,
              ]}
            >
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Orders List */}
      {filteredOrders.length > 0 ? (
        <FlatList
          data={filteredOrders}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.orderCard}
              onPress={() =>
                navigation.navigate('OrderDetail', { orderId: item.id })
              }
            >
              <View style={styles.cardContent}>
                <View style={styles.orderHeader}>
                  <Text style={styles.orderNumber}>{item.number}</Text>
                  <StatusBadge status={item.status} />
                </View>

                <View style={styles.orderDetails}>
                  <View style={styles.detailRow}>
                    <Icon name="calendar" size={14} color={colors.gray500} />
                    <Text style={styles.detailText}>
                      {formatDate(item.createdAt, 'MMM DD, YYYY')}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Icon name="cube" size={14} color={colors.gray500} />
                    <Text style={styles.detailText}>
                      {item.itemCount} items
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Icon name="cash" size={14} color={colors.gray500} />
                    <Text style={styles.detailAmount}>
                      {formatCurrency(item.total)}
                    </Text>
                  </View>
                </View>

                {item.nextDelivery && (
                  <View style={styles.deliveryInfo}>
                    <Icon name="truck" size={14} color={colors.accent} />
                    <Text style={styles.deliveryText}>
                      Est. {formatDate(item.nextDelivery, 'MMM DD')}
                    </Text>
                  </View>
                )}
              </View>

              <Icon name="chevron-forward" size={24} color={colors.gray300} />
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          scrollEnabled={true}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <EmptyState
            icon="receipt-outline"
            title="No Orders Found"
            message={
              selectedStatus === 'all'
                ? "You don't have any orders yet"
                : `No ${statusFilters.find((f) => f.id === selectedStatus)?.label.toLowerCase()} orders`
            }
          />
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
  filterScroll: {
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
    maxHeight: 50,
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.gray300,
    backgroundColor: colors.white,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.gray600,
  },
  filterChipTextActive: {
    color: colors.white,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  orderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  cardContent: {
    flex: 1,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  orderNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray900,
  },
  orderDetails: {
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  detailText: {
    fontSize: 12,
    color: colors.gray600,
  },
  detailAmount: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  deliveryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
  },
  deliveryText: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
  },
});

export default OrderListScreen;
