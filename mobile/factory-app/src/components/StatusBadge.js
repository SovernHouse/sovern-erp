import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../utils/colors';
import { COLORS_STATUS, LABEL_STATUS } from '../utils/constants';

const StatusBadge = ({ status, label, size = 'small', icon = true }) => {
  const statusColor = COLORS_STATUS[status] || colors.textMuted;
  const statusLabel = label || LABEL_STATUS[status];

  const sizeStyles = size === 'small' ? styles.small : styles.large;

  const getIcon = () => {
    switch (status) {
      case 'draft':
        return 'pencil';
      case 'confirmed':
        return 'check-circle-outline';
      case 'in_production':
        return 'factory';
      case 'ready_to_ship':
        return 'package-variant';
      case 'shipped':
        return 'truck-fast';
      case 'delivered':
        return 'check-all';
      case 'completed':
        return 'check-all';
      case 'cancelled':
      case 'rejected':
        return 'close-circle';
      default:
        return 'circle-outline';
    }
  };

  return (
    <View
      style={[
        styles.badge,
        sizeStyles,
        { backgroundColor: statusColor + '20', borderColor: statusColor },
      ]}
    >
      {icon && <Icon name={getIcon()} size={size === 'small' ? 12 : 16} color={statusColor} />}
      <Text style={[styles.text, sizeStyles, { color: statusColor }]}>
        {statusLabel}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 6,
  },
  small: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  large: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  text: {
    fontWeight: '600',
  },
  small_text: {
    fontSize: 11,
  },
  large_text: {
    fontSize: 13,
  },
});

export default StatusBadge;
