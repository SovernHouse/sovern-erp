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
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../../utils/colors';
import { inspectionAPI } from '../../services/api';
import LoadingScreen from '../../components/LoadingScreen';

const InspectionPrepScreen = ({ route, navigation }) => {
  const { inspectionId } = route.params;
  const [inspection, setInspection] = useState(null);
  const [checklist, setChecklist] = useState([]);
  const [loading, setLoading] = useState(true);

  const defaultChecklist = [
    {
      id: 1,
      title: 'Production Samples Prepared',
      description: 'Ensure samples are ready for inspection',
      checked: false,
    },
    {
      id: 2,
      title: 'Warehouse Cleaned',
      description: 'Clean inspection area and organize products',
      checked: false,
    },
    {
      id: 3,
      title: 'Quality Reports Ready',
      description: 'Have all QC reports available',
      checked: false,
    },
    {
      id: 4,
      title: 'Testing Equipment Available',
      description: 'Ensure all required testing equipment is functional',
      checked: false,
    },
    {
      id: 5,
      title: 'Documentation Complete',
      description: 'All batch records, certs ready',
      checked: false,
    },
    {
      id: 6,
      title: 'Staff Briefing Done',
      description: 'Brief team about inspection procedures',
      checked: false,
    },
    {
      id: 7,
      title: 'Safety Equipment Provided',
      description: 'PPE, safety gear available',
      checked: false,
    },
    {
      id: 8,
      title: 'Inspection Area Accessible',
      description: 'Clear pathways and easy access for inspector',
      checked: false,
    },
  ];

  useEffect(() => {
    fetchInspection();
  }, []);

  const fetchInspection = async () => {
    try {
      setLoading(true);
      const response = await inspectionAPI.getById(inspectionId);
      setInspection(response.data);
      setChecklist(defaultChecklist);
    } catch (error) {
      console.error('Error fetching inspection:', error);
      setChecklist(defaultChecklist);
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (itemId) => {
    setChecklist(
      checklist.map((item) =>
        item.id === itemId ? { ...item, checked: !item.checked } : item
      )
    );
  };

  const completedCount = checklist.filter((item) => item.checked).length;
  const totalCount = checklist.length;
  const readyPercentage = Math.round((completedCount / totalCount) * 100);

  if (loading) {
    return <LoadingScreen message="Loading preparation guide..." />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Inspection Preparation</Text>
          {inspection && (
            <Text style={styles.subtitle}>
              Inspection #{inspection.id}
            </Text>
          )}
        </View>

        {/* Readiness Score */}
        <View style={styles.scoreCard}>
          <View style={styles.scoreCircle}>
            <Text style={styles.scorePercentage}>{readyPercentage}%</Text>
            <Text style={styles.scoreLabel}>Ready</Text>
          </View>

          <View style={styles.scoreDetails}>
            <Text style={styles.scoreTitle}>Readiness Status</Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${readyPercentage}%`,
                    backgroundColor:
                      readyPercentage === 100
                        ? colors.success
                        : readyPercentage >= 50
                        ? colors.warning
                        : colors.danger,
                  },
                ]}
              />
            </View>
            <Text style={styles.scoreText}>
              {completedCount} of {totalCount} tasks completed
            </Text>
          </View>
        </View>

        {/* Information Box */}
        <View style={styles.infoBox}>
          <Icon name="information-outline" size={20} color={colors.info} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Preparation Tips</Text>
            <Text style={styles.infoText}>
              Complete all checklist items to ensure a smooth inspection process.
            </Text>
          </View>
        </View>

        {/* Checklist */}
        <View style={styles.checklistCard}>
          <Text style={styles.checklistTitle}>Preparation Checklist</Text>

          {checklist.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.checklistItem}
              onPress={() => toggleItem(item.id)}
            >
              <Icon
                name={item.checked ? 'checkbox-marked' : 'checkbox-blank-outline'}
                size={24}
                color={item.checked ? colors.success : colors.textSecondary}
              />
              <View style={styles.itemContent}>
                <Text
                  style={[
                    styles.itemTitle,
                    item.checked && styles.itemTitleCompleted,
                  ]}
                >
                  {item.title}
                </Text>
                <Text style={styles.itemDescription}>{item.description}</Text>
              </View>
              {item.checked && (
                <Icon name="check-circle" size={20} color={colors.success} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Next Steps */}
        <View style={styles.nextStepsCard}>
          <Text style={styles.nextStepsTitle}>What to Expect</Text>
          <NextStepItem
            number="1"
            title="Inspector Arrival"
            description="Inspector will arrive at scheduled date and time"
          />
          <NextStepItem
            number="2"
            title="Initial Briefing"
            description="Review inspection scope and procedures with inspector"
          />
          <NextStepItem
            number="3"
            title="Sample Inspection"
            description="Inspector checks product samples and quality"
          />
          <NextStepItem
            number="4"
            title="Documentation Review"
            description="Inspector reviews relevant documents and records"
          />
          <NextStepItem
            number="5"
            title="Report Issuance"
            description="Inspection report will be provided after completion"
          />
        </View>

        {/* Quick Contacts */}
        <View style={styles.contactsCard}>
          <Text style={styles.contactsTitle}>Need Help?</Text>
          <ContactItem
            icon="phone"
            label="Call Support"
            value="+1-800-XXX-XXXX"
          />
          <ContactItem
            icon="email"
            label="Email Support"
            value="support@trading-erp.com"
          />
        </View>
      </ScrollView>

      {/* Confirm Button */}
      {completedCount === totalCount && (
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={() => {
              Alert.alert(
                'Ready for Inspection',
                'Your facility is ready for the scheduled inspection!',
                [
                  {
                    text: 'OK',
                    onPress: () => navigation.goBack(),
                  },
                ]
              );
            }}
          >
            <Icon name="check-circle" size={20} color="#fff" />
            <Text style={styles.confirmButtonText}>
              Facility Ready for Inspection
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const NextStepItem = ({ number, title, description }) => (
  <View style={styles.nextStepItem}>
    <View style={styles.stepNumber}>
      <Text style={styles.stepNumberText}>{number}</Text>
    </View>
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{title}</Text>
      <Text style={styles.stepDescription}>{description}</Text>
    </View>
  </View>
);

const ContactItem = ({ icon, label, value }) => (
  <View style={styles.contactItem}>
    <Icon name={icon} size={18} color={colors.primary} />
    <View style={styles.contactContent}>
      <Text style={styles.contactLabel}>{label}</Text>
      <Text style={styles.contactValue}>{value}</Text>
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
    paddingBottom: 100,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 6,
  },
  scoreCard: {
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  scoreCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.lighter,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.primary,
  },
  scorePercentage: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
  },
  scoreLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  scoreDetails: {
    flex: 1,
  },
  scoreTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  scoreText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  infoBox: {
    backgroundColor: colors.lighter,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.info,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 12,
    color: colors.text,
    lineHeight: 16,
  },
  checklistCard: {
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  checklistTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  itemTitleCompleted: {
    color: colors.success,
    textDecorationLine: 'line-through',
  },
  itemDescription: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  nextStepsCard: {
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  nextStepsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  nextStepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 10,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.lighter,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.primary,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  stepDescription: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  contactsCard: {
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  contactsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  contactContent: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  contactValue: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
    marginTop: 2,
  },
  buttonContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    paddingTop: 12,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.success,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default InspectionPrepScreen;
