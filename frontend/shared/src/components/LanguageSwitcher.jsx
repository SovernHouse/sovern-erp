import React from 'react'
import { useTranslation } from 'react-i18next'
import { Globe } from 'lucide-react'

const LanguageSwitcher = ({ className = '' }) => {
  const { i18n } = useTranslation()

  const languages = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'zh', name: '中文', flag: '🇨🇳' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  ]

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng)
    // Set document direction for RTL languages
    if (lng === 'ar') {
      document.documentElement.setAttribute('dir', 'rtl')
      document.documentElement.lang = 'ar'
    } else {
      document.documentElement.setAttribute('dir', 'ltr')
      document.documentElement.lang = lng
    }
  }

  const currentLang = languages.find((l) => l.code === i18n.language)

  return (
    <div className={`relative inline-block group ${className}`}>
      <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
        <Globe size={18} />
        <span>{currentLang?.name || 'Language'}</span>
        <svg
          className="w-4 h-4 ml-1 transition-transform group-hover:rotate-180"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </button>

      <div className="absolute right-0 top-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 min-w-max">
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => changeLanguage(lang.code)}
            className={`w-full text-left px-4 py-2 text-sm transition-colors ${
              i18n.language === lang.code
                ? 'bg-blue-50 dark:bg-blue-900 text-blue-900 dark:text-blue-100 font-medium'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <span className="mr-2">{lang.flag}</span>
            {lang.name}
          </button>
        ))}
      </div>
    </div>
  )
}

export default LanguageSwitcher
