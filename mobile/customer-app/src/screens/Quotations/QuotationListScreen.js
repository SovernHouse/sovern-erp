import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors } from '../../utils/colors';
import { quotationService } from '../../services/api';
import StatusBadge from '../../components/StatusBadge';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import { formatDate, formatCurrency } from '../../utils/formatters';

const QuotationListScreen = ({ navigation }) => {
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadQuotations();
  }, []);

  const loadQuotations = async () => {
    try {
      const response = await quotationService.getAll();
      setQuotations(response.data.data || []);
    } catch (error) {
      console.error('Error loading quotations:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadQuotations().finally(() => setRefreshing(false));
  }, []);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <View style={styles.container}>
      {quotations.length > 0 ? (
        <FlatList
          data={quotations}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.quotationCard}
              onPress={() =>
                navigation.navigate('QuotationDetail', {
                  quotationId: item.id,
                })
              }
            >
              <View style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  <Text style={styles.quotationNumber}>{item.number}</Text>
                  <StatusBadge status={item.status} />
                </View>

                <View style={styles.cardDetails}>
                  <View style={styles.detailRow}>
                    <Icon name="calendar" size={14} color={colors.gray500} />
                    <Text style={styles.detailText}>
                      {formatDate(item.createdAt, 'MMM DD, YYYY')}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Icon name="cube" size={14} color={colors.gray500} />
                    <Text style={styles.detailText}>
                      {item.itemCount} items
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Icon name="cash" size={14} color={colors.gray500} />
                    <Text style={styles.detailAmount}>
                      {formatCurrency(item.total)}
                    </Text>
                  </View>
                </View>

                {item.expiryDate && (
                  <View style={styles.expiryInfo}>
                    <Icon name="time" size={14} color={colors.warning} />
                    <Text style={styles.expiryText}>
                      Expires {formatDate(item.expiryDate, 'MMM DD')}
                    </Text>
                  </View>
                )}
              </View>

              <Icon name="chevron-forward" size={24} color={colors.gray300} />
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          scrollEnabled={true}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <EmptyState
            icon="document-outline"
            title="No Quotations"
            message="You don't have any quotations yet"
          />
        </View>
      )}

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() =>
          navigation.getParent().navigate('OrderStack', {
            screen: 'RequestQuote',
          })
        }
      >
        <Icon name="add" size={28} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  quotationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  cardContent: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  quotationNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray900,
  },
  cardDetails: {
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  detailText: {
    fontSize: 12,
    color: colors.gray600,
  },
  detailAmount: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  expiryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
  },
  expiryText: {
    fontSize: 12,
    color: colors.warning,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});

export default QuotationListScreen;
