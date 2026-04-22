import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors } from '../utils/colors';

const { width } = Dimensions.get('window');

const ShipmentRouteAnimation = ({ origin, destination, currentLocation, progress }) => {
  const shipXPos = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate ship position based on progress (0-100)
    const targetPosition = (progress / 100) * (width - 100);
    Animated.timing(shipXPos, {
      toValue: targetPosition,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [progress, shipXPos]);

  useEffect(() => {
    // Pulse animation for current location
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

  return (
    <View style={styles.container}>
      <Text style={styles.routeTitle}>Shipment Route</Text>

      <View style={styles.routeContainer}>
        {/* Origin */}
        <View style={styles.endpoint}>
          <Icon name="location" size={20} color={colors.primary} />
          <Text style={styles.endpointLabel}>{origin}</Text>
        </View>

        {/* Route line */}
        <View style={styles.routeLine}>
          {/* Dotted line effect */}
          <View style={styles.dotLine}>
            {Array.from({ length: 20 }).map((_, i) => (
              <View
                key={`dot-${i}`}
                style={[
                  styles.dot,
                  i < Math.floor((progress / 100) * 20)
                    ? { backgroundColor: colors.primary }
                    : { backgroundColor: colors.gray300 },
                ]}
              />
            ))}
          </View>

          {/* Moving ship */}
          <Animated.View
            style={[
              styles.shipContainer,
              {
                left: shipXPos,
              },
            ]}
          >
            <Animated.View
              style={[
                styles.shipPulse,
                {
                  opacity: pulseAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 0.3],
                  }),
                  transform: [
                    {
                      scale: pulseAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.3],
                      }),
                    },
                  ],
                },
              ]}
            />
            <Icon name="ship" size={28} color={colors.primary} />
          </Animated.View>
        </View>

        {/* Destination */}
        <View style={styles.endpoint}>
          <Icon name="flag" size={20} color={colors.accent} />
          <Text style={styles.endpointLabel}>{destination}</Text>
        </View>
      </View>

      {/* Current location */}
      {currentLocation && (
        <View style={styles.currentLocation}>
          <View style={styles.currentDot} />
          <View style={styles.locationInfo}>
            <Text style={styles.locationLabel}>Current Location</Text>
            <Text style={styles.locationName}>{currentLocation}</Text>
          </View>
        </View>
      )}

      {/* Progress indicator */}
      <View style={styles.progressContainer}>
        <Text style={styles.progressLabel}>{progress}% Complete</Text>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${progress}%`,
              },
            ]}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  routeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray900,
    marginBottom: 16,
  },
  routeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  endpoint: {
    alignItems: 'center',
    width: 60,
  },
  endpointLabel: {
    fontSize: 10,
    color: colors.gray600,
    marginTop: 4,
    textAlign: 'center',
  },
  routeLine: {
    flex: 1,
    height: 50,
    position: 'relative',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  dotLine: {
    flexDirection: 'row',
    height: 2,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  shipContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    width: 50,
    height: 50,
  },
  shipPulse: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
  },
  currentLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.white,
    borderRadius: 8,
    marginBottom: 16,
  },
  currentDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
    marginRight: 12,
  },
  locationInfo: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 12,
    color: colors.gray600,
  },
  locationName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray900,
    marginTop: 2,
  },
  progressContainer: {
    marginTop: 8,
  },
  progressLabel: {
    fontSize: 12,
    color: colors.gray600,
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.white,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
});

export default ShipmentRouteAnimation;
