import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../utils/colors';

const DocumentSlot = ({
  label,
  icon = 'file',
  status = 'empty', // empty, uploading, uploaded
  fileName,
  onUpload,
  onRemove,
  onView,
}) => {
  const isUploaded = status === 'uploaded';
  const isUploading = status === 'uploading';

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={[
          styles.slot,
          isUploaded && styles.slotUploaded,
          isUploading && styles.slotUploading,
        ]}
        onPress={isUploaded ? onView : onUpload}
        disabled={isUploading}
        activeOpacity={0.7}
      >
        {isUploading ? (
          <View style={styles.uploadingContent}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.uploadingText}>Uploading...</Text>
          </View>
        ) : isUploaded ? (
          <View style={styles.uploadedContent}>
            <Icon
              name={icon}
              size={32}
              color={colors.success}
            />
            <Text style={styles.uploadedLabel}>Uploaded</Text>
            <Text style={styles.fileName} numberOfLines={2}>{fileName}</Text>
          </View>
        ) : (
          <View style={styles.emptyContent}>
            <Icon
              name={icon}
              size={40}
              color={colors.textSecondary}
            />
            <Text style={styles.emptyText}>Tap to upload</Text>
          </View>
        )}
      </TouchableOpacity>

      {isUploaded && onRemove && (
        <TouchableOpacity
          style={styles.removeButton}
          onPress={onRemove}
        >
          <Icon
            name="close"
            size={16}
            color={colors.danger}
          />
          <Text style={styles.removeText}>Remove</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  slot: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 32,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    minHeight: 140,
  },
  slotUploaded: {
    borderStyle: 'solid',
    borderColor: colors.success,
    backgroundColor: '#F0FDF4',
  },
  slotUploading: {
    borderColor: colors.primary,
    backgroundColor: colors.lighter,
  },
  emptyContent: {
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  uploadingContent: {
    alignItems: 'center',
    gap: 12,
  },
  uploadingText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },
  uploadedContent: {
    alignItems: 'center',
    gap: 8,
  },
  uploadedLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.success,
  },
  fileName: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    marginTop: 8,
  },
  removeText: {
    fontSize: 12,
    color: colors.danger,
    fontWeight: '500',
  },
});

export default DocumentSlot;
