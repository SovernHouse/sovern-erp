import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../utils/colors';

const StatusBadge = ({ status, label }) => {
  const getStatusColor = () => {
    const statusLower = status?.toLowerCase() || '';

    // Order statuses
    if (['pending', 'draft'].includes(statusLower)) return colors.warning;
    if (['confirmed', 'sent', 'viewed', 'production', 'quality_check'].includes(statusLower))
      return colors.info;
    if (['ready_to_ship', 'shipped', 'pickup'].includes(statusLower)) return colors.primary;
    if (['in_transit', 'port', 'customs'].includes(statusLower)) return colors.primary;
    if (['delivered', 'accepted'].includes(statusLower)) return colors.success;
    if (['cancelled', 'rejected', 'expired'].includes(statusLower)) return colors.error;
    if (['open', 'in_progress'].includes(statusLower)) return colors.warning;
    if (['resolved', 'closed'].includes(statusLower)) return colors.success;

    return colors.gray400;
  };

  const getStatusBackgroundColor = () => {
    const color = getStatusColor();
    const colorMap = {
      [colors.warning]: colors.warningLight,
      [colors.info]: colors.infoLight,
      [colors.primary]: colors.primaryLight,
      [colors.success]: colors.successLight,
      [colors.error]: colors.errorLight,
      [colors.gray400]: colors.gray100,
    };
    return colorMap[color] || colors.gray100;
  };

  const displayLabel = label || status?.charAt(0).toUpperCase() + status?.slice(1);

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: getStatusBackgroundColor(),
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: getStatusColor(),
          },
        ]}
      >
        {displayLabel}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default StatusBadge;
