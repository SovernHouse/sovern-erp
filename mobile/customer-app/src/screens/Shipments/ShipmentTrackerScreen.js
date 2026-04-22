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
import { shipmentService } from '../../services/api';
import LoadingScreen from '../../components/LoadingScreen';
import ShipmentRouteAnimation from '../../components/ShipmentRouteAnimation';
import { formatDate, formatCurrency } from '../../utils/formatters';

const ShipmentTrackerScreen = ({ route }) => {
  const { shipmentId } = route.params;
  const [shipment, setShipment] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadShipment();
  }, []);

  const loadShipment = async () => {
    try {
      const [shipmentRes, trackingRes] = await Promise.all([
        shipmentService.getById(shipmentId),
        shipmentService.getTracking(shipmentId),
      ]);

      setShipment(shipmentRes.data);
      setTracking(trackingRes.data);
    } catch (error) {
      console.error('Error loading shipment:', error);
      Alert.alert('Error', 'Failed to load shipment details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (!shipment) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Shipment not found</Text>
      </View>
    );
  }

  const etaDate = new Date(shipment.eta);
  const now = new Date();
  const daysRemaining = Math.ceil((etaDate - now) / (1000 * 60 * 60 * 24));

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header Card */}
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.shipmentNumber}>{shipment.number}</Text>
              <Text style={styles.shipmentDate}>
                {formatDate(shipment.createdAt, 'MMM DD, YYYY')}
              </Text>
            </View>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>
                {shipment.status.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Animated Route Visualization */}
        <ShipmentRouteAnimation
          origin={shipment.origin}
          destination={shipment.destination}
          currentLocation={tracking?.currentLocation || shipment.lastKnownLocation}
          progress={shipment.progress || 0}
        />

        {/* ETA Card */}
        <View style={styles.etaCard}>
          <View style={styles.etaContent}>
            <Text style={styles.etaLabel}>Estimated Delivery</Text>
            <Text style={styles.etaDate}>{formatDate(shipment.eta, 'MMMM DD, YYYY')}</Text>
            {daysRemaining > 0 ? (
              <Text style={styles.etaCountdown}>
                {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining
              </Text>
            ) : (
              <Text style={styles.etaExpired}>Expected arrival</Text>
            )}
          </View>
          <Icon name="calendar" size={32} color={colors.primary} />
        </View>

        {/* Container Info */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Shipment Information</Text>

          <View style={styles.infoGrid}>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Container Type</Text>
              <Text style={styles.infoValue}>{shipment.containerType || 'N/A'}</Text>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Container Number</Text>
              <Text style={styles.infoValue}>{shipment.containerNumber}</Text>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Vessel</Text>
              <Text style={styles.infoValue}>{shipment.vesselName || 'N/A'}</Text>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Voyage</Text>
              <Text style={styles.infoValue}>{shipment.voyageNumber || 'N/A'}</Text>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Booking Number</Text>
              <Text style={styles.infoValue}>{shipment.bookingNumber || 'N/A'}</Text>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Total Value</Text>
              <Text style={styles.infoValue}>
                {formatCurrency(shipment.totalValue)}
              </Text>
            </View>
          </View>
        </View>

        {/* Timeline Section */}
        <View style={styles.timelineSection}>
          <Text style={styles.sectionTitle}>Tracking Timeline</Text>

          {tracking?.events && tracking.events.length > 0 ? (
            tracking.events.map((event, index) => (
              <View key={index} style={styles.timelineItem}>
                <View style={styles.timelineDot} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineStatus}>{event.status}</Text>
                  <Text style={styles.timelineLocation}>{event.location}</Text>
                  <Text style={styles.timelineDate}>
                    {formatDate(event.timestamp, 'MMM DD, YYYY HH:mm')}
                  </Text>
                  {event.description && (
                    <Text style={styles.timelineDescription}>
                      {event.description}
                    </Text>
                  )}
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No tracking events yet</Text>
          )}
        </View>

        {/* Documents Section */}
        <View style={styles.documentsSection}>
          <Text style={styles.sectionTitle}>Documents</Text>

          {shipment.documents && shipment.documents.length > 0 ? (
            shipment.documents.map((doc, index) => (
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
            <Text style={styles.emptyText}>No documents available</Text>
          )}
        </View>

        {/* Contact Section */}
        <View style={styles.contactSection}>
          <Text style={styles.sectionTitle}>Need Help?</Text>
          <TouchableOpacity style={styles.contactCard}>
            <Icon name="call" size={20} color={colors.primary} />
            <View style={styles.contactInfo}>
              <Text style={styles.contactLabel}>Customer Support</Text>
              <Text style={styles.contactValue}>+1-800-SHIPPING</Text>
            </View>
            <Icon name="chevron-forward" size={20} color={colors.gray300} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.contactCard}>
            <Icon name="mail" size={20} color={colors.primary} />
            <View style={styles.contactInfo}>
              <Text style={styles.contactLabel}>Email Support</Text>
              <Text style={styles.contactValue}>support@tradingerp.com</Text>
            </View>
            <Icon name="chevron-forward" size={20} color={colors.gray300} />
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  shipmentNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray900,
  },
  shipmentDate: {
    fontSize: 12,
    color: colors.gray600,
    marginTop: 4,
  },
  statusBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusBadgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  etaCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.accentLight,
    borderRadius: 10,
  },
  etaContent: {
    flex: 1,
  },
  etaLabel: {
    fontSize: 12,
    color: colors.gray600,
  },
  etaDate: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.accent,
    marginTop: 4,
  },
  etaCountdown: {
    fontSize: 12,
    color: colors.accent,
    marginTop: 4,
    fontWeight: '500',
  },
  etaExpired: {
    fontSize: 12,
    color: colors.accent,
    marginTop: 4,
  },
  infoSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray900,
    marginBottom: 12,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
  timelineSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
    marginTop: 4,
    marginRight: 12,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  timelineStatus: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray900,
  },
  timelineLocation: {
    fontSize: 12,
    color: colors.gray600,
    marginTop: 4,
  },
  timelineDate: {
    fontSize: 11,
    color: colors.gray500,
    marginTop: 4,
  },
  timelineDescription: {
    fontSize: 12,
    color: colors.gray700,
    marginTop: 4,
    fontStyle: 'italic',
  },
  documentsSection: {
    paddingHorizontal: 16,
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
  contactSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
    marginBottom: 8,
    gap: 12,
  },
  contactInfo: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray900,
  },
  contactValue: {
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
});

export default ShipmentTrackerScreen;
