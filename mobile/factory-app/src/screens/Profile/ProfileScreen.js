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
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../../utils/colors';
import { factoryAPI } from '../../services/api';
import LoadingScreen from '../../components/LoadingScreen';

const ProfileScreen = ({ navigation }) => {
  const [profile, setProfile] = useState(null);
  const [certifications, setCertifications] = useState([]);
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      const [profileRes, certsRes, teamRes] = await Promise.all([
        factoryAPI.getProfile(),
        factoryAPI.getCertifications(),
        factoryAPI.getTeam(),
      ]);

      setProfile(profileRes.data);
      setCertifications(certsRes.data);
      setTeam(teamRes.data);
    } catch (error) {
      console.error('Error fetching profile:', error);
      Alert.alert('Error', 'Failed to load profile information');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      {
        text: 'Cancel',
        onPress: () => {},
        style: 'cancel',
      },
      {
        text: 'Logout',
        onPress: async () => {
          try {
            setLoggingOut(true);
            await AsyncStorage.removeItem('userToken');
            await AsyncStorage.removeItem('factory');
          } catch (error) {
            console.error('Error logging out:', error);
          } finally {
            setLoggingOut(false);
          }
        },
        style: 'destructive',
      },
    ]);
  };

  if (loading) {
    return <LoadingScreen message="Loading profile..." />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Factory Header */}
        {profile && (
          <View style={styles.headerCard}>
            <View style={styles.headerIcon}>
              <Icon name="factory" size={48} color={colors.primary} />
            </View>
            <Text style={styles.factoryName}>{profile.name}</Text>
            <Text style={styles.factoryId}>{profile.factoryId}</Text>

            <View style={styles.headerDivider} />

            <View style={styles.headerInfo}>
              <InfoItem label="Location" value={profile.location} />
              <InfoItem label="Contact" value={profile.contactEmail} />
              <InfoItem label="Phone" value={profile.contactPhone} />
              <InfoItem label="Country" value={profile.country} />
            </View>
          </View>
        )}

        {/* Certifications */}
        {certifications.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Certifications</Text>
            <View style={styles.certificationsContainer}>
              {certifications.map((cert, index) => (
                <View key={index} style={styles.certCard}>
                  <Icon name="certificate" size={24} color={colors.primary} />
                  <View style={styles.certInfo}>
                    <Text style={styles.certName}>{cert.name}</Text>
                    <Text style={styles.certDetail}>
                      Valid until: {cert.expiryDate}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Team Members */}
        {team.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Team Members</Text>
              <TouchableOpacity style={styles.addTeamButton}>
                <Icon name="plus-circle" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.teamContainer}>
              {team.map((member, index) => (
                <View key={index} style={styles.teamCard}>
                  <View style={styles.teamAvatar}>
                    <Icon name="account" size={24} color={colors.primary} />
                  </View>
                  <View style={styles.teamInfo}>
                    <Text style={styles.teamName}>{member.name}</Text>
                    <Text style={styles.teamRole}>{member.role}</Text>
                    <Text style={styles.teamEmail}>{member.email}</Text>
                  </View>
                  <TouchableOpacity style={styles.teamAction}>
                    <Icon name="chevron-right" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Account Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Settings</Text>
          <View style={styles.settingsContainer}>
            <SettingItem
              icon="lock"
              label="Change Password"
              onPress={() => Alert.alert('Info', 'Feature coming soon')}
            />
            <SettingItem
              icon="bell"
              label="Notifications"
              onPress={() => Alert.alert('Info', 'Feature coming soon')}
            />
            <SettingItem
              icon="download"
              label="Download App Update"
              onPress={() => Alert.alert('Info', 'You have the latest version')}
            />
            <SettingItem
              icon="file-document"
              label="Terms & Conditions"
              onPress={() => Alert.alert('Info', 'Feature coming soon')}
            />
          </View>
        </View>

        {/* Logout Button */}
        <View style={styles.logoutSection}>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            disabled={loggingOut}
          >
            {loggingOut ? (
              <ActivityIndicator size="small" color={colors.danger} />
            ) : (
              <>
                <Icon name="logout" size={18} color={colors.danger} />
                <Text style={styles.logoutButtonText}>Logout</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* App Version */}
        <View style={styles.footerSection}>
          <Text style={styles.versionText}>Factory Partner App v1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const InfoItem = ({ label, value }) => (
  <View style={styles.infoItem}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const SettingItem = ({ icon, label, onPress }) => (
  <TouchableOpacity style={styles.settingItem} onPress={onPress}>
    <Icon name={icon} size={18} color={colors.primary} />
    <Text style={styles.settingLabel}>{label}</Text>
    <Icon name="chevron-right" size={18} color={colors.textSecondary} />
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
    paddingBottom: 40,
  },
  headerCard: {
    backgroundColor: colors.surface,
    margin: 16,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.lighter,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  factoryName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  factoryId: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  headerDivider: {
    height: 1,
    backgroundColor: colors.border,
    width: '100%',
    marginVertical: 12,
  },
  headerInfo: {
    width: '100%',
    gap: 8,
  },
  infoItem: {
    marginBottom: 4,
  },
  infoLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginTop: 2,
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addTeamButton: {
    padding: 4,
  },
  certificationsContainer: {
    gap: 10,
  },
  certCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: colors.background,
    borderRadius: 8,
  },
  certInfo: {
    flex: 1,
  },
  certName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  certDetail: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  teamContainer: {
    gap: 10,
  },
  teamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: colors.background,
    borderRadius: 8,
  },
  teamAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.lighter,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamInfo: {
    flex: 1,
  },
  teamName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  teamRole: {
    fontSize: 11,
    color: colors.primary,
    marginTop: 2,
  },
  teamEmail: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  teamAction: {
    padding: 4,
  },
  settingsContainer: {
    gap: 8,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: colors.background,
    borderRadius: 8,
  },
  settingLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
  },
  logoutSection: {
    marginHorizontal: 16,
    marginVertical: 8,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.danger,
    gap: 8,
  },
  logoutButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.danger,
  },
  footerSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  versionText: {
    fontSize: 11,
    color: colors.textMuted,
  },
});

export default ProfileScreen;
