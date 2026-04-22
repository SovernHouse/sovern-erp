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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../../utils/colors';
import { userService } from '../../services/api';
import LoadingScreen from '../../components/LoadingScreen';
import { getInitials } from '../../utils/formatters';

const ProfileScreen = ({ navigation }) => {
  const [userData, setUserData] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const [profileRes, userDataStr] = await Promise.all([
        userService.getProfile(),
        AsyncStorage.getItem('userData'),
      ]);

      setUserData(profileRes.data);
      if (userDataStr) {
        const parsed = JSON.parse(userDataStr);
        setStats({
          totalOrders: parsed.totalOrders || 0,
          totalSpent: parsed.totalSpent || 0,
          orderHistory: parsed.orderHistory || [],
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', onPress: () => {}, style: 'cancel' },
      {
        text: 'Logout',
        onPress: async () => {
          setLoggingOut(true);
          try {
            await AsyncStorage.removeItem('userToken');
            await AsyncStorage.removeItem('userData');
            // Navigation will be handled by App.js
          } catch (error) {
            Alert.alert('Error', 'Failed to logout');
            setLoggingOut(false);
          }
        },
        style: 'destructive',
      },
    ]);
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (!userData) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load profile</Text>
      </View>
    );
  }

  const initials = getInitials(userData.firstName, userData.lastName);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatar}>{initials}</Text>
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {userData.firstName} {userData.lastName}
            </Text>
            <Text style={styles.profileEmail}>{userData.email}</Text>
            <Text style={styles.profileCompany}>{userData.company}</Text>
          </View>
        </View>

        {/* Stats Cards */}
        {stats && (
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.totalOrders}</Text>
              <Text style={styles.statLabel}>Total Orders</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>${(stats.totalSpent / 1000).toFixed(1)}k</Text>
              <Text style={styles.statLabel}>Total Spent</Text>
            </View>
          </View>
        )}

        {/* Account Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Information</Text>

          <View style={styles.infoItem}>
            <View style={styles.infoLeft}>
              <Icon name="person" size={20} color={colors.primary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Name</Text>
                <Text style={styles.infoValue}>
                  {userData.firstName} {userData.lastName}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.infoItem}>
            <View style={styles.infoLeft}>
              <Icon name="mail" size={20} color={colors.primary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{userData.email}</Text>
              </View>
            </View>
          </View>

          <View style={styles.infoItem}>
            <View style={styles.infoLeft}>
              <Icon name="business" size={20} color={colors.primary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Company</Text>
                <Text style={styles.infoValue}>{userData.company}</Text>
              </View>
            </View>
          </View>

          {userData.phone && (
            <View style={styles.infoItem}>
              <View style={styles.infoLeft}>
                <Icon name="call" size={20} color={colors.primary} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Phone</Text>
                  <Text style={styles.infoValue}>{userData.phone}</Text>
                </View>
              </View>
            </View>
          )}

          {userData.address && (
            <View style={styles.infoItem}>
              <View style={styles.infoLeft}>
                <Icon name="location" size={20} color={colors.primary} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Address</Text>
                  <Text style={styles.infoValue} numberOfLines={2}>
                    {userData.address}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => navigation.navigate('NotificationSettings')}
          >
            <View style={styles.settingLeft}>
              <Icon name="notifications" size={20} color={colors.primary} />
              <Text style={styles.settingLabel}>Notification Preferences</Text>
            </View>
            <Icon name="chevron-forward" size={20} color={colors.gray400} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => {
              Alert.alert('Change Password', 'Redirect to password change screen', [
                { text: 'OK', onPress: () => {} },
              ]);
            }}
          >
            <View style={styles.settingLeft}>
              <Icon name="lock-closed" size={20} color={colors.primary} />
              <Text style={styles.settingLabel}>Change Password</Text>
            </View>
            <Icon name="chevron-forward" size={20} color={colors.gray400} />
          </TouchableOpacity>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.dangerButton, loggingOut && styles.buttonDisabled]}
            onPress={handleLogout}
            disabled={loggingOut}
          >
            {loggingOut ? (
              <ActivityIndicator color={colors.error} size="small" />
            ) : (
              <>
                <Icon name="log-out" size={20} color={colors.error} />
                <Text style={styles.dangerButtonText}>Logout</Text>
              </>
            )}
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
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: colors.primaryLight,
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatar: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.white,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray900,
  },
  profileEmail: {
    fontSize: 12,
    color: colors.gray600,
    marginTop: 4,
  },
  profileCompany: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 16,
    marginVertical: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.gray50,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  statLabel: {
    fontSize: 11,
    color: colors.gray600,
    marginTop: 4,
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
  infoItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.gray50,
    borderRadius: 8,
    marginBottom: 8,
  },
  infoLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: colors.gray600,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray900,
    marginTop: 2,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.gray50,
    borderRadius: 8,
    marginBottom: 8,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  settingLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.gray900,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.errorLight,
    borderRadius: 8,
    gap: 8,
  },
  dangerButtonText: {
    color: colors.error,
    fontWeight: '600',
    fontSize: 14,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default ProfileScreen;
