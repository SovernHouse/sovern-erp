import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import enCommon from '../../../shared/src/i18n/locales/en/common.json'
import enAdmin from './locales/en/admin.json'
import zhCommon from '../../../shared/src/i18n/locales/zh/common.json'
import zhAdmin from './locales/zh/admin.json'
import esCommon from '../../../shared/src/i18n/locales/es/common.json'
import esAdmin from './locales/es/admin.json'
import arCommon from '../../../shared/src/i18n/locales/ar/common.json'
import arAdmin from './locales/ar/admin.json'

const resources = {
  en: {
    common: enCommon,
    admin: enAdmin,
  },
  zh: {
    common: zhCommon,
    admin: zhAdmin,
  },
  es: {
    common: esCommon,
    admin: esAdmin,
  },
  ar: {
    common: arCommon,
    admin: arAdmin,
  },
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    defaultNS: 'admin',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },
  })

export default i18n
