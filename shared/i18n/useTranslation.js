import { useContext } from 'react';
import { I18nContext } from './i18nProvider';

/**
 * useTranslation Hook
 *
 * Returns an object containing:
 * - t: Translation function
 * - setLanguage: Function to change language
 * - currentLanguage: Currently selected language code
 * - languages: Array of all supported languages with metadata
 *
 * Usage:
 * const { t, setLanguage, currentLanguage, languages } = useTranslation();
 *
 * Translate: <h1>{t('dashboard.welcome')}</h1>
 * Change language: setLanguage('es')
 */
export const useTranslation = () => {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }

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

  return {
    t: context.t,
    setLanguage: context.setLanguage,
    currentLanguage: context.currentLanguage,
    isLoading: context.isLoading,
    languages,
    supportedLanguages: context.supportedLanguages
  };
};

export default useTranslation;
