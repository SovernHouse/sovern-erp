import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors } from '../../utils/colors';
import { claimService } from '../../services/api';
import LoadingScreen from '../../components/LoadingScreen';
import StatusBadge from '../../components/StatusBadge';
import { formatDate } from '../../utils/formatters';

const ClaimDetailScreen = ({ route }) => {
  const { claimId } = route.params;
  const [claim, setClaim] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadClaim();
  }, []);

  const loadClaim = async () => {
    try {
      const response = await claimService.getById(claimId);
      setClaim(response.data);
    } catch (error) {
      console.error('Error loading claim:', error);
      Alert.alert('Error', 'Failed to load claim details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (!claim) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Claim not found</Text>
      </View>
    );
  }

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

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header Card */}
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.claimNumber}>{claim.number}</Text>
              <Text style={styles.claimDate}>
                {formatDate(claim.createdAt, 'MMM DD, YYYY')}
              </Text>
            </View>
            <View style={styles.statusSection}>
              <StatusBadge status={claim.status} />
              <View
                style={[
                  styles.priorityBadge,
                  { backgroundColor: getPriorityColor(claim.priority) },
                ]}
              >
                <Text style={styles.priorityBadgeText}>
                  {claim.priority?.charAt(0).toUpperCase() + claim.priority?.slice(1)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Info Cards */}
        <View style={styles.infoGrid}>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Order Reference</Text>
            <Text style={styles.infoValue}>{claim.orderNumber}</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Claim Type</Text>
            <Text style={styles.infoValue}>{claim.type}</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Claim Amount</Text>
            <Text style={styles.infoValue}>
              {claim.claimAmount ? `$${claim.claimAmount.toFixed(2)}` : 'Pending'}
            </Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Assigned To</Text>
            <Text style={styles.infoValue}>{claim.assignedTo || 'Unassigned'}</Text>
          </View>
        </View>

        {/* Description */}
        {claim.description && (
          <View style={styles.descriptionSection}>
            <Text style={styles.sectionTitle}>Description</Text>
            <View style={styles.descriptionBox}>
              <Text style={styles.descriptionText}>{claim.description}</Text>
            </View>
          </View>
        )}

        {/* Affected Items */}
        {claim.items && claim.items.length > 0 && (
          <View style={styles.itemsSection}>
            <Text style={styles.sectionTitle}>Affected Items</Text>
            {claim.items.map((item, index) => (
              <View key={index} style={styles.itemCard}>
                <View style={styles.itemLeft}>
                  <Text style={styles.itemName}>{item.productName}</Text>
                  <Text style={styles.itemDetails}>
                    SKU: {item.sku} | Qty: {item.quantity}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Timeline */}
        <View style={styles.timelineSection}>
          <Text style={styles.sectionTitle}>Claim Timeline</Text>

          {claim.timeline && claim.timeline.length > 0 ? (
            claim.timeline.map((event, index) => (
              <View key={index} style={styles.timelineItem}>
                <View style={styles.timelineDot} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineStatus}>{event.status}</Text>
                  <Text style={styles.timelineDate}>
                    {formatDate(event.date, 'MMM DD, YYYY HH:mm')}
                  </Text>
                  {event.notes && (
                    <Text style={styles.timelineNotes}>{event.notes}</Text>
                  )}
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No timeline events</Text>
          )}
        </View>

        {/* Photos */}
        {claim.photos && claim.photos.length > 0 && (
          <View style={styles.photosSection}>
            <Text style={styles.sectionTitle}>Photos</Text>
            {claim.photos.map((photo, index) => (
              <View key={index} style={styles.photoItem}>
                <Icon name="image" size={24} color={colors.primary} />
                <View style={styles.photoInfo}>
                  <Text style={styles.photoName}>{photo.name}</Text>
                  <Text style={styles.photoDate}>
                    {formatDate(photo.uploadedAt, 'MMM DD, YYYY')}
                  </Text>
                </View>
                <Icon name="download" size={20} color={colors.gray400} />
              </View>
            ))}
          </View>
        )}

        {/* Resolution Info */}
        {claim.status === 'resolved' && claim.resolution && (
          <View style={styles.resolutionSection}>
            <Text style={styles.sectionTitle}>Resolution</Text>
            <View style={styles.resolutionCard}>
              <Text style={styles.resolutionType}>{claim.resolution.type}</Text>
              <Text style={styles.resolutionDetails}>{claim.resolution.details}</Text>
              {claim.resolution.compensationAmount && (
                <Text style={styles.compensationText}>
                  Compensation: ${claim.resolution.compensationAmount.toFixed(2)}
                </Text>
              )}
              <Text style={styles.resolutionDate}>
                Resolved on {formatDate(claim.resolution.date, 'MMM DD, YYYY')}
              </Text>
            </View>
          </View>
        )}

        {/* Support Contact */}
        <View style={styles.supportSection}>
          <Text style={styles.sectionTitle}>Need Help?</Text>
          <TouchableOpacity style={styles.supportCard}>
            <Icon name="call" size={20} color={colors.primary} />
            <View style={styles.supportInfo}>
              <Text style={styles.supportLabel}>Customer Support</Text>
              <Text style={styles.supportValue}>+1-800-SUPPORT</Text>
            </View>
            <Icon name="chevron-forward" size={20} color={colors.gray300} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.supportCard}>
            <Icon name="mail" size={20} color={colors.primary} />
            <View style={styles.supportInfo}>
              <Text style={styles.supportLabel}>Email Support</Text>
              <Text style={styles.supportValue}>claims@tradingerp.com</Text>
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
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  claimNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray900,
  },
  claimDate: {
    fontSize: 12,
    color: colors.gray600,
    marginTop: 4,
  },
  statusSection: {
    gap: 8,
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  priorityBadgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '600',
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
  descriptionSection: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray900,
    marginHorizontal: 4,
    marginBottom: 12,
  },
  descriptionBox: {
    backgroundColor: colors.gray50,
    borderRadius: 8,
    padding: 12,
  },
  descriptionText: {
    fontSize: 13,
    color: colors.gray700,
    lineHeight: 20,
  },
  itemsSection: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  itemCard: {
    flexDirection: 'row',
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
  itemDetails: {
    fontSize: 11,
    color: colors.gray600,
    marginTop: 4,
  },
  timelineSection: {
    paddingHorizontal: 12,
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
  timelineDate: {
    fontSize: 11,
    color: colors.gray500,
    marginTop: 4,
  },
  timelineNotes: {
    fontSize: 12,
    color: colors.gray600,
    marginTop: 4,
    fontStyle: 'italic',
  },
  photosSection: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  photoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.gray50,
    borderRadius: 8,
    marginBottom: 8,
    gap: 12,
  },
  photoInfo: {
    flex: 1,
  },
  photoName: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.gray900,
  },
  photoDate: {
    fontSize: 11,
    color: colors.gray600,
    marginTop: 2,
  },
  resolutionSection: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  resolutionCard: {
    backgroundColor: colors.successLight,
    borderRadius: 8,
    padding: 12,
  },
  resolutionType: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.success,
  },
  resolutionDetails: {
    fontSize: 12,
    color: colors.gray700,
    marginTop: 8,
    lineHeight: 18,
  },
  compensationText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.success,
    marginTop: 8,
  },
  resolutionDate: {
    fontSize: 11,
    color: colors.gray600,
    marginTop: 8,
  },
  supportSection: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  supportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
    marginBottom: 8,
    gap: 12,
  },
  supportInfo: {
    flex: 1,
  },
  supportLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray900,
  },
  supportValue: {
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

export default ClaimDetailScreen;
