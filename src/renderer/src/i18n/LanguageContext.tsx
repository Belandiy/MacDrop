import React, { createContext, useContext, useMemo, useCallback } from 'react';
import { ru, LocaleSchema } from './locales/ru';
import { en } from './locales/en';

export type SupportedLanguage = 'ru' | 'en';

export const SUPPORTED_LANGUAGES: { code: SupportedLanguage; label: string; flag: string }[] = [
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'en', label: 'English', flag: '🇬🇧' }
];

export const dictionaries: Record<SupportedLanguage, LocaleSchema> = {
  ru,
  en
};

export type TranslationParams = Record<string, string | number>;

export type TranslationFunction = (
  key: string,
  params?: TranslationParams,
  fallback?: string
) => string;

interface LanguageContextValue {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: TranslationFunction;
  availableLanguages: typeof SUPPORTED_LANGUAGES;
}

/**
 * Resolves a key (e.g. "nav.transfer" or flat shorthand "transfer") in dictionary
 */
export function resolveTranslation(
  lang: SupportedLanguage,
  key: string,
  params?: TranslationParams,
  fallback?: string
): string {
  const dict = dictionaries[lang] || dictionaries.ru;
  let result: any = undefined;

  // 1. Direct path lookup (e.g. "nav.transfer" or "dropzone.idleText")
  if (key.includes('.')) {
    const parts = key.split('.');
    let curr: any = dict;
    for (const part of parts) {
      if (curr && typeof curr === 'object' && part in curr) {
        curr = curr[part];
      } else {
        curr = undefined;
        break;
      }
    }
    if (typeof curr === 'string') {
      result = curr;
    }
  }

  // 2. Direct top-level lookup
  if (result === undefined && key in dict) {
    const val = (dict as any)[key];
    if (typeof val === 'string') {
      result = val;
    }
  }

  // 3. Flat shorthand search across sub-objects (e.g. "transfer" -> dict.nav.transfer)
  if (result === undefined) {
    for (const section of Object.values(dict)) {
      if (section && typeof section === 'object' && key in section) {
        const val = (section as any)[key];
        if (typeof val === 'string') {
          result = val;
          break;
        }
      }
    }
  }

  // 4. Fallback to 'ru' dictionary if missing in current language
  if (result === undefined && lang !== 'ru') {
    return resolveTranslation('ru', key, params, fallback);
  }

  // 5. Final fallback to explicit fallback or key
  const output = result !== undefined ? result : (fallback !== undefined ? fallback : key);

  // 6. Parameter interpolation ({count}, {version}, {name}, etc.)
  if (params && typeof output === 'string') {
    return output.replace(/\{(\w+)\}/g, (_, token) => {
      return token in params ? String(params[token]) : `{${token}}`;
    });
  }

  return output;
}

const defaultContextValue: LanguageContextValue = {
  language: 'ru',
  setLanguage: () => {},
  t: (key: string, params?: TranslationParams, fallback?: string) =>
    resolveTranslation('ru', key, params, fallback),
  availableLanguages: SUPPORTED_LANGUAGES
};

const LanguageContext = createContext<LanguageContextValue>(defaultContextValue);

export interface LanguageProviderProps {
  language?: SupportedLanguage;
  onLanguageChange?: (lang: SupportedLanguage) => void;
  children: React.ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({
  language = 'ru',
  onLanguageChange,
  children
}) => {
  const currentLang = dictionaries[language] ? language : 'ru';

  const t = useCallback<TranslationFunction>(
    (key: string, params?: TranslationParams, fallback?: string) => {
      return resolveTranslation(currentLang, key, params, fallback);
    },
    [currentLang]
  );

  const setLanguage = useCallback(
    (newLang: SupportedLanguage) => {
      onLanguageChange?.(newLang);
    },
    [onLanguageChange]
  );

  const contextValue = useMemo<LanguageContextValue>(
    () => ({
      language: currentLang,
      setLanguage,
      t,
      availableLanguages: SUPPORTED_LANGUAGES
    }),
    [currentLang, setLanguage, t]
  );

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useTranslation() {
  return useContext(LanguageContext);
}
