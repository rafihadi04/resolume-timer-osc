import i18n from 'i18next';
import en from './locales/en.json';
import id from './locales/id.json';

let initialLanguage = 'en';
try {
  const saved = window.localStorage.getItem('rt.language');
  if (saved) {
    const parsed = JSON.parse(saved);
    if (parsed === 'id') initialLanguage = 'id';
  }
} catch (_error) {
  initialLanguage = 'en';
}

i18n.init({
  resources: {
    en: { translation: en },
    id: { translation: id }
  },
  lng: initialLanguage,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  initImmediate: false
});

export default i18n;
