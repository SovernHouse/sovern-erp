import React, { createContext, useState, useEffect, useCallback } from 'react';
import en from './en.json';
import zh from './zh.json';
import es from './es.json';
import fr from './fr.json';
import de from './de.json';
import pt from './pt.json';

// Create the context
export const I18nContext = createContext();

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

/**
 * I18nProvider - Provides internationalization context to the entire app
 * Features:
 * - Auto-detects browser language on first visit
 * - Persists language preference in localStorage
 * - Provides translation function with dot notation support
 * - Falls back to English for missing keys
 * - Supports all 6 languages: English, Mandarin, Spanish, French, German, Portuguese
 */
export const I18nProvider = ({ children }) => {
  const [currentLanguage, setCurrentLanguageState] = useState('en');
  const [isLoading, setIsLoading] = useState(true);

  // Initialize language on first load
  useEffect(() => {
    // Check localStorage first
    const savedLanguage = localStorage.getItem('i18n_language');
    if (savedLanguage && supportedLanguages.includes(savedLanguage)) {
      setCurrentLanguageState(savedLanguage);
      setIsLoading(false);
      return;
    }

    // Auto-detect browser language
    const browserLanguage = navigator.language || navigator.userLanguage;
    const browserLanguageCode = browserLanguage.split('-')[0];

    if (supportedLanguages.includes(browserLanguageCode)) {
      setCurrentLanguageState(browserLanguageCode);
      localStorage.setItem('i18n_language', browserLanguageCode);
    } else {
      // Default to English
      setCurrentLanguageState('en');
      localStorage.setItem('i18n_language', 'en');
    }

    setIsLoading(false);
  }, []);

  /**
   * Set language and persist to localStorage
   */
  const setLanguage = useCallback((language) => {
    if (supportedLanguages.includes(language)) {
      setCurrentLanguageState(language);
      localStorage.setItem('i18n_language', language);
    } else {
      console.warn(`Language "${language}" is not supported. Using English.`);
      setCurrentLanguageState('en');
      localStorage.setItem('i18n_language', 'en');
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
    supportedLanguages
  };

  return (
    <I18nContext.Provider value={value}>
      {!isLoading && children}
    </I18nContext.Provider>
  );
};

export default I18nProvider;
