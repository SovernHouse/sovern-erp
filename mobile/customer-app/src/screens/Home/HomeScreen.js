import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  FlatList,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../utils/colors';
import { statsService, orderService } from '../../services/api';
import Header from '../../components/Header';
import LoadingScreen from '../../components/LoadingScreen';
import StatusBadge from '../../components/StatusBadge';
import { formatDate, formatCurrency } from '../../utils/formatters';

const HomeScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [userData, setUserData] = useState(null);
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userDataStr = await AsyncStorage.getItem('userData');
      if (userDataStr) {
        setUserData(JSON.parse(userDataStr));
      }

      // Load stats and recent orders
      const [statsRes, ordersRes] = await Promise.all([
        statsService.getSummary(),
        orderService.getAll({ limit: 5 }),
      ]);

      setStats(statsRes.data);
      setOrders(ordersRes.data.data);
    } catch (error) {
      console.error('Error loading home data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData().finally(() => setRefreshing(false));
  }, []);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Header
        title={`Hi, ${userData?.firstName || 'Customer'}`}
        subtitle={userData?.company || 'Welcome back!'}
      />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Quick Stats Row */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={styles.statIconBox}>
              <Icon name="receipt" size={24} color={colors.primary} />
            </View>
            <Text style={styles.statNumber}>{stats?.activeOrders || 0}</Text>
            <Text style={styles.statLabel}>Active Orders</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statIconBox}>
              <Icon name="truck" size={24} color={colors.accent} />
            </View>
            <Text style={styles.statNumber}>{stats?.inTransit || 0}</Text>
            <Text style={styles.statLabel}>In Transit</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statIconBox}>
              <Icon name="hourglass" size={24} color={colors.warning} />
            </View>
            <Text style={styles.statNumber}>{stats?.pendingQuotes || 0}</Text>
            <Text style={styles.statLabel}>Pending Quotes</Text>
          </View>
        </View>

        {/* Active Shipment Card */}
        {stats?.activeShipment && (
          <View style={styles.shipmentCard}>
            <View style={styles.shipmentHeader}>
              <Text style={styles.shipmentTitle}>Active Shipment</Text>
              <TouchableOpacity
                onPress={() =>
                  navigation.getParent().navigate('ShipmentStack', {
                    screen: 'ShipmentTracker',
                    params: { shipmentId: stats.activeShipment.id },
                  })
                }
              >
                <Text style={styles.viewMore}>View</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.shipmentInfo}>
              <Text style={styles.shipmentNumber}>{stats.activeShipment.number}</Text>
              <Text style={styles.shipmentRoute}>
                {stats.activeShipment.origin} → {stats.activeShipment.destination}
              </Text>
            </View>

            {/* Mini Tracker */}
            <View style={styles.miniTracker}>
              <View style={styles.trackerDots}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.trackerDot,
                      {
                        backgroundColor:
                          i <= (stats.activeShipment.progress || 0) / 25
                            ? colors.primary
                            : colors.gray300,
                      },
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.trackerLabel}>
                {stats.activeShipment.progress || 0}% Complete
              </Text>
            </View>

            <View style={styles.shipmentFooter}>
              <Text style={styles.etaLabel}>Est. Delivery</Text>
              <Text style={styles.etaDate}>
                {formatDate(stats.activeShipment.eta, 'MMM DD')}
              </Text>
            </View>
          </View>
        )}

        {/* Recent Orders Section */}
        <View style={styles.recentOrdersSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Orders</Text>
            <TouchableOpacity
              onPress={() => navigation.getParent().navigate('OrderStack', { screen: 'OrderList' })}
            >
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>

          {orders.length > 0 ? (
            orders.map((order) => (
              <TouchableOpacity
                key={order.id}
                style={styles.orderItem}
                onPress={() =>
                  navigation.getParent().navigate('OrderStack', {
                    screen: 'OrderDetail',
                    params: { orderId: order.id },
                  })
                }
              >
                <View style={styles.orderContent}>
                  <Text style={styles.orderNumber}>{order.number}</Text>
                  <Text style={styles.orderDate}>
                    {formatDate(order.createdAt, 'MMM DD, YYYY')}
                  </Text>
                </View>
                <View style={styles.orderRight}>
                  <Text style={styles.orderAmount}>{formatCurrency(order.total)}</Text>
                  <StatusBadge status={order.status} />
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.emptyText}>No recent orders</Text>
          )}
        </View>

        {/* Quick Action Buttons */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() =>
                navigation.getParent().navigate('ProductStack', { screen: 'ProductCatalog' })
              }
            >
              <Icon name="cube" size={24} color={colors.primary} />
              <Text style={styles.actionButtonText}>Browse Products</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() =>
                navigation.getParent().navigate('OrderStack', { screen: 'RequestQuote' })
              }
            >
              <Icon name="document" size={24} color={colors.primary} />
              <Text style={styles.actionButtonText}>Request Quote</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() =>
                navigation.getParent().navigate('ShipmentStack', { screen: 'ShipmentList' })
              }
            >
              <Icon name="truck" size={24} color={colors.primary} />
              <Text style={styles.actionButtonText}>Track Shipment</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() =>
                navigation.getParent().navigate('MoreStack', { screen: 'Claims' })
              }
            >
              <Icon name="alert-circle" size={24} color={colors.primary} />
              <Text style={styles.actionButtonText}>File Claim</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Notifications Section */}
        <View style={styles.notificationSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Notifications</Text>
          </View>
          <View style={[styles.notificationItem, styles.infoNotification]}>
            <Icon name="information-circle" size={20} color={colors.info} />
            <View style={styles.notificationContent}>
              <Text style={styles.notificationTitle}>New Quote Available</Text>
              <Text style={styles.notificationTime}>2 hours ago</Text>
            </View>
          </View>
          <View style={[styles.notificationItem, styles.successNotification]}>
            <Icon name="checkmark-circle" size={20} color={colors.success} />
            <View style={styles.notificationContent}>
              <Text style={styles.notificationTitle}>Order Shipped</Text>
              <Text style={styles.notificationTime}>5 hours ago</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  scrollView: {
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  statIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.gray900,
  },
  statLabel: {
    fontSize: 11,
    color: colors.gray600,
    marginTop: 4,
    textAlign: 'center',
  },
  shipmentCard: {
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    padding: 16,
  },
  shipmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  shipmentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray900,
  },
  viewMore: {
    color: colors.primary,
    fontWeight: '500',
    fontSize: 12,
  },
  shipmentInfo: {
    marginBottom: 12,
  },
  shipmentNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray900,
  },
  shipmentRoute: {
    fontSize: 12,
    color: colors.gray600,
    marginTop: 4,
  },
  miniTracker: {
    marginVertical: 12,
  },
  trackerDots: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  trackerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  trackerLabel: {
    fontSize: 12,
    color: colors.gray600,
  },
  shipmentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.white,
  },
  etaLabel: {
    fontSize: 12,
    color: colors.gray600,
  },
  etaDate: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  recentOrdersSection: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray900,
  },
  seeAll: {
    color: colors.primary,
    fontWeight: '500',
    fontSize: 12,
  },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.gray50,
    borderRadius: 8,
    marginBottom: 8,
  },
  orderContent: {
    flex: 1,
  },
  orderNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray900,
  },
  orderDate: {
    fontSize: 12,
    color: colors.gray500,
    marginTop: 4,
  },
  orderRight: {
    alignItems: 'flex-end',
  },
  orderAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray900,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 14,
    color: colors.gray500,
    textAlign: 'center',
    paddingVertical: 16,
  },
  actionsSection: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    width: '48%',
    backgroundColor: colors.white,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  actionButtonText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
    marginTop: 6,
    textAlign: 'center',
  },
  notificationSection: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  infoNotification: {
    backgroundColor: colors.infoLight,
  },
  successNotification: {
    backgroundColor: colors.successLight,
  },
  notificationContent: {
    flex: 1,
    marginLeft: 12,
  },
  notificationTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.gray900,
  },
  notificationTime: {
    fontSize: 11,
    color: colors.gray500,
    marginTop: 2,
  },
});

export default HomeScreen;
