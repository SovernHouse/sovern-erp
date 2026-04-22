import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../../utils/colors';
import { formatDate, formatDateTime } from '../../utils/formatters';
import { inspectionAPI } from '../../services/api';
import LoadingScreen from '../../components/LoadingScreen';
import { INSPECTION_STATUS } from '../../utils/constants';

const InspectionDetailScreen = ({ route, navigation }) => {
  const { inspectionId } = route.params;
  const [inspection, setInspection] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInspectionDetails();
  }, []);

  const fetchInspectionDetails = async () => {
    try {
      setLoading(true);
      const response = await inspectionAPI.getById(inspectionId);
      setInspection(response.data);
    } catch (error) {
      console.error('Error fetching inspection:', error);
      Alert.alert('Error', 'Failed to load inspection details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingScreen message="Loading inspection details..." />;
  }

  if (!inspection) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" size={48} color={colors.danger} />
          <Text style={styles.errorText}>Inspection not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header Card */}
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View style={styles.titleContent}>
              <Text style={styles.inspectionId}>Inspection #{inspection.id}</Text>
              <Text style={styles.poNumber}>PO: {inspection.poNumber}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(inspection.status) + '20' }]}>
              <Icon
                name={getStatusIcon(inspection.status)}
                size={20}
                color={getStatusColor(inspection.status)}
              />
            </View>
          </View>

          <View style={styles.headerDivider} />

          <View style={styles.headerInfo}>
            <InfoItem label="Status" value={inspection.status.replace(/_/g, ' ').toUpperCase()} />
            <InfoItem
              label="Scheduled"
              value={formatDate(inspection.scheduledDate, 'DD MMM YYYY')}
            />
          </View>
        </View>

        {/* Inspector Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Inspector Information</Text>
          <View style={styles.infoCard}>
            <InfoItem label="Inspector" value={inspection.inspectorName || 'N/A'} />
            <InfoItem label="Company" value={inspection.inspectorCompany || 'N/A'} />
            <InfoItem label="Email" value={inspection.inspectorEmail || 'N/A'} />
            <InfoItem label="Phone" value={inspection.inspectorPhone || 'N/A'} />
          </View>
        </View>

        {/* Results (if completed) */}
        {inspection.status === INSPECTION_STATUS.COMPLETED && inspection.results && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Inspection Results</Text>
            <View style={styles.resultsCard}>
              <ResultItem
                icon="check-circle"
                label="Items Inspected"
                value={inspection.results.itemsInspected}
              />
              <ResultItem
                icon="alert-circle"
                label="Issues Found"
                value={inspection.results.issuesFound}
              />
              {inspection.results.defectRate && (
                <ResultItem
                  icon="percent"
                  label="Defect Rate"
                  value={`${inspection.results.defectRate}%`}
                />
              )}
            </View>
          </View>
        )}

        {/* Comments/Notes */}
        {inspection.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Inspector Notes</Text>
            <View style={styles.notesBox}>
              <Text style={styles.notesText}>{inspection.notes}</Text>
            </View>
          </View>
        )}

        {/* Findings */}
        {inspection.findings && inspection.findings.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Findings ({inspection.findings.length})
            </Text>
            <View style={styles.findingsContainer}>
              {inspection.findings.map((finding, index) => (
                <View key={index} style={styles.findingCard}>
                  <View style={styles.findingHeader}>
                    <Icon
                      name={finding.severity === 'critical' ? 'alert-circle' : 'information'}
                      size={20}
                      color={
                        finding.severity === 'critical'
                          ? colors.danger
                          : colors.warning
                      }
                    />
                    <Text style={styles.findingTitle}>{finding.title}</Text>
                  </View>
                  <Text style={styles.findingDescription}>
                    {finding.description}
                  </Text>
                  <Text style={styles.findingSeverity}>
                    Severity: {finding.severity.toUpperCase()}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Photos */}
        {inspection.photos && inspection.photos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Inspection Photos ({inspection.photos.length})
            </Text>
            <View style={styles.photosGrid}>
              {inspection.photos.map((photo, index) => (
                <View key={index} style={styles.photoContainer}>
                  <Image
                    source={{ uri: photo }}
                    style={styles.photoImage}
                  />
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Remediation */}
        {inspection.remediationRequired && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Remediation Required</Text>
            <View style={styles.remediationBox}>
              <Icon name="alert-box" size={24} color={colors.warning} />
              <Text style={styles.remediationText}>
                {inspection.remediationRequired}
              </Text>
            </View>
          </View>
        )}

        {/* Timeline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Timeline</Text>
          <View style={styles.timelineCard}>
            <TimelineItem
              icon="calendar"
              label="Scheduled"
              value={formatDateTime(inspection.scheduledDate)}
            />
            {inspection.completedDate && (
              <TimelineItem
                icon="check-circle"
                label="Completed"
                value={formatDateTime(inspection.completedDate)}
              />
            )}
            {inspection.reportDate && (
              <TimelineItem
                icon="file-document"
                label="Report Issued"
                value={formatDateTime(inspection.reportDate)}
              />
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

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

const getStatusIcon = (status) => {
  switch (status) {
    case INSPECTION_STATUS.SCHEDULED:
      return 'calendar-outline';
    case INSPECTION_STATUS.IN_PROGRESS:
      return 'clock-outline';
    case INSPECTION_STATUS.COMPLETED:
      return 'check-circle';
    case INSPECTION_STATUS.FAILED:
      return 'close-circle';
    case INSPECTION_STATUS.PASSED:
      return 'check-all';
    default:
      return 'circle-outline';
  }
};

const InfoItem = ({ label, value }) => (
  <View style={styles.infoItem}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const ResultItem = ({ icon, label, value }) => (
  <View style={styles.resultItem}>
    <Icon name={icon} size={20} color={colors.primary} />
    <View style={styles.resultContent}>
      <Text style={styles.resultLabel}>{label}</Text>
      <Text style={styles.resultValue}>{value}</Text>
    </View>
  </View>
);

const TimelineItem = ({ icon, label, value }) => (
  <View style={styles.timelineItem}>
    <View style={styles.timelineIcon}>
      <Icon name={icon} size={16} color={colors.primary} />
    </View>
    <View style={styles.timelineContent}>
      <Text style={styles.timelineLabel}>{label}</Text>
      <Text style={styles.timelineValue}>{value}</Text>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  errorText: {
    fontSize: 16,
    color: colors.text,
  },
  headerCard: {
    backgroundColor: colors.surface,
    margin: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  titleContent: {
    flex: 1,
  },
  inspectionId: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  poNumber: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  statusBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  headerInfo: {
    gap: 8,
  },
  infoItem: {
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  section: {
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  infoCard: {
    gap: 8,
  },
  resultsCard: {
    gap: 12,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.background,
    borderRadius: 8,
  },
  resultContent: {
    flex: 1,
  },
  resultLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  resultValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 4,
  },
  notesBox: {
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.info,
  },
  notesText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  findingsContainer: {
    gap: 12,
  },
  findingCard: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  },
  findingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  findingTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  findingDescription: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
    marginBottom: 8,
  },
  findingSeverity: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.warning,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoContainer: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  remediationBox: {
    backgroundColor: colors.lighter,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  remediationText: {
    flex: 1,
    fontSize: 12,
    color: colors.text,
    lineHeight: 16,
  },
  timelineCard: {
    gap: 12,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.background,
    borderRadius: 8,
  },
  timelineIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.lighter,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineContent: {
    flex: 1,
  },
  timelineLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  timelineValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginTop: 2,
  },
});

export default InspectionDetailScreen;
