import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import de from './locales/de.json';
import en from './locales/en.json';

export const LANGUAGES = {
  de: 'Deutsch',
  en: 'English',
} as const;

export type LanguageCode = keyof typeof LANGUAGES;

const resources = {
  de: { translation: de },
  en: { translation: en },
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'de', // Default-Sprache
  fallbackLng: 'de',
  interpolation: {
    escapeValue: false, // React übernimmt XSS-Schutz
  },
  compatibilityJSON: 'v4',
});

export default i18n;
