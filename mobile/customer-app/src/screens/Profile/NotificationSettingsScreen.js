import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors } from '../../utils/colors';
import { userService } from '../../services/api';
import LoadingScreen from '../../components/LoadingScreen';

const NotificationSettingsScreen = () => {
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const response = await userService.getNotificationPreferences();
      setPreferences(response.data);
    } catch (error) {
      console.error('Error loading preferences:', error);
      // Set default preferences
      setPreferences({
        orderUpdates: true,
        shipmentUpdates: true,
        promotions: false,
        newsAndTips: true,
        accountAlerts: true,
        pushNotifications: true,
        emailNotifications: true,
        smsNotifications: false,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (key) => {
    setPreferences({
      ...preferences,
      [key]: !preferences[key],
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await userService.updateNotificationPreferences(preferences);
      Alert.alert('Success', 'Notification preferences updated');
    } catch (error) {
      Alert.alert('Error', 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (!preferences) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load preferences</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Notification Types */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notification Types</Text>

          <View style={styles.preferenceItem}>
            <View style={styles.preferenceLeft}>
              <Icon name="receipt" size={20} color={colors.primary} />
              <View style={styles.preferenceContent}>
                <Text style={styles.preferenceName}>Order Updates</Text>
                <Text style={styles.preferenceDescription}>
                  Order confirmations, status changes
                </Text>
              </View>
            </View>
            <Switch
              value={preferences.orderUpdates}
              onValueChange={() => handleToggle('orderUpdates')}
              trackColor={{ false: colors.gray300, true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>

          <View style={styles.preferenceItem}>
            <View style={styles.preferenceLeft}>
              <Icon name="truck" size={20} color={colors.primary} />
              <View style={styles.preferenceContent}>
                <Text style={styles.preferenceName}>Shipment Updates</Text>
                <Text style={styles.preferenceDescription}>
                  Tracking, delivery notifications
                </Text>
              </View>
            </View>
            <Switch
              value={preferences.shipmentUpdates}
              onValueChange={() => handleToggle('shipmentUpdates')}
              trackColor={{ false: colors.gray300, true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>

          <View style={styles.preferenceItem}>
            <View style={styles.preferenceLeft}>
              <Icon name="alert-circle" size={20} color={colors.primary} />
              <View style={styles.preferenceContent}>
                <Text style={styles.preferenceName}>Account Alerts</Text>
                <Text style={styles.preferenceDescription}>
                  Login notifications, security alerts
                </Text>
              </View>
            </View>
            <Switch
              value={preferences.accountAlerts}
              onValueChange={() => handleToggle('accountAlerts')}
              trackColor={{ false: colors.gray300, true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>

          <View style={styles.preferenceItem}>
            <View style={styles.preferenceLeft}>
              <Icon name="bulb" size={20} color={colors.primary} />
              <View style={styles.preferenceContent}>
                <Text style={styles.preferenceName}>News & Tips</Text>
                <Text style={styles.preferenceDescription}>
                  Product news, helpful tips
                </Text>
              </View>
            </View>
            <Switch
              value={preferences.newsAndTips}
              onValueChange={() => handleToggle('newsAndTips')}
              trackColor={{ false: colors.gray300, true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>

          <View style={styles.preferenceItem}>
            <View style={styles.preferenceLeft}>
              <Icon name="pricetag" size={20} color={colors.primary} />
              <View style={styles.preferenceContent}>
                <Text style={styles.preferenceName}>Promotions</Text>
                <Text style={styles.preferenceDescription}>
                  Special offers, discounts
                </Text>
              </View>
            </View>
            <Switch
              value={preferences.promotions}
              onValueChange={() => handleToggle('promotions')}
              trackColor={{ false: colors.gray300, true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>
        </View>

        {/* Channel Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Communication Channels</Text>

          <View style={styles.preferenceItem}>
            <View style={styles.preferenceLeft}>
              <Icon name="notifications" size={20} color={colors.primary} />
              <View style={styles.preferenceContent}>
                <Text style={styles.preferenceName}>Push Notifications</Text>
                <Text style={styles.preferenceDescription}>
                  In-app and mobile notifications
                </Text>
              </View>
            </View>
            <Switch
              value={preferences.pushNotifications}
              onValueChange={() => handleToggle('pushNotifications')}
              trackColor={{ false: colors.gray300, true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>

          <View style={styles.preferenceItem}>
            <View style={styles.preferenceLeft}>
              <Icon name="mail" size={20} color={colors.primary} />
              <View style={styles.preferenceContent}>
                <Text style={styles.preferenceName}>Email Notifications</Text>
                <Text style={styles.preferenceDescription}>
                  Important updates via email
                </Text>
              </View>
            </View>
            <Switch
              value={preferences.emailNotifications}
              onValueChange={() => handleToggle('emailNotifications')}
              trackColor={{ false: colors.gray300, true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>

          <View style={styles.preferenceItem}>
            <View style={styles.preferenceLeft}>
              <Icon name="phone-portrait" size={20} color={colors.primary} />
              <View style={styles.preferenceContent}>
                <Text style={styles.preferenceName}>SMS Notifications</Text>
                <Text style={styles.preferenceDescription}>
                  Critical alerts via SMS
                </Text>
              </View>
            </View>
            <Switch
              value={preferences.smsNotifications}
              onValueChange={() => handleToggle('smsNotifications')}
              trackColor={{ false: colors.gray300, true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Icon name="information-circle" size={24} color={colors.info} />
          <Text style={styles.infoText}>
            You can change these preferences at any time. We respect your privacy and will only
            send you notifications based on your preferences.
          </Text>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Save Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <>
              <Icon name="save" size={18} color={colors.white} />
              <Text style={styles.saveButtonText}>Save Preferences</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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
  section: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray900,
    marginBottom: 12,
  },
  preferenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.gray50,
    borderRadius: 8,
    marginBottom: 8,
  },
  preferenceLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  preferenceContent: {
    flex: 1,
  },
  preferenceName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray900,
  },
  preferenceDescription: {
    fontSize: 11,
    color: colors.gray600,
    marginTop: 4,
  },
  infoBox: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.infoLight,
    borderRadius: 8,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: colors.gray700,
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: 8,
    gap: 8,
  },
  saveButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 14,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
});

export default NotificationSettingsScreen;
