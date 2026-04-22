import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../utils/colors';
import { formatDate, daysUntil } from '../utils/formatters';
import { LABEL_STATUS, COLORS_STATUS } from '../utils/constants';
import StatusBadge from './StatusBadge';

const POCard = ({ po, onPress }) => {
  const daysLeft = daysUntil(po.deliveryDate);
  const isOverdue = daysLeft < 0;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.poNumber}>{po.poNumber}</Text>
          <StatusBadge
            status={po.status}
            label={LABEL_STATUS[po.status]}
          />
        </View>
        <Icon
          name="chevron-right"
          size={24}
          color={colors.textSecondary}
        />
      </View>

      <View style={styles.divider} />

      <View style={styles.content}>
        <View style={styles.row}>
          <View style={styles.infoItem}>
            <Text style={styles.label}>Items</Text>
            <Text style={styles.value}>{po.items?.length || 0}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.label}>Total Value</Text>
            <Text style={styles.value}>${po.totalValue?.toLocaleString() || '0'}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.label}>Qty</Text>
            <Text style={styles.value}>{po.totalQuantity || 0}</Text>
          </View>
        </View>

        <View style={styles.deliverySection}>
          <Icon
            name="calendar-outline"
            size={16}
            color={isOverdue ? colors.danger : colors.primary}
          />
          <Text
            style={[
              styles.deliveryDate,
              isOverdue && styles.overdueText,
            ]}
          >
            {formatDate(po.deliveryDate)} {isOverdue ? `(${Math.abs(daysLeft)} days overdue)` : `(${daysLeft} days left)`}
          </Text>
        </View>

        {po.notes && (
          <View style={styles.notesSection}>
            <Icon
              name="note-outline"
              size={16}
              color={colors.textSecondary}
            />
            <Text style={styles.notes}>{po.notes}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    marginHorizontal: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  poNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 12,
  },
  content: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoItem: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
    fontWeight: '500',
  },
  value: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text,
  },
  deliverySection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.lighter,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  deliveryDate: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },
  overdueText: {
    color: colors.danger,
    fontWeight: 'bold',
  },
  notesSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.background,
    padding: 10,
    borderRadius: 8,
  },
  notes: {
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});

export default POCard;
