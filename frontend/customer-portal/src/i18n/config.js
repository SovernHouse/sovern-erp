import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import enCommon from '../../../shared/src/i18n/locales/en/common.json'
import enCustomer from './locales/en/customer.json'
import zhCommon from '../../../shared/src/i18n/locales/zh/common.json'
import zhCustomer from './locales/zh/customer.json'
import esCommon from '../../../shared/src/i18n/locales/es/common.json'
import esCustomer from './locales/es/customer.json'
import arCommon from '../../../shared/src/i18n/locales/ar/common.json'
import arCustomer from './locales/ar/customer.json'

const resources = {
  en: {
    common: enCommon,
    customer: enCustomer,
  },
  zh: {
    common: zhCommon,
    customer: zhCustomer,
  },
  es: {
    common: esCommon,
    customer: esCustomer,
  },
  ar: {
    common: arCommon,
    customer: arCustomer,
  },
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    defaultNS: 'customer',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },
  })

export default i18n
