import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import enCommon from '../../../shared/src/i18n/locales/en/common.json'
import enFactory from './locales/en/factory.json'
import zhCommon from '../../../shared/src/i18n/locales/zh/common.json'
import zhFactory from './locales/zh/factory.json'
import esCommon from '../../../shared/src/i18n/locales/es/common.json'
import esFactory from './locales/es/factory.json'
import arCommon from '../../../shared/src/i18n/locales/ar/common.json'
import arFactory from './locales/ar/factory.json'

const resources = {
  en: {
    common: enCommon,
    factory: enFactory,
  },
  zh: {
    common: zhCommon,
    factory: zhFactory,
  },
  es: {
    common: esCommon,
    factory: esFactory,
  },
  ar: {
    common: arCommon,
    factory: arFactory,
  },
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    defaultNS: 'factory',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },
  })

export default i18n
