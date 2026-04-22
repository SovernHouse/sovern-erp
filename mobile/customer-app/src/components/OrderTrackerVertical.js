import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors } from '../utils/colors';
import { ORDER_TRACKER_STAGES } from '../utils/constants';
import { formatDate } from '../utils/formatters';

const OrderTrackerVertical = ({ currentStage, stages, estimates }) => {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  const getStageColor = (stageKey) => {
    const stageIndex = ORDER_TRACKER_STAGES.findIndex((s) => s.key === stageKey);
    const currentIndex = ORDER_TRACKER_STAGES.findIndex((s) => s.key === currentStage);

    if (stageIndex <= currentIndex) {
      return colors.success;
    }
    return colors.gray300;
  };

  const getStageStatus = (stageKey) => {
    const stageIndex = ORDER_TRACKER_STAGES.findIndex((s) => s.key === stageKey);
    const currentIndex = ORDER_TRACKER_STAGES.findIndex((s) => s.key === currentStage);

    if (stageIndex < currentIndex) return 'completed';
    if (stageIndex === currentIndex) return 'current';
    return 'pending';
  };

  return (
    <View style={styles.container}>
      {ORDER_TRACKER_STAGES.map((stage, index) => {
        const status = getStageStatus(stage.key);
        const color = getStageColor(stage.key);
        const stageData = stages?.[stage.key];

        return (
          <View key={stage.key}>
            <View style={styles.stageRow}>
              <View style={styles.dotContainer}>
                {status === 'current' ? (
                  <Animated.View
                    style={[
                      styles.currentDot,
                      {
                        opacity: pulseAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 0.5],
                        }),
                      },
                    ]}
                  >
                    <View style={[styles.dotInner, { backgroundColor: color }]} />
                  </Animated.View>
                ) : (
                  <View
                    style={[
                      styles.dot,
                      {
                        backgroundColor: color,
                        borderColor: status === 'completed' ? color : colors.gray300,
                      },
                    ]}
                  >
                    {status === 'completed' && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </View>
                )}
              </View>

              <View style={styles.content}>
                <Text
                  style={[
                    styles.label,
                    {
                      color: status === 'pending' ? colors.gray400 : colors.gray900,
                      fontWeight: status === 'current' ? '600' : '500',
                    },
                  ]}
                >
                  {stage.label}
                </Text>

                {stageData?.date && (
                  <Text style={styles.date}>
                    {formatDate(stageData.date, 'MMM DD, YYYY')}
                  </Text>
                )}

                {status === 'pending' && estimates?.[stage.key] && (
                  <Text style={styles.estimate}>
                    Est: {formatDate(estimates[stage.key], 'MMM DD')}
                  </Text>
                )}

                {stageData?.notes && (
                  <Text style={styles.notes}>{stageData.notes}</Text>
                )}
              </View>
            </View>

            {index < ORDER_TRACKER_STAGES.length - 1 && (
              <View
                style={[
                  styles.connector,
                  {
                    backgroundColor:
                      getStageStatus(ORDER_TRACKER_STAGES[index + 1].key) === 'pending'
                        ? colors.gray200
                        : color,
                  },
                ]}
              />
            )}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
  },
  stageRow: {
    flexDirection: 'row',
    marginBottom: 0,
  },
  dotContainer: {
    width: 60,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 2,
  },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.success,
  },
  dotInner: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  checkmark: {
    color: colors.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  connector: {
    marginLeft: 29,
    width: 3,
    height: 32,
  },
  content: {
    flex: 1,
    marginLeft: 16,
    paddingVertical: 8,
  },
  label: {
    fontSize: 14,
    marginBottom: 2,
  },
  date: {
    fontSize: 12,
    color: colors.gray500,
    marginBottom: 2,
  },
  estimate: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
  },
  notes: {
    fontSize: 12,
    color: colors.gray600,
    marginTop: 4,
    fontStyle: 'italic',
  },
});

export default OrderTrackerVertical;
