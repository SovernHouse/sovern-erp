import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  AccessibilityInfo
} from 'react-native';
import { useTranslationMobile } from './i18nMobile';

/**
 * LanguageSelectorMobile Component
 *
 * A React Native language selector component that displays a modal with all supported languages.
 * Allows users to select their preferred language for the mobile app.
 *
 * Features:
 * - Modal popup with all 6 languages
 * - Current language highlighted
 * - Language flags and names in both native and English
 * - Accessibility support
 * - Easy to integrate into navigation headers
 *
 * Usage:
 * <LanguageSelectorMobile visible={isVisible} onClose={() => setIsVisible(false)} />
 */
export const LanguageSelectorMobile = ({ visible = false, onClose = () => {} }) => {
  const { setLanguage, currentLanguage, languages, t } = useTranslationMobile();
  const [selectedLanguage, setSelectedLanguage] = useState(currentLanguage);

  const handleLanguageSelect = async (languageCode) => {
    setSelectedLanguage(languageCode);
    await setLanguage(languageCode);
    onClose();
  };

  const renderLanguageItem = ({ item }) => {
    const isSelected = selectedLanguage === item.code;

    return (
      <TouchableOpacity
        style={[
          styles.languageItem,
          isSelected && styles.languageItemSelected
        ]}
        onPress={() => handleLanguageSelect(item.code)}
        accessible={true}
        accessibilityLabel={`${item.nativeName} - ${item.name}`}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
      >
        {/* Language Flag */}
        <Text style={styles.flagEmoji}>{item.flag}</Text>

        {/* Language Names */}
        <View style={styles.languageNameContainer}>
          <Text
            style={[
              styles.languageNativeName,
              isSelected && styles.languageNameSelected
            ]}
          >
            {item.nativeName}
          </Text>
          <Text
            style={[
              styles.languageEnglishName,
              isSelected && styles.languageNameSelected
            ]}
          >
            {item.name}
          </Text>
        </View>

        {/* Selected Indicator */}
        {isSelected && (
          <View style={styles.selectedIndicator}>
            <Text style={styles.checkmark}>✓</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
      accessible={true}
      accessibilityViewIsModal={true}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {t('language.selectLanguage')}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            accessible={true}
            accessibilityLabel="Close language selector"
            accessibilityRole="button"
          >
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Language List */}
        <FlatList
          data={languages}
          renderItem={renderLanguageItem}
          keyExtractor={(item) => item.code}
          scrollEnabled={true}
          contentContainerStyle={styles.languageList}
        />

        {/* Confirm Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={onClose}
            accessible={true}
            accessibilityLabel="Confirm language selection"
            accessibilityRole="button"
          >
            <Text style={styles.confirmButtonText}>
              {t('common.confirm')}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

/**
 * LanguageSelectorButton Component
 * A simple button that can be placed in navigation header to open language selector
 *
 * Usage:
 * const [showLanguageSelector, setShowLanguageSelector] = useState(false);
 * <LanguageSelectorButton onPress={() => setShowLanguageSelector(true)} />
 */
export const LanguageSelectorButton = ({ onPress = () => {} }) => {
  const { currentLanguage, languages } = useTranslationMobile();
  const currentLang = languages.find(l => l.code === currentLanguage);

  return (
    <TouchableOpacity
      style={styles.headerButton}
      onPress={onPress}
      accessible={true}
      accessibilityLabel={`Current language: ${currentLang?.nativeName}. Tap to change language.`}
      accessibilityRole="button"
    >
      <Text style={styles.headerButtonFlag}>{currentLang?.flag}</Text>
      <Text style={styles.headerButtonText}>{currentLang?.nativeName}</Text>
    </TouchableOpacity>
  );
};

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb'
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937'
  },
  closeButton: {
    fontSize: 24,
    color: '#6b7280',
    padding: 8
  },
  languageList: {
    paddingVertical: 8
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginVertical: 4,
    marginHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  languageItemSelected: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6'
  },
  flagEmoji: {
    fontSize: 28,
    marginRight: 12
  },
  languageNameContainer: {
    flex: 1
  },
  languageNativeName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 4
  },
  languageEnglishName: {
    fontSize: 12,
    color: '#6b7280'
  },
  languageNameSelected: {
    color: '#1e40af'
  },
  selectedIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center'
  },
  checkmark: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold'
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb'
  },
  confirmButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center'
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  // Header button styles
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db'
  },
  headerButtonFlag: {
    fontSize: 18,
    marginRight: 6
  },
  headerButtonText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500'
  }
});

export default {
  LanguageSelectorMobile,
  LanguageSelectorButton
};
