import { reactive, watch } from 'vue';

export type Locale = 'ru' | 'en' | 'zh' | 'th';

export const LOCALES: { id: Locale; name: string }[] = [
  { id: 'ru', name: 'Русский' },
  { id: 'en', name: 'English' },
  { id: 'zh', name: '中文' },
  { id: 'th', name: 'ไทย' }
];

export const UI_SCALES = [.85, 1, 1.15] as const;

const SETTINGS_KEY = 'rainvale.settings.v1';

interface Settings {
  locale: Locale;
  master: number;
  ambience: number;
  music: number;
  sfx: number;
  uiScale: number;
  fog: boolean;
  hints: boolean;
}

function detectLocale (): Locale {
  const lang = (navigator.language || 'en').slice(0, 2);

  return LOCALES.some(l => l.id === lang) ? lang as Locale : 'en';
}

function defaults (): Settings {
  return { locale: detectLocale(), master: .8, ambience: .8, music: .6, sfx: .8, uiScale: 1, fog: true, hints: true };
}

function load (): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const data: unknown = raw ? JSON.parse(raw) : null;

    return data && typeof data === 'object' ? { ...defaults(), ...data as Partial<Settings> } : defaults();
  } catch (error) {
    console.warn('Could not read settings', error);

    return defaults();
  }
}

export const settings = reactive<Settings>(load());

watch(settings, value => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(value));
  } catch (error) {
    console.warn('Could not save settings', error);
  }

  document.documentElement.lang = value.locale;
}, { deep: true, immediate: true });
