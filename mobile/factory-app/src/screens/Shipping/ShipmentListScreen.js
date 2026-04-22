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
import { formatDate } from '../../utils/formatters';
import { shipmentAPI } from '../../services/api';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import { SHIPMENT_STATUS } from '../../utils/constants';

const ShipmentListScreen = ({ navigation }) => {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchShipments();
  }, []);

  const fetchShipments = async () => {
    try {
      setLoading(true);
      const response = await shipmentAPI.getAll({ limit: 100 });
      setShipments(response.data);
    } catch (error) {
      console.error('Error fetching shipments:', error);
      Alert.alert('Error', 'Failed to load shipments');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchShipments().finally(() => setRefreshing(false));
  }, []);

  if (loading) {
    return <LoadingScreen message="Loading shipments..." />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header with Create Button */}
        <View style={styles.headerBar}>
          <View style={styles.statusCounts}>
            <StatusCount
              label="Pending"
              count={shipments.filter((s) => s.status === SHIPMENT_STATUS.PENDING).length}
              color={colors.warning}
            />
            <StatusCount
              label="In Transit"
              count={shipments.filter((s) => s.status === SHIPMENT_STATUS.IN_TRANSIT).length}
              color={colors.info}
            />
            <StatusCount
              label="Delivered"
              count={shipments.filter((s) => s.status === SHIPMENT_STATUS.DELIVERED).length}
              color={colors.success}
            />
          </View>

          <TouchableOpacity
            style={styles.createButton}
            onPress={() => navigation.navigate('ShipmentForm')}
          >
            <Icon name="plus-circle" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Shipment List */}
        {shipments.length > 0 ? (
          <FlatList
            data={shipments}
            renderItem={({ item }) => (
              <ShipmentCard
                shipment={item}
                onPress={() =>
                  navigation.navigate('ShipmentForm', { shipmentId: item.id })
                }
                onUploadDocs={() =>
                  navigation.navigate('DocumentUploadStack', {
                    shipmentId: item.id,
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
                icon="truck"
                title="No Shipments"
                message="Create a new shipment to get started."
                actionLabel="Create Shipment"
                onAction={() => navigation.navigate('ShipmentForm')}
              />
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const ShipmentCard = ({ shipment, onPress, onUploadDocs }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case SHIPMENT_STATUS.PENDING:
        return colors.warning;
      case SHIPMENT_STATUS.IN_TRANSIT:
        return colors.info;
      case SHIPMENT_STATUS.DELIVERED:
        return colors.success;
      case SHIPMENT_STATUS.DELAYED:
        return colors.danger;
      default:
        return colors.textSecondary;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case SHIPMENT_STATUS.PENDING:
        return 'clock-outline';
      case SHIPMENT_STATUS.IN_TRANSIT:
        return 'truck-fast';
      case SHIPMENT_STATUS.DELIVERED:
        return 'check-circle';
      case SHIPMENT_STATUS.DELAYED:
        return 'alert-circle';
      default:
        return 'circle-outline';
    }
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.shipmentNumber}>{shipment.shipmentNumber}</Text>
          <Text style={styles.poNumber}>PO: {shipment.poNumber}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(shipment.status) + '20' }]}>
          <Icon
            name={getStatusIcon(shipment.status)}
            size={16}
            color={getStatusColor(shipment.status)}
            style={styles.statusIcon}
          />
          <Text style={[styles.statusText, { color: getStatusColor(shipment.status) }]}>
            {shipment.status.replace(/_/g, ' ').toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.content}>
        {/* Details Row */}
        <View style={styles.detailsRow}>
          <View style={styles.detailItem}>
            <Icon name="package-variant" size={16} color={colors.textSecondary} />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Items</Text>
              <Text style={styles.detailValue}>{shipment.items?.length || 0}</Text>
            </View>
          </View>

          <View style={styles.detailItem}>
            <Icon name="ship" size={16} color={colors.textSecondary} />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Vessel</Text>
              <Text style={styles.detailValue} numberOfLines={1}>
                {shipment.vesselName || 'N/A'}
              </Text>
            </View>
          </View>

          <View style={styles.detailItem}>
            <Icon name="calendar-outline" size={16} color={colors.textSecondary} />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Departure</Text>
              <Text style={styles.detailValue}>
                {formatDate(shipment.departureDate, 'DD MMM')}
              </Text>
            </View>
          </View>
        </View>

        {/* Ports Info */}
        {(shipment.originPort || shipment.destinationPort) && (
          <View style={styles.portsSection}>
            <View style={styles.portInfo}>
              <Icon name="map-marker-outline" size={14} color={colors.primary} />
              <Text style={styles.portText}>{shipment.originPort || 'N/A'}</Text>
            </View>
            <Icon name="arrow-right" size={16} color={colors.textSecondary} />
            <View style={styles.portInfo}>
              <Icon name="flag-outline" size={14} color={colors.success} />
              <Text style={styles.portText}>{shipment.destinationPort || 'N/A'}</Text>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onPress}
          >
            <Icon name="pencil" size={14} color={colors.primary} />
            <Text style={styles.actionButtonText}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={onUploadDocs}
          >
            <Icon name="file-upload" size={14} color={colors.primary} />
            <Text style={styles.actionButtonText}>Documents</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const StatusCount = ({ label, count, color }) => (
  <View style={styles.statusCountContainer}>
    <View style={[styles.statusCountCircle, { backgroundColor: color + '20' }]}>
      <Text style={[styles.statusCountText, { color }]}>{count}</Text>
    </View>
    <Text style={styles.statusCountLabel}>{label}</Text>
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
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statusCounts: {
    flexDirection: 'row',
    gap: 12,
    flex: 1,
  },
  statusCountContainer: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statusCountCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusCountText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  statusCountLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  createButton: {
    padding: 8,
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
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 8,
  },
  titleContainer: {
    flex: 1,
  },
  shipmentNumber: {
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  statusIcon: {},
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
    gap: 10,
  },
  detailsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  detailItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.background,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
    marginTop: 2,
  },
  portsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.lighter,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  portInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  portText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.text,
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
    borderRadius: 6,
    gap: 4,
  },
  actionButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
});

export default ShipmentListScreen;
