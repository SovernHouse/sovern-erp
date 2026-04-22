import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  SafeAreaView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../../utils/colors';
import { formatDate, daysUntil } from '../../utils/formatters';
import { productionAPI } from '../../services/api';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import ProductionProgressBar from '../../components/ProductionProgressBar';
import { PRODUCTION_STATUS } from '../../utils/constants';

const ProductionListScreen = ({ navigation }) => {
  const [productions, setProductions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchProductions();
  }, []);

  const fetchProductions = async () => {
    try {
      setLoading(true);
      const response = await productionAPI.getAll({ status: PRODUCTION_STATUS.IN_PROGRESS });
      setProductions(response.data);
    } catch (error) {
      console.error('Error fetching productions:', error);
      Alert.alert('Error', 'Failed to load production orders');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchProductions().finally(() => setRefreshing(false));
  }, []);

  if (loading) {
    return <LoadingScreen message="Loading production orders..." />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Quick Filters */}
        <View style={styles.filterContainer}>
          <QuickFilterButton
            icon="factory"
            label="In Progress"
            badge={productions.filter((p) => p.status === PRODUCTION_STATUS.IN_PROGRESS).length}
          />
          <QuickFilterButton
            icon="alert-circle"
            label="On Hold"
            badge={productions.filter((p) => p.status === PRODUCTION_STATUS.ON_HOLD).length}
          />
          <QuickFilterButton
            icon="check-circle"
            label="Ready"
            badge={productions.filter((p) => p.status === PRODUCTION_STATUS.COMPLETED).length}
          />
        </View>

        {/* Production List */}
        {productions.length > 0 ? (
          <FlatList
            data={productions}
            renderItem={({ item }) => (
              <ProductionCard
                production={item}
                onPress={() =>
                  navigation.navigate('ProductionUpdateStack', {
                    productionId: item.id,
                  })
                }
                onViewCalendar={() => navigation.navigate('ProductionCalendar')}
              />
            )}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
              />
            }
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <FlatList
            scrollEnabled
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
              />
            }
            contentContainerStyle={styles.emptyContainer}
            data={[]}
            renderItem={() => null}
            ListEmptyComponent={
              <EmptyState
                icon="factory"
                title="No Active Production"
                message="You don't have any active production orders at the moment."
              />
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const ProductionCard = ({ production, onPress, onViewCalendar }) => {
  const daysLeft = daysUntil(production.deliveryDate);
  const isOverdue = daysLeft < 0;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.poNumber}>{production.poNumber}</Text>
          <Text style={styles.supplier}>{production.supplier}</Text>
        </View>
        <Icon
          name="chevron-right"
          size={24}
          color={colors.textSecondary}
        />
      </View>

      <View style={styles.divider} />

      <View style={styles.content}>
        {/* Progress Section */}
        <View style={styles.progressSection}>
          <View style={styles.progressLabel}>
            <Text style={styles.label}>Progress</Text>
            <Text style={styles.percentage}>{Math.round(production.percentComplete)}%</Text>
          </View>
          <ProductionProgressBar
            percentage={production.percentComplete}
            height={8}
            showLabel={false}
          />
        </View>

        {/* Info Row */}
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Icon
              name="package-variant"
              size={16}
              color={colors.textSecondary}
            />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Items</Text>
              <Text style={styles.infoValue}>{production.items?.length || 0}</Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <Icon
              name="calendar-outline"
              size={16}
              color={isOverdue ? colors.danger : colors.primary}
            />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Delivery</Text>
              <Text
                style={[
                  styles.infoValue,
                  isOverdue && styles.overdueValue,
                ]}
              >
                {daysLeft < 0
                  ? `${Math.abs(daysLeft)}d overdue`
                  : `${daysLeft}d left`}
              </Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <Icon
              name="clock-outline"
              size={16}
              color={colors.textSecondary}
            />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Status</Text>
              <Text style={styles.infoValue}>
                {production.status.replace(/_/g, ' ').toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onPress}
          >
            <Icon name="pencil" size={16} color={colors.primary} />
            <Text style={styles.actionButtonText}>Update</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={onViewCalendar}
          >
            <Icon name="calendar" size={16} color={colors.primary} />
            <Text style={styles.actionButtonText}>Calendar</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <Icon name="file-upload" size={16} color={colors.primary} />
            <Text style={styles.actionButtonText}>Documents</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const QuickFilterButton = ({ icon, label, badge }) => {
  return (
    <View style={styles.filterButton}>
      <View style={styles.filterIconContainer}>
        <Icon name={icon} size={20} color={colors.primary} />
        {badge > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
      </View>
      <Text style={styles.filterLabel}>{label}</Text>
    </View>
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
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterButton: {
    alignItems: 'center',
    gap: 8,
  },
  filterIconContainer: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.danger,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  filterLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  listContent: {
    paddingVertical: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    marginHorizontal: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleContainer: {
    flex: 1,
  },
  poNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  supplier: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 12,
  },
  content: {
    gap: 12,
  },
  progressSection: {
    gap: 8,
  },
  progressLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  percentage: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.primary,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 8,
  },
  infoItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    marginTop: 2,
  },
  overdueValue: {
    color: colors.danger,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: colors.lighter,
    borderRadius: 8,
    gap: 4,
  },
  actionButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
});

export default ProductionListScreen;
