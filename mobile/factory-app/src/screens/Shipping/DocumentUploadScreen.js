import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ImagePicker from 'react-native-image-picker';
import { colors } from '../../utils/colors';
import { DOCUMENT_TYPES } from '../../utils/constants';
import { shipmentAPI } from '../../services/api';
import LoadingScreen from '../../components/LoadingScreen';
import DocumentSlot from '../../components/DocumentSlot';

const DocumentUploadScreen = ({ route, navigation }) => {
  const { shipmentId } = route.params;
  const [shipment, setShipment] = useState(null);
  const [documents, setDocuments] = useState({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchShipmentDocuments();
  }, []);

  const fetchShipmentDocuments = async () => {
    try {
      setLoading(true);
      const response = await shipmentAPI.getDocuments(shipmentId);
      const docsMap = {};
      response.data.forEach((doc) => {
        docsMap[doc.documentType] = {
          id: doc.id,
          fileName: doc.fileName,
          status: 'uploaded',
          uri: doc.fileUrl,
        };
      });
      setDocuments(docsMap);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentUpload = (documentType) => {
    ImagePicker.launchImageLibrary(
      {
        mediaType: 'photo',
        type: 'application/pdf',
        includeBase64: false,
      },
      (response) => {
        if (response.didCancel) {
          console.log('User cancelled document picker');
        } else if (response.errorCode) {
          Alert.alert('Error', 'Failed to select document');
        } else {
          uploadDocument(documentType, response.assets[0]);
        }
      }
    );
  };

  const uploadDocument = async (documentType, file) => {
    try {
      setUploading(true);
      setDocuments((prev) => ({
        ...prev,
        [documentType]: {
          ...prev[documentType],
          status: 'uploading',
        },
      }));

      await shipmentAPI.uploadDocument(shipmentId, documentType, {
        uri: file.uri,
        type: file.type,
        name: file.fileName,
      });

      setDocuments((prev) => ({
        ...prev,
        [documentType]: {
          fileName: file.fileName,
          status: 'uploaded',
          uri: file.uri,
        },
      }));

      Alert.alert('Success', `${documentType.replace(/_/g, ' ')} uploaded successfully`);
    } catch (error) {
      console.error('Error uploading document:', error);
      Alert.alert('Error', 'Failed to upload document');
      setDocuments((prev) => ({
        ...prev,
        [documentType]: {
          ...prev[documentType],
          status: 'empty',
        },
      }));
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveDocument = (documentType) => {
    Alert.alert(
      'Remove Document',
      'Are you sure you want to remove this document?',
      [
        {
          text: 'Cancel',
          onPress: () => {},
          style: 'cancel',
        },
        {
          text: 'Remove',
          onPress: () => {
            setDocuments((prev) => ({
              ...prev,
              [documentType]: undefined,
            }));
          },
          style: 'destructive',
        },
      ]
    );
  };

  if (loading) {
    return <LoadingScreen message="Loading documents..." />;
  }

  const uploadedCount = Object.values(documents).filter(
    (doc) => doc && doc.status === 'uploaded'
  ).length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header Stats */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Icon name="file-document-multiple" size={24} color={colors.primary} />
            <View style={styles.statContent}>
              <Text style={styles.statLabel}>Documents Uploaded</Text>
              <Text style={styles.statValue}>{uploadedCount}/{DOCUMENT_TYPES.length}</Text>
            </View>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${(uploadedCount / DOCUMENT_TYPES.length) * 100}%`,
                },
              ]}
            />
          </View>
        </View>

        {/* Document Slots */}
        <View style={styles.documentsList}>
          {DOCUMENT_TYPES.map((docType) => {
            const doc = documents[docType.id];
            const status = doc?.status || 'empty';

            return (
              <DocumentSlot
                key={docType.id}
                label={docType.label}
                icon={docType.icon}
                status={status}
                fileName={doc?.fileName}
                onUpload={() => handleDocumentUpload(docType.id)}
                onRemove={() => handleRemoveDocument(docType.id)}
                onView={() => {
                  if (doc?.uri) {
                    Alert.alert('Document', `Opening ${docType.label}`);
                  }
                }}
              />
            );
          })}
        </View>

        {/* Instructions */}
        <View style={styles.instructionsCard}>
          <View style={styles.instructionHeader}>
            <Icon name="information-outline" size={20} color={colors.info} />
            <Text style={styles.instructionTitle}>Upload Requirements</Text>
          </View>
          <View style={styles.instructionList}>
            <InstructionItem
              icon="check-circle"
              text="All documents must be clear and legible"
            />
            <InstructionItem
              icon="check-circle"
              text="Accepted formats: PDF, JPG, PNG"
            />
            <InstructionItem
              icon="check-circle"
              text="Maximum file size: 10 MB per document"
            />
            <InstructionItem
              icon="check-circle"
              text="Ensure signatures and stamps are visible"
            />
            <InstructionItem
              icon="check-circle"
              text="Bill of Lading and Invoice are required"
            />
          </View>
        </View>

        {/* Checklist */}
        <View style={styles.checklistCard}>
          <View style={styles.checklistHeader}>
            <Icon name="clipboard-check-outline" size={20} color={colors.success} />
            <Text style={styles.checklistTitle}>Recommended Documents</Text>
          </View>
          <View style={styles.checklistItems}>
            <ChecklistItem
              label="Bill of Lading"
              completed={!!documents.bill_of_lading}
              required
            />
            <ChecklistItem
              label="Commercial Invoice"
              completed={!!documents.commercial_invoice}
              required
            />
            <ChecklistItem
              label="Packing List"
              completed={!!documents.packing_list}
            />
            <ChecklistItem
              label="Certificate of Origin"
              completed={!!documents.certificate_of_origin}
            />
            <ChecklistItem
              label="Insurance Certificate"
              completed={!!documents.insurance_certificate}
            />
            <ChecklistItem
              label="Fumigation Certificate"
              completed={!!documents.fumigation_certificate}
            />
          </View>
        </View>
      </ScrollView>

      {/* Action Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.completeButton}
          onPress={() => {
            if (uploadedCount >= 2) {
              Alert.alert('Success', 'All required documents uploaded', [
                {
                  text: 'OK',
                  onPress: () => navigation.goBack(),
                },
              ]);
            } else {
              Alert.alert('Missing Documents', 'Please upload at least Bill of Lading and Commercial Invoice');
            }
          }}
        >
          <Icon name="check-circle" size={20} color="#fff" />
          <Text style={styles.completeButtonText}>
            Documents Complete ({uploadedCount}/{DOCUMENT_TYPES.length})
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const InstructionItem = ({ icon, text }) => (
  <View style={styles.instructionItemContainer}>
    <Icon name={icon} size={16} color={colors.info} />
    <Text style={styles.instructionText}>{text}</Text>
  </View>
);

const ChecklistItem = ({ label, completed, required = false }) => (
  <View style={styles.checklistItem}>
    <Icon
      name={completed ? 'check-circle' : 'circle-outline'}
      size={20}
      color={completed ? colors.success : colors.textSecondary}
    />
    <Text style={[styles.checklistItemText, completed && styles.checklistItemCompleted]}>
      {label}
    </Text>
    {required && <Text style={styles.requiredBadge}>Required</Text>}
  </View>
);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    paddingBottom: 100,
  },
  statsCard: {
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  statContent: {
    flex: 1,
  },
  statLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 2,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  documentsList: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  instructionsCard: {
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.info,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  instructionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  instructionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  instructionList: {
    gap: 10,
  },
  instructionItemContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  instructionText: {
    fontSize: 12,
    color: colors.text,
    flex: 1,
    lineHeight: 16,
  },
  checklistCard: {
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  checklistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  checklistTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  checklistItems: {
    gap: 10,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checklistItemText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
  },
  checklistItemCompleted: {
    color: colors.success,
    fontWeight: '600',
  },
  requiredBadge: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.danger,
    backgroundColor: colors.danger + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  buttonContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    paddingTop: 12,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default DocumentUploadScreen;
