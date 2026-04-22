import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../utils/colors';

const ProductionProgressBar = ({ percentage = 0, height = 10, showLabel = true }) => {
  const validPercentage = Math.min(Math.max(percentage, 0), 100);

  return (
    <View style={styles.container}>
      <View style={[styles.barContainer, { height }]}>
        <View
          style={[
            styles.bar,
            {
              width: `${validPercentage}%`,
              height,
              backgroundColor: getColorByPercentage(validPercentage),
            },
          ]}
        />
      </View>
      {showLabel && (
        <Text style={styles.label}>{Math.round(validPercentage)}%</Text>
      )}
    </View>
  );
};

const getColorByPercentage = (percentage) => {
  if (percentage < 25) return colors.danger;
  if (percentage < 50) return colors.warning;
  if (percentage < 75) return colors.info;
  return colors.success;
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  barContainer: {
    flex: 1,
    backgroundColor: colors.border,
    borderRadius: 5,
    overflow: 'hidden',
  },
  bar: {
    borderRadius: 5,
  },
  label: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.text,
    minWidth: 40,
    textAlign: 'right',
  },
});

export default ProductionProgressBar;
