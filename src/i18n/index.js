import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import en from './locales/en';
import nl from './locales/nl';

export const LOCALES = { en, nl };

export const LANGUAGES = [
  { code: 'en', label: 'English', nativeLabel: 'English', flag: '🇬🇧' },
  { code: 'nl', label: 'Dutch', nativeLabel: 'Nederlands', flag: '🇳🇱' }
];

const STORAGE_KEY = 'ce.language';
const FALLBACK = 'en';

function detectLanguage() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && LOCALES[saved]) return saved;
  } catch (e) {
    // localStorage can be unavailable; fall through to system detection
  }
  const system = (window.navigator?.language || '').slice(0, 2).toLowerCase();
  return LOCALES[system] ? system : FALLBACK;
}

// Dotted lookup: 'sidebar.convert' -> locale.sidebar.convert
function lookup(dict, key) {
  return key.split('.').reduce((node, part) => (node == null ? undefined : node[part]), dict);
}

function interpolate(template, vars) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match
  );
}

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [language, setLanguageState] = useState(detectLanguage);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, language);
    } catch (e) {
      // Persisting the choice is a convenience, never a hard failure
    }
    document.documentElement.setAttribute('lang', language);
  }, [language]);

  const setLanguage = useCallback((code) => {
    if (LOCALES[code]) setLanguageState(code);
  }, []);

  // Missing keys fall back to English, then to the key itself, so an
  // untranslated string is never rendered as blank.
  const t = useCallback((key, vars) => {
    const value = lookup(LOCALES[language], key);
    if (typeof value === 'string') return interpolate(value, vars);
    const fallbackValue = lookup(LOCALES[FALLBACK], key);
    if (typeof fallbackValue === 'string') return interpolate(fallbackValue, vars);
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[i18n] missing key: ${key}`);
    }
    return key;
  }, [language]);

  const value = useMemo(() => ({ language, setLanguage, t, languages: LANGUAGES }), [language, setLanguage, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside an I18nProvider');
  return ctx;
}

export function useTranslation() {
  return useI18n().t;
}
