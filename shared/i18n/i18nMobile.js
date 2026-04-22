import React, { createContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AccessibilityInfo } from 'react-native';
import en from './en.json';
import zh from './zh.json';
import es from './es.json';
import fr from './fr.json';
import de from './de.json';
import pt from './pt.json';

// Create the context
export const I18nMobileContext = createContext();

// Translation files map
const translations = {
  en: en,
  zh: zh,
  es: es,
  fr: fr,
  de: de,
  pt: pt
};

// Supported languages
const supportedLanguages = ['en', 'zh', 'es', 'fr', 'de', 'pt'];

// Language metadata
const languages = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇬🇧'
  },
  {
    code: 'zh',
    name: 'Mandarin Chinese',
    nativeName: '中文',
    flag: '🇨🇳'
  },
  {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    flag: '🇪🇸'
  },
  {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    flag: '🇫🇷'
  },
  {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    flag: '🇩🇪'
  },
  {
    code: 'pt',
    name: 'Portuguese (Brazilian)',
    nativeName: 'Português',
    flag: '🇧🇷'
  }
];

/**
 * I18nMobileProvider - React Native internationalization provider
 * Uses AsyncStorage for language persistence instead of localStorage
 *
 * Features:
 * - Persists language preference in AsyncStorage
 * - Provides translation function with dot notation support
 * - Falls back to English for missing keys
 * - Supports all 6 languages
 * - Mobile-optimized with async storage
 *
 * Usage:
 * <I18nMobileProvider>
 *   <YourApp />
 * </I18nMobileProvider>
 */
export const I18nMobileProvider = ({ children }) => {
  const [currentLanguage, setCurrentLanguageState] = useState('en');
  const [isLoading, setIsLoading] = useState(true);

  // Initialize language on first load
  useEffect(() => {
    const initializeLanguage = async () => {
      try {
        // Check AsyncStorage first
        const savedLanguage = await AsyncStorage.getItem('i18n_language');
        if (savedLanguage && supportedLanguages.includes(savedLanguage)) {
          setCurrentLanguageState(savedLanguage);
          setIsLoading(false);
          return;
        }

        // Default to English
        setCurrentLanguageState('en');
        await AsyncStorage.setItem('i18n_language', 'en');
        setIsLoading(false);
      } catch (error) {
        console.warn('Failed to initialize language:', error);
        setCurrentLanguageState('en');
        setIsLoading(false);
      }
    };

    initializeLanguage();
  }, []);

  /**
   * Set language and persist to AsyncStorage
   */
  const setLanguage = useCallback(async (language) => {
    if (supportedLanguages.includes(language)) {
      setCurrentLanguageState(language);
      try {
        await AsyncStorage.setItem('i18n_language', language);
        // Update accessibility language
        if (AccessibilityInfo.setAccessibilityFocus) {
          AccessibilityInfo.announceForAccessibility(`Language changed to ${language}`);
        }
      } catch (error) {
        console.warn('Failed to save language preference:', error);
      }
    } else {
      console.warn(`Language "${language}" is not supported. Using English.`);
      setCurrentLanguageState('en');
      try {
        await AsyncStorage.setItem('i18n_language', 'en');
      } catch (error) {
        console.warn('Failed to save language preference:', error);
      }
    }
  }, []);

  /**
   * Get translation by key with dot notation support
   * Example: t('common.save') or t('dashboard.welcome')
   * Falls back to English if key not found in current language
   */
  const t = useCallback((key, replacements = {}) => {
    const keys = key.split('.');
    let translation = translations[currentLanguage];
    let fallbackTranslation = translations['en'];

    // Navigate through nested keys
    for (const k of keys) {
      if (translation && typeof translation === 'object') {
        translation = translation[k];
      } else {
        translation = undefined;
        break;
      }
    }

    // Fallback to English if not found
    if (!translation) {
      for (const k of keys) {
        if (fallbackTranslation && typeof fallbackTranslation === 'object') {
          fallbackTranslation = fallbackTranslation[k];
        } else {
          fallbackTranslation = undefined;
          break;
        }
      }
      translation = fallbackTranslation || key;
    }

    // Handle string replacements
    if (typeof translation === 'string' && Object.keys(replacements).length > 0) {
      let result = translation;
      for (const [placeholder, value] of Object.entries(replacements)) {
        result = result.replace(new RegExp(`\\{${placeholder}\\}`, 'g'), value);
      }
      return result;
    }

    return translation || key;
  }, [currentLanguage]);

  const value = {
    t,
    setLanguage,
    currentLanguage,
    isLoading,
    languages,
    supportedLanguages
  };

  return (
    <I18nMobileContext.Provider value={value}>
      {children}
    </I18nMobileContext.Provider>
  );
};

/**
 * useTranslation Hook for React Native
 * Returns translation functions and language management tools
 */
export const useTranslationMobile = () => {
  const context = React.useContext(I18nMobileContext);

  if (!context) {
    throw new Error('useTranslationMobile must be used within an I18nMobileProvider');
  }

  return {
    t: context.t,
    setLanguage: context.setLanguage,
    currentLanguage: context.currentLanguage,
    isLoading: context.isLoading,
    languages: context.languages,
    supportedLanguages: context.supportedLanguages
  };
};

// Export language list
export { languages };

export default {
  I18nMobileProvider,
  useTranslationMobile,
  languages
};
