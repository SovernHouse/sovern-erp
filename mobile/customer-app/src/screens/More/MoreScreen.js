import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../utils/colors';

const MoreScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  const menuItems = [
    {
      section: 'Your Business',
      items: [
        {
          icon: 'document-text',
          label: 'Quotations',
          description: 'View all quotations',
          onPress: () => navigation.navigate('Quotations'),
        },
        {
          icon: 'alert-circle',
          label: 'Claims',
          description: 'Manage your claims',
          onPress: () => navigation.navigate('Claims'),
        },
      ],
    },
    {
      section: 'Account',
      items: [
        {
          icon: 'person',
          label: 'Profile',
          description: 'View your profile',
          onPress: () => navigation.navigate('Profile'),
        },
        {
          icon: 'notifications',
          label: 'Notification Settings',
          description: 'Manage notifications',
          onPress: () => navigation.navigate('NotificationSettings'),
        },
      ],
    },
    {
      section: 'Help & Support',
      items: [
        {
          icon: 'help-circle',
          label: 'Help & FAQ',
          description: 'Frequently asked questions',
          onPress: () => {
            // Navigate to help screen or open URL
          },
        },
        {
          icon: 'mail',
          label: 'Contact Us',
          description: 'Get in touch with support',
          onPress: () => {
            // Navigate to contact screen or open URL
          },
        },
        {
          icon: 'information-circle',
          label: 'About',
          description: 'About Trading ERP',
          onPress: () => {
            // Navigate to about screen
          },
        },
      ],
    },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>More</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {menuItems.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.section}</Text>

            {section.items.map((item, itemIndex) => (
              <TouchableOpacity
                key={itemIndex}
                style={[
                  styles.menuItem,
                  itemIndex === section.items.length - 1 && styles.menuItemLast,
                ]}
                onPress={item.onPress}
              >
                <View style={styles.menuItemLeft}>
                  <View style={styles.iconContainer}>
                    <Icon name={item.icon} size={20} color={colors.primary} />
                  </View>

                  <View style={styles.menuItemContent}>
                    <Text style={styles.menuItemLabel}>{item.label}</Text>
                    <Text style={styles.menuItemDescription}>
                      {item.description}
                    </Text>
                  </View>
                </View>

                <Icon name="chevron-forward" size={20} color={colors.gray400} />
              </TouchableOpacity>
            ))}
          </View>
        ))}

        {/* App Info */}
        <View style={styles.appInfoSection}>
          <View style={styles.appInfoBox}>
            <Text style={styles.appInfoVersion}>Trading ERP Mobile</Text>
            <Text style={styles.appInfoBuild}>Version 1.0.0</Text>
          </View>
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
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.gray900,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.gray600,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray900,
  },
  menuItemDescription: {
    fontSize: 12,
    color: colors.gray600,
    marginTop: 2,
  },
  appInfoSection: {
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  appInfoBox: {
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: colors.gray50,
    borderRadius: 8,
  },
  appInfoVersion: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray900,
  },
  appInfoBuild: {
    fontSize: 12,
    color: colors.gray600,
    marginTop: 4,
  },
});

export default MoreScreen;
