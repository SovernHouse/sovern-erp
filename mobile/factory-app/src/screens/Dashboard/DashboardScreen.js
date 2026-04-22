import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../../utils/colors';
import { formatDate, daysUntil } from '../../utils/formatters';
import { dashboardAPI, poAPI, productionAPI } from '../../services/api';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import POCard from '../../components/POCard';
import { LABEL_STATUS } from '../../utils/constants';

const DashboardScreen = ({ navigation }) => {
  const [stats, setStats] = useState(null);
  const [urgentItems, setUrgentItems] = useState([]);
  const [recentPOs, setRecentPOs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsResponse, urgentResponse, posResponse] = await Promise.all([
        dashboardAPI.getStats(),
        dashboardAPI.getUrgentItems(),
        dashboardAPI.getRecentPOs(10),
      ]);

      setStats(statsResponse.data);
      setUrgentItems(urgentResponse.data);
      setRecentPOs(posResponse.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      Alert.alert('Error', 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboardData().finally(() => setRefreshing(false));
  }, []);

  if (loading) {
    return <LoadingScreen message="Loading dashboard..." />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Stats Cards */}
        <View style={styles.statsGrid}>
          <StatCard
            icon="clipboard-list"
            label="Active POs"
            value={stats?.activePOs || 0}
            color={colors.info}
            onPress={() => navigation.navigate('Orders')}
          />
          <StatCard
            icon="factory"
            label="In Production"
            value={stats?.inProduction || 0}
            color={colors.warning}
            onPress={() => navigation.navigate('Production')}
          />
          <StatCard
            icon="package-variant"
            label="Ready to Ship"
            value={stats?.readyToShip || 0}
            color={colors.success}
            onPress={() => navigation.navigate('Production')}
          />
          <StatCard
            icon="clipboard-check"
            label="Pending Inspections"
            value={stats?.pendingInspections || 0}
            color={colors.danger}
            onPress={() => navigation.navigate('More', { screen: 'InspectionList' })}
          />
        </View>

        {/* Urgent Items */}
        {urgentItems.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Urgent Items</Text>
            <View style={styles.urgentContainer}>
              {urgentItems.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.urgentItem}
                  onPress={() => {
                    if (item.type === 'po') {
                      navigation.navigate('Orders', {
                        screen: 'PODetailStack',
                        params: { poId: item.id },
                      });
                    } else if (item.type === 'inspection') {
                      navigation.navigate('More', {
                        screen: 'InspectionDetailStack',
                        params: { inspectionId: item.id },
                      });
                    }
                  }}
                >
                  <Icon
                    name={item.type === 'po' ? 'alert-circle' : 'clipboard-check'}
                    size={20}
                    color={colors.danger}
                    style={styles.urgentIcon}
                  />
                  <View style={styles.urgentContent}>
                    <Text style={styles.urgentTitle}>{item.title}</Text>
                    <Text style={styles.urgentDescription}>{item.description}</Text>
                  </View>
                  <Icon
                    name="chevron-right"
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <QuickActionButton
              icon="pencil"
              label="Update Production"
              onPress={() => navigation.navigate('Production', {
                screen: 'ProductionUpdateStack',
              })}
            />
            <QuickActionButton
              icon="file-upload"
              label="Upload Documents"
              onPress={() => navigation.navigate('Production', {
                screen: 'DocumentUploadStack',
              })}
            />
            <QuickActionButton
              icon="clipboard-check"
              label="View Inspections"
              onPress={() => navigation.navigate('More', {
                screen: 'InspectionList',
              })}
            />
            <QuickActionButton
              icon="truck-fast"
              label="Manage Shipments"
              onPress={() => navigation.navigate('Production', {
                screen: 'ShipmentList',
              })}
            />
          </View>
        </View>

        {/* Recent POs */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Purchase Orders</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Orders')}>
              <Text style={styles.viewAllLink}>View All</Text>
            </TouchableOpacity>
          </View>
          {recentPOs.length > 0 ? (
            <View style={styles.posList}>
              {recentPOs.slice(0, 3).map((po) => (
                <POCard
                  key={po.id}
                  po={po}
                  onPress={() =>
                    navigation.navigate('Orders', {
                      screen: 'PODetailStack',
                      params: { poId: po.id },
                    })
                  }
                />
              ))}
            </View>
          ) : (
            <EmptyState
              icon="inbox"
              title="No Purchase Orders"
              message="You don't have any recent purchase orders."
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const StatCard = ({ icon, label, value, color, onPress }) => {
  return (
    <TouchableOpacity
      style={[styles.statCard, { borderTopColor: color }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
        <Icon name={icon} size={24} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  );
};

const QuickActionButton = ({ icon, label, onPress }) => {
  return (
    <TouchableOpacity
      style={styles.actionButton}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Icon name={icon} size={24} color={colors.primary} />
      <Text style={styles.actionButtonText}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    paddingTop: 16,
    gap: 8,
  },
  statCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionHeader: {
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
  viewAllLink: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionButton: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  urgentContainer: {
    gap: 10,
  },
  urgentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
    borderRadius: 8,
    padding: 12,
    gap: 12,
  },
  urgentIcon: {
    marginRight: 4,
  },
  urgentContent: {
    flex: 1,
  },
  urgentTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  urgentDescription: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  posList: {
    marginHorizontal: -16,
  },
});

export default DashboardScreen;
