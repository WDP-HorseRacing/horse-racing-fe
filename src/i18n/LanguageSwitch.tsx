import { useI18n } from './I18nContext';

export function LanguageSwitch({ inverted = false }: { inverted?: boolean }) {
  const { language, toggleLanguage } = useI18n();
  return <button type="button" onClick={toggleLanguage} aria-label="Change language" className={`flex items-center rounded-xl border p-1 text-xs font-semibold shadow-sm ${inverted ? 'border-white/20 bg-black/20' : 'border-gray-200 bg-white'}`}>
    <span className={`rounded-lg px-3 py-1.5 ${language === 'en' ? 'bg-emerald-600 text-white' : inverted ? 'text-white/60' : 'text-gray-400'}`}>EN</span>
    <span className={`rounded-lg px-3 py-1.5 ${language === 'vi' ? 'bg-emerald-600 text-white' : inverted ? 'text-white/60' : 'text-gray-400'}`}>VI</span>
  </button>;
}
