import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  SafeAreaView,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../../utils/colors';
import { poAPI } from '../../services/api';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import POCard from '../../components/POCard';
import { PO_STATUS } from '../../utils/constants';

const POListScreen = ({ navigation }) => {
  const [allPOs, setAllPOs] = useState([]);
  const [filteredPOs, setFilteredPOs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const statuses = [
    { key: 'draft', label: 'Draft', icon: 'pencil' },
    { key: 'confirmed', label: 'Confirmed', icon: 'check-circle' },
    { key: 'in_production', label: 'In Production', icon: 'factory' },
    { key: 'ready_to_ship', label: 'Ready', icon: 'package-variant' },
    { key: 'shipped', label: 'Shipped', icon: 'truck-fast' },
  ];

  useEffect(() => {
    fetchPOs();
  }, []);

  useEffect(() => {
    filterPOs();
  }, [allPOs, searchQuery, selectedStatus]);

  const fetchPOs = async () => {
    try {
      setLoading(true);
      const response = await poAPI.getAll({ limit: 100 });
      setAllPOs(response.data);
    } catch (error) {
      console.error('Error fetching POs:', error);
      Alert.alert('Error', 'Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPOs().finally(() => setRefreshing(false));
  }, []);

  const filterPOs = () => {
    let results = allPOs;

    // Filter by status
    if (selectedStatus) {
      results = results.filter((po) => po.status === selectedStatus);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      results = results.filter(
        (po) =>
          po.poNumber.toLowerCase().includes(query) ||
          po.supplier?.name?.toLowerCase().includes(query)
      );
    }

    setFilteredPOs(results);
  };

  if (loading) {
    return <LoadingScreen message="Loading purchase orders..." />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Search Bar */}
        <View style={styles.searchSection}>
          <View style={styles.searchWrapper}>
            <Icon
              name="magnify"
              size={20}
              color={colors.textSecondary}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search POs by number or supplier..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Icon
                  name="close"
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Status Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContent}
        >
          <TouchableOpacity
            style={[
              styles.filterChip,
              selectedStatus === null && styles.filterChipActive,
            ]}
            onPress={() => setSelectedStatus(null)}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedStatus === null && styles.filterChipTextActive,
              ]}
            >
              All
            </Text>
          </TouchableOpacity>

          {statuses.map((status) => (
            <TouchableOpacity
              key={status.key}
              style={[
                styles.filterChip,
                selectedStatus === status.key && styles.filterChipActive,
              ]}
              onPress={() => setSelectedStatus(status.key)}
            >
              <Icon
                name={status.icon}
                size={14}
                color={selectedStatus === status.key ? colors.surface : colors.textSecondary}
                style={styles.filterIcon}
              />
              <Text
                style={[
                  styles.filterChipText,
                  selectedStatus === status.key && styles.filterChipTextActive,
                ]}
              >
                {status.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* PO List */}
        {filteredPOs.length > 0 ? (
          <FlatList
            data={filteredPOs}
            renderItem={({ item }) => (
              <POCard
                po={item}
                onPress={() =>
                  navigation.navigate('PODetailStack', { poId: item.id })
                }
              />
            )}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
              />
            }
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <FlatList
            scrollEnabled
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
              />
            }
            contentContainerStyle={styles.emptyContainer}
            data={[]}
            renderItem={() => null}
            ListEmptyComponent={
              <EmptyState
                icon="inbox"
                title={searchQuery ? 'No Results Found' : 'No Purchase Orders'}
                message={
                  searchQuery
                    ? 'Try searching with different keywords.'
                    : 'You don\'t have any purchase orders yet.'
                }
              />
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  filterScroll: {
    backgroundColor: colors.surface,
    paddingVertical: 8,
  },
  filterContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: colors.surface,
  },
  filterIcon: {
    marginRight: 2,
  },
  listContent: {
    paddingVertical: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
  },
});

export default POListScreen;
