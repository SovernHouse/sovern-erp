import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from './useTranslation';

/**
 * LanguageSelector Component
 *
 * A dropdown component that allows users to select their preferred language.
 * Displays current language with flag and name.
 * Shows all 6 supported languages in a dropdown menu.
 *
 * Features:
 * - Displays current language with flag emoji
 * - Dropdown with all 6 languages
 * - Click outside to close dropdown
 * - Styled with Tailwind CSS
 * - Compatible with all 3 web portals
 *
 * Usage:
 * <LanguageSelector />
 */
export const LanguageSelector = () => {
  const { setLanguage, currentLanguage, languages } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Get current language object
  const current = languages.find(lang => lang.code === currentLanguage);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleLanguageChange = (languageCode) => {
    setLanguage(languageCode);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Language Selector Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-colors bg-white text-gray-700"
        aria-label="Select language"
        aria-expanded={isOpen}
      >
        {/* Flag and Language Name */}
        <span className="text-xl">{current?.flag}</span>
        <span className="text-sm font-medium hidden sm:inline">
          {current?.nativeName}
        </span>
        {/* Chevron Icon */}
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 14l-7 7m0 0l-7-7m7 7V3"
          />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-300 rounded-lg shadow-lg z-50">
          <div className="py-1">
            {languages.map((language) => (
              <button
                key={language.code}
                onClick={() => handleLanguageChange(language.code)}
                className={`w-full text-left px-4 py-2 flex items-center gap-3 transition-colors ${
                  currentLanguage === language.code
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                aria-label={`Switch to ${language.name}`}
              >
                {/* Flag */}
                <span className="text-xl">{language.flag}</span>

                {/* Language Name */}
                <div className="flex-1">
                  <div className="text-sm font-medium">{language.nativeName}</div>
                  <div className="text-xs text-gray-500">{language.name}</div>
                </div>

                {/* Selected Indicator */}
                {currentLanguage === language.code && (
                  <svg
                    className="w-5 h-5 text-blue-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;
