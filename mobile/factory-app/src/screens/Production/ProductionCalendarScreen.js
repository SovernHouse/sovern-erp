import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import CalendarPicker from 'react-native-calendar-picker';
import { colors } from '../../utils/colors';
import { formatDate } from '../../utils/formatters';
import { productionAPI } from '../../services/api';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';

const ProductionCalendarScreen = ({ navigation }) => {
  const [productions, setProductions] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [selectedDateProductions, setSelectedDateProductions] = useState([]);

  useEffect(() => {
    fetchProductions();
  }, []);

  useEffect(() => {
    filterByDate();
  }, [selectedDate, productions]);

  const fetchProductions = async () => {
    try {
      setLoading(true);
      const response = await productionAPI.getAll();
      setProductions(response.data);
    } catch (error) {
      console.error('Error fetching productions:', error);
      Alert.alert('Error', 'Failed to load production calendar');
    } finally {
      setLoading(false);
    }
  };

  const filterByDate = () => {
    const selectedDateStr = formatDate(selectedDate, 'YYYY-MM-DD');
    const filtered = productions.filter((p) => {
      const deliveryDateStr = formatDate(p.deliveryDate, 'YYYY-MM-DD');
      return deliveryDateStr === selectedDateStr;
    });
    setSelectedDateProductions(filtered);
  };

  const getHighlightedDates = () => {
    return productions.map((p) => ({
      date: new Date(p.deliveryDate),
      textStyle: styles.highlightedDate,
    }));
  };

  if (loading) {
    return <LoadingScreen message="Loading production calendar..." />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Calendar */}
        <View style={styles.calendarContainer}>
          <CalendarPicker
            onDateChange={(date) => setSelectedDate(date)}
            selectedStartDate={selectedDate}
            allowRangeSelection={false}
            todayBackgroundColor={colors.primary}
            todayTextStyle={styles.todayText}
            selectedDayColor={colors.primary}
            selectedDayTextColor="#fff"
            previousComponent={
              <Icon name="chevron-left" size={24} color={colors.primary} />
            }
            nextComponent={
              <Icon name="chevron-right" size={24} color={colors.primary} />
            }
          />
        </View>

        {/* Selected Date */}
        <View style={styles.selectedDateSection}>
          <View style={styles.selectedDateHeader}>
            <Icon name="calendar-today" size={20} color={colors.primary} />
            <Text style={styles.selectedDateText}>
              {formatDate(selectedDate, 'dddd, MMMM DD YYYY')}
            </Text>
          </View>

          {/* Production List for Selected Date */}
          {selectedDateProductions.length > 0 ? (
            <View style={styles.productionsList}>
              {selectedDateProductions.map((production) => (
                <TouchableOpacity
                  key={production.id}
                  style={styles.productionCard}
                  onPress={() =>
                    navigation.navigate('ProductionUpdateStack', {
                      productionId: production.id,
                    })
                  }
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.cardTitle}>
                      <Text style={styles.poNumber}>{production.poNumber}</Text>
                      <Text style={styles.supplier}>{production.supplier}</Text>
                    </View>
                    <Icon
                      name="chevron-right"
                      size={24}
                      color={colors.textSecondary}
                    />
                  </View>

                  <View style={styles.cardDivider} />

                  <View style={styles.cardContent}>
                    <View style={styles.cardInfoRow}>
                      <View style={styles.cardInfoItem}>
                        <Icon
                          name="package-variant"
                          size={16}
                          color={colors.textSecondary}
                        />
                        <Text style={styles.cardInfoText}>
                          {production.items?.length || 0} items
                        </Text>
                      </View>

                      <View style={styles.cardInfoItem}>
                        <Icon
                          name="sync"
                          size={16}
                          color={colors.primary}
                        />
                        <Text style={styles.cardInfoText}>
                          {Math.round(production.percentComplete)}% complete
                        </Text>
                      </View>

                      <View style={styles.cardInfoItem}>
                        <Icon
                          name={production.status === 'completed' ? 'check-circle' : 'sync'}
                          size={16}
                          color={production.status === 'completed' ? colors.success : colors.info}
                        />
                        <Text style={styles.cardInfoText}>
                          {production.status.replace(/_/g, ' ')}
                        </Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <EmptyState
              icon="calendar-blank"
              title="No Deadlines"
              message={`No production orders due on ${formatDate(selectedDate, 'MMMM DD')}`}
            />
          )}
        </View>

        {/* Summary Stats */}
        <View style={styles.summarySection}>
          <Text style={styles.summaryTitle}>Summary</Text>
          <View style={styles.summaryCards}>
            <SummaryCard
              icon="factory"
              label="Total Productions"
              value={productions.length}
              color={colors.info}
            />
            <SummaryCard
              icon="calendar-check"
              label="Due Today"
              value={selectedDateProductions.length}
              color={colors.warning}
            />
            <SummaryCard
              icon="check-circle"
              label="Completed"
              value={productions.filter((p) => p.status === 'completed').length}
              color={colors.success}
            />
          </View>
        </View>

        {/* Upcoming Deadlines */}
        <View style={styles.upcomingSection}>
          <Text style={styles.upcomingTitle}>Upcoming Deadlines</Text>
          {productions.length > 0 ? (
            <View style={styles.upcomingList}>
              {productions
                .sort(
                  (a, b) =>
                    new Date(a.deliveryDate).getTime() -
                    new Date(b.deliveryDate).getTime()
                )
                .slice(0, 5)
                .map((production) => (
                  <View key={production.id} style={styles.upcomingItem}>
                    <View style={styles.upcomingDate}>
                      <Text style={styles.upcomingDayText}>
                        {formatDate(production.deliveryDate, 'DD')}
                      </Text>
                      <Text style={styles.upcomingMonthText}>
                        {formatDate(production.deliveryDate, 'MMM')}
                      </Text>
                    </View>
                    <View style={styles.upcomingInfo}>
                      <Text style={styles.upcomingPO}>{production.poNumber}</Text>
                      <Text style={styles.upcomingSupplier}>{production.supplier}</Text>
                    </View>
                    <View style={styles.upcomingStatus}>
                      <Text style={styles.upcomingStatusText}>
                        {Math.round(production.percentComplete)}%
                      </Text>
                    </View>
                  </View>
                ))}
            </View>
          ) : (
            <Text style={styles.noUpcomingText}>No upcoming productions</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const SummaryCard = ({ icon, label, value, color }) => (
  <View style={[styles.summaryCard, { borderTopColor: color }]}>
    <View style={[styles.summaryIcon, { backgroundColor: color + '20' }]}>
      <Icon name={icon} size={20} color={color} />
    </View>
    <Text style={styles.summaryValue}>{value}</Text>
    <Text style={styles.summaryLabel}>{label}</Text>
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
  calendarContainer: {
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
  todayText: {
    color: '#fff',
  },
  selectedDateSection: {
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
  selectedDateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  selectedDateText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  productionsList: {
    gap: 12,
  },
  productionCard: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    flex: 1,
  },
  poNumber: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.text,
  },
  supplier: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 10,
  },
  cardContent: {
    gap: 8,
  },
  cardInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardInfoItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardInfoText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  summarySection: {
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
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  summaryCards: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderTopWidth: 3,
  },
  summaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  summaryLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  upcomingSection: {
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  upcomingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  upcomingList: {
    gap: 10,
  },
  upcomingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.background,
    borderRadius: 8,
    gap: 12,
  },
  upcomingDate: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: colors.lighter,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  upcomingDayText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
  },
  upcomingMonthText: {
    fontSize: 10,
    color: colors.primary,
    fontWeight: '600',
  },
  upcomingInfo: {
    flex: 1,
  },
  upcomingPO: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  upcomingSupplier: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  upcomingStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.lighter,
    borderRadius: 6,
  },
  upcomingStatusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.primary,
  },
  noUpcomingText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 20,
  },
});

export default ProductionCalendarScreen;
