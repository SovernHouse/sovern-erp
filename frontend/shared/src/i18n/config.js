import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import enCommon from './locales/en/common.json'
import zhCommon from './locales/zh/common.json'
import esCommon from './locales/es/common.json'
import arCommon from './locales/ar/common.json'

const resources = {
  en: {
    common: enCommon,
  },
  zh: {
    common: zhCommon,
  },
  es: {
    common: esCommon,
  },
  ar: {
    common: arCommon,
  },
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },
  })

export default i18n
