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
import { claimService } from '../../services/api';
import StatusBadge from '../../components/StatusBadge';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import { formatDate, formatClaimNumber } from '../../utils/formatters';

const ClaimListScreen = ({ navigation }) => {
  const [claims, setClaims] = useState([]);
  const [filteredClaims, setFilteredClaims] = useState([]);
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const priorityFilters = [
    { id: 'all', label: 'All' },
    { id: 'urgent', label: 'Urgent' },
    { id: 'high', label: 'High' },
    { id: 'medium', label: 'Medium' },
  ];

  useEffect(() => {
    loadClaims();
  }, []);

  const loadClaims = async () => {
    try {
      const response = await claimService.getAll();
      setClaims(response.data.data || []);
      setFilteredClaims(response.data.data || []);
    } catch (error) {
      console.error('Error loading claims:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadClaims().finally(() => setRefreshing(false));
  }, []);

  useEffect(() => {
    filterClaims();
  }, [selectedPriority]);

  const filterClaims = () => {
    if (selectedPriority === 'all') {
      setFilteredClaims(claims);
    } else {
      setFilteredClaims(claims.filter((c) => c.priority === selectedPriority));
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return colors.error;
      case 'high':
        return colors.warning;
      case 'medium':
        return colors.info;
      default:
        return colors.gray400;
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
        {priorityFilters.map((filter) => (
          <TouchableOpacity
            key={filter.id}
            style={[
              styles.filterChip,
              selectedPriority === filter.id && styles.filterChipActive,
            ]}
            onPress={() => setSelectedPriority(filter.id)}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedPriority === filter.id && styles.filterChipTextActive,
              ]}
            >
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Claims List */}
      {filteredClaims.length > 0 ? (
        <FlatList
          data={filteredClaims}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.claimCard}
              onPress={() =>
                navigation.navigate('ClaimDetail', { claimId: item.id })
              }
            >
              <View style={styles.priorityIndicator}>
                <View
                  style={[
                    styles.priorityDot,
                    { backgroundColor: getPriorityColor(item.priority) },
                  ]}
                />
              </View>

              <View style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  <Text style={styles.claimNumber}>{item.number}</Text>
                  <StatusBadge status={item.status} />
                </View>

                <View style={styles.cardDetails}>
                  <Text style={styles.orderRef} numberOfLines={1}>
                    Order: {item.orderNumber}
                  </Text>

                  <Text style={styles.claimType} numberOfLines={1}>
                    {item.type}
                  </Text>

                  <Text style={styles.detailDate}>
                    {formatDate(item.createdAt, 'MMM DD, YYYY')}
                  </Text>
                </View>
              </View>

              <View style={styles.cardRight}>
                <Text style={[styles.priority, { color: getPriorityColor(item.priority) }]}>
                  {item.priority?.charAt(0).toUpperCase() + item.priority?.slice(1)}
                </Text>
                <Icon name="chevron-forward" size={20} color={colors.gray300} />
              </View>
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
            icon="alert-circle-outline"
            title="No Claims"
            message="You don't have any claims yet"
          />
        </View>
      )}

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('ClaimForm')}
      >
        <Icon name="add" size={28} color={colors.white} />
      </TouchableOpacity>
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
  claimCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  priorityIndicator: {
    marginRight: 12,
  },
  priorityDot: {
    width: 4,
    height: 40,
    borderRadius: 2,
  },
  cardContent: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  claimNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray900,
  },
  cardDetails: {
    gap: 4,
  },
  orderRef: {
    fontSize: 12,
    color: colors.gray600,
  },
  claimType: {
    fontSize: 12,
    color: colors.gray600,
  },
  detailDate: {
    fontSize: 11,
    color: colors.gray500,
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  priority: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});

export default ClaimListScreen;
