// oxlint-disable react/only-export-components
import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';
import vi from './locales/vi.json';
import viUi from './locales/vi-ui.json';
import viWeb from './locales/vi-web.json';

export type Language = 'en' | 'vi';
type I18nValue = { language: Language; setLanguage: (language: Language) => void; toggleLanguage: () => void; t: (text: string) => string };
const I18nContext = createContext<I18nValue | null>(null);
const vietnamese = { ...vi, ...viUi, ...viWeb } as Record<string, string>;

function translateVietnamese(text: string) {
  if (vietnamese[text]) return vietnamese[text];
  return Object.entries(vietnamese)
    .sort(([a], [b]) => b.length - a.length)
    .reduce((result, [source, translated]) => result.replaceAll(source, translated), text);
}

export function I18nProvider({ children }: PropsWithChildren) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = window.localStorage.getItem('raceos-language');
    return saved === 'vi' || saved === 'en' ? saved : 'en';
  });
  const value = useMemo<I18nValue>(() => ({
    language,
    setLanguage: (next) => { setLanguageState(next); window.localStorage.setItem('raceos-language', next); },
    toggleLanguage: () => { const next = language === 'en' ? 'vi' : 'en'; setLanguageState(next); window.localStorage.setItem('raceos-language', next); },
    t: (text) => language === 'vi' ? translateVietnamese(text) : text,
  }), [language]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside I18nProvider');
  return value;
}
