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
import { inspectionAPI } from '../../services/api';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import { INSPECTION_STATUS } from '../../utils/constants';

const InspectionListScreen = ({ navigation }) => {
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchInspections();
  }, []);

  const fetchInspections = async () => {
    try {
      setLoading(true);
      const response = await inspectionAPI.getAll({ limit: 100 });
      setInspections(response.data);
    } catch (error) {
      console.error('Error fetching inspections:', error);
      Alert.alert('Error', 'Failed to load inspections');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchInspections().finally(() => setRefreshing(false));
  }, []);

  if (loading) {
    return <LoadingScreen message="Loading inspections..." />;
  }

  const scheduledCount = inspections.filter(
    (i) => i.status === INSPECTION_STATUS.SCHEDULED
  ).length;
  const completedCount = inspections.filter(
    (i) => i.status === INSPECTION_STATUS.COMPLETED
  ).length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header Stats */}
        <View style={styles.statsBar}>
          <StatBadge
            icon="calendar-check"
            label="Scheduled"
            count={scheduledCount}
            color={colors.warning}
          />
          <StatBadge
            icon="check-circle"
            label="Completed"
            count={completedCount}
            color={colors.success}
          />
        </View>

        {/* Inspections List */}
        {inspections.length > 0 ? (
          <FlatList
            data={inspections}
            renderItem={({ item }) => (
              <InspectionCard
                inspection={item}
                onPress={() =>
                  navigation.navigate('InspectionDetailStack', {
                    inspectionId: item.id,
                  })
                }
                onPrepare={() =>
                  navigation.navigate('InspectionPrep', {
                    inspectionId: item.id,
                  })
                }
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
                icon="clipboard-check"
                title="No Inspections"
                message="You don't have any scheduled inspections at the moment."
              />
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const InspectionCard = ({ inspection, onPress, onPrepare }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case INSPECTION_STATUS.SCHEDULED:
        return colors.warning;
      case INSPECTION_STATUS.IN_PROGRESS:
        return colors.info;
      case INSPECTION_STATUS.COMPLETED:
        return colors.success;
      case INSPECTION_STATUS.FAILED:
        return colors.danger;
      case INSPECTION_STATUS.PASSED:
        return colors.success;
      default:
        return colors.textSecondary;
    }
  };

  const daysLeft = daysUntil(inspection.scheduledDate);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.inspectionNumber}>
            Inspection #{inspection.id}
          </Text>
          <Text style={styles.poNumber}>PO: {inspection.poNumber}</Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(inspection.status) + '20' },
          ]}
        >
          <Text style={[styles.statusText, { color: getStatusColor(inspection.status) }]}>
            {inspection.status.replace(/_/g, ' ').toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.content}>
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Icon name="calendar-outline" size={16} color={colors.textSecondary} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Scheduled</Text>
              <Text style={styles.infoValue}>
                {formatDate(inspection.scheduledDate, 'DD MMM YYYY')}
              </Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <Icon name="clock-outline" size={16} color={colors.textSecondary} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Status</Text>
              <Text
                style={[
                  styles.infoValue,
                  daysLeft < 0 && styles.overdueValue,
                ]}
              >
                {daysLeft < 0
                  ? `${Math.abs(daysLeft)}d ago`
                  : `${daysLeft}d left`}
              </Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <Icon name="file-document" size={16} color={colors.textSecondary} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Inspector</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                {inspection.inspectorName || 'TBA'}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {inspection.status === INSPECTION_STATUS.SCHEDULED && (
            <TouchableOpacity
              style={styles.prepareButton}
              onPress={onPrepare}
            >
              <Icon name="checkbox-multiple-outline" size={14} color={colors.primary} />
              <Text style={styles.prepareButtonText}>Prepare</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.viewButton}
            onPress={onPress}
          >
            <Icon name="arrow-right" size={14} color={colors.primary} />
            <Text style={styles.viewButtonText}>View</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const StatBadge = ({ icon, label, count, color }) => (
  <View style={styles.statBadge}>
    <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
      <Icon name={icon} size={18} color={color} />
    </View>
    <View style={styles.statContent}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statCount, { color }]}>{count}</Text>
    </View>
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
  statsBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  statBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statContent: {
    flex: 1,
  },
  statLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  statCount: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 2,
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
  inspectionNumber: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.text,
  },
  poNumber: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 12,
  },
  content: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 8,
  },
  infoItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.background,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: 11,
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
  prepareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: colors.lighter,
    borderRadius: 6,
    gap: 4,
  },
  prepareButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  viewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: colors.lighter,
    borderRadius: 6,
    gap: 4,
  },
  viewButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
});

export default InspectionListScreen;
