import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors } from '../../utils/colors';
import { shipmentService } from '../../services/api';
import StatusBadge from '../../components/StatusBadge';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import { formatDate } from '../../utils/formatters';

const ShipmentListScreen = ({ navigation }) => {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadShipments();
  }, []);

  const loadShipments = async () => {
    try {
      const response = await shipmentService.getAll();
      setShipments(response.data.data || []);
    } catch (error) {
      console.error('Error loading shipments:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadShipments().finally(() => setRefreshing(false));
  }, []);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <View style={styles.container}>
      {shipments.length > 0 ? (
        <FlatList
          data={shipments}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.shipmentCard}
              onPress={() =>
                navigation.navigate('ShipmentTracker', {
                  shipmentId: item.id,
                })
              }
            >
              <View style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  <Text style={styles.shipmentNumber}>{item.number}</Text>
                  <StatusBadge status={item.status} />
                </View>

                <View style={styles.routeInfo}>
                  <View style={styles.routeEnd}>
                    <Icon name="location" size={14} color={colors.primary} />
                    <Text style={styles.routeCity} numberOfLines={1}>
                      {item.origin}
                    </Text>
                  </View>

                  <View style={styles.routeLine}>
                    <Icon name="arrow-forward" size={14} color={colors.gray400} />
                  </View>

                  <View style={styles.routeEnd}>
                    <Icon name="flag" size={14} color={colors.accent} />
                    <Text style={styles.routeCity} numberOfLines={1}>
                      {item.destination}
                    </Text>
                  </View>
                </View>

                <View style={styles.shipmentDetails}>
                  <View style={styles.detailItem}>
                    <Icon name="cube" size={14} color={colors.gray500} />
                    <Text style={styles.detailText}>{item.containerNumber}</Text>
                  </View>

                  <View style={styles.detailItem}>
                    <Icon name="calendar" size={14} color={colors.gray500} />
                    <Text style={styles.detailText}>
                      ETA: {formatDate(item.eta, 'MMM DD')}
                    </Text>
                  </View>
                </View>

                {item.progress && (
                  <View style={styles.progressSection}>
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${item.progress}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressText}>{item.progress}% Complete</Text>
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
            icon="truck-outline"
            title="No Shipments"
            message="You don't have any shipments yet"
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
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  shipmentCard: {
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  shipmentNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray900,
  },
  routeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  routeEnd: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  routeCity: {
    fontSize: 11,
    color: colors.gray600,
    fontWeight: '500',
  },
  routeLine: {
    justifyContent: 'center',
  },
  shipmentDetails: {
    marginBottom: 10,
    gap: 6,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 11,
    color: colors.gray600,
  },
  progressSection: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.gray200,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  progressText: {
    fontSize: 11,
    color: colors.gray600,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
  },
});

export default ShipmentListScreen;
