import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../../utils/colors';

const MoreScreen = ({ navigation }) => {
  const menuSections = [
    {
      title: 'Operations',
      items: [
        {
          icon: 'package-variant',
          label: 'Products',
          description: 'Manage product catalog',
          onPress: () => navigation.navigate('ProductList'),
        },
        {
          icon: 'currency-usd',
          label: 'Update Prices',
          description: 'Bulk price updates',
          onPress: () => navigation.navigate('PriceUpdate'),
        },
        {
          icon: 'file-document',
          label: 'Documents',
          description: 'Manage shipping docs',
          onPress: () => navigation.navigate('DocumentUploadStack'),
        },
      ],
    },
    {
      title: 'Quality',
      items: [
        {
          icon: 'clipboard-check',
          label: 'Inspections',
          description: 'View inspection schedule',
          onPress: () => navigation.navigate('InspectionList'),
        },
      ],
    },
    {
      title: 'Account',
      items: [
        {
          icon: 'account',
          label: 'My Profile',
          description: 'Factory information',
          onPress: () => navigation.navigate('ProfileStack'),
        },
        {
          icon: 'phone',
          label: 'Contact Support',
          description: 'Get help and support',
          onPress: () => {
            // Open support contact
          },
        },
        {
          icon: 'information',
          label: 'About App',
          description: 'App information',
          onPress: () => {
            // Show about dialog
          },
        },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>More Options</Text>
          <Text style={styles.subtitle}>Access additional features and settings</Text>
        </View>

        {/* Menu Sections */}
        {menuSections.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>

            <View style={styles.itemsContainer}>
              {section.items.map((item, itemIndex) => (
                <TouchableOpacity
                  key={itemIndex}
                  style={styles.menuItem}
                  onPress={item.onPress}
                  activeOpacity={0.7}
                >
                  <View style={styles.itemIconContainer}>
                    <Icon
                      name={item.icon}
                      size={24}
                      color={colors.primary}
                    />
                  </View>

                  <View style={styles.itemContent}>
                    <Text style={styles.itemLabel}>{item.label}</Text>
                    <Text style={styles.itemDescription}>
                      {item.description}
                    </Text>
                  </View>

                  <Icon
                    name="chevron-right"
                    size={24}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Quick Stats */}
        <View style={styles.statsSection}>
          <Text style={styles.statsSectionTitle}>Quick Stats</Text>
          <View style={styles.statsGrid}>
            <StatCard icon="file-document" label="POs" value="24" />
            <StatCard icon="factory" label="Production" value="12" />
            <StatCard icon="truck-fast" label="Shipments" value="8" />
            <StatCard icon="clipboard-check" label="Inspections" value="3" />
          </View>
        </View>

        {/* Useful Links */}
        <View style={styles.linksSection}>
          <Text style={styles.linksSectionTitle}>Useful Links</Text>
          <View style={styles.linksContainer}>
            <LinkButton
              icon="file-pdf"
              label="User Manual"
              onPress={() => {}}
            />
            <LinkButton
              icon="play-circle"
              label="Video Tutorials"
              onPress={() => {}}
            />
            <LinkButton
              icon="bug-report"
              label="Report Issue"
              onPress={() => {}}
            />
            <LinkButton
              icon="comment"
              label="Send Feedback"
              onPress={() => {}}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const StatCard = ({ icon, label, value }) => (
  <View style={styles.statCard}>
    <Icon name={icon} size={28} color={colors.primary} />
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const LinkButton = ({ icon, label, onPress }) => (
  <TouchableOpacity
    style={styles.linkButton}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Icon name={icon} size={20} color={colors.primary} />
    <Text style={styles.linkLabel}>{label}</Text>
    <Icon name="arrow-top-right" size={16} color={colors.textSecondary} />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingBottom: 20,
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
  section: {
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemsContainer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.lighter,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemContent: {
    flex: 1,
  },
  itemLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  itemDescription: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statsSection: {
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
  statsSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
  },
  statLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  linksSection: {
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
  linksSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  linksContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  linkButton: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.lighter,
    borderRadius: 8,
  },
  linkLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    color: colors.text,
  },
});

export default MoreScreen;
