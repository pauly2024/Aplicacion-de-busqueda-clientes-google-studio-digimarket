import { AppSettings, BusinessLead, SearchCacheItem } from '@/types';

export const DEFAULT_SETTINGS: AppSettings = {
  googleMapsApiKey: '',
  nvidiaApiKey: '',
  openRouterApiKey: '',
  placesCallsThisMonth: 0,
  placesQuotaLimit: 800,
  defaultRegion: 'DO',
  sellerProfile: {
    name: 'Asesor DigiMarket',
    companyName: 'DigiMarket RD',
    phone: '',
    website: 'https://digimarketrd.2bd.net',
    valueProposition:
      'Ayudamos a negocios locales de Puerto Plata, Sosúa, Cabarete y Santiago a multiplicar sus clientes con páginas web modernas y agentes de IA por WhatsApp que responden en segundos.',
    servicesOffered: [
      'Páginas Web Modernas y Rápidas',
      'Agente de IA para WhatsApp 24/7',
      'Sistema de Citas y Reservas Online',
      'Posicionamiento y Optimización Local',
    ],
    tone: 'consultivo',
  },
};

const LEADS_KEY = 'digimarket_radar_leads';
const SETTINGS_KEY = 'digimarket_radar_settings';
const CACHE_KEY = 'digimarket_radar_cache';

export const Storage = {
  getLeads(): BusinessLead[] {
    if (typeof window === 'undefined') return [];
    try {
      const data = localStorage.getItem(LEADS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error al leer leads de storage:', e);
      return [];
    }
  },

  saveLeads(leads: BusinessLead[]) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(LEADS_KEY, JSON.stringify(leads));
    } catch (e) {
      console.error('Error al guardar leads:', e);
    }
  },

  addOrUpdateLead(lead: BusinessLead): BusinessLead[] {
    const leads = this.getLeads();
    const index = leads.findIndex((l) => l.id === lead.id);
    if (index >= 0) {
      leads[index] = { ...leads[index], ...lead, updatedAt: new Date().toISOString() };
    } else {
      leads.unshift({ ...lead, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    this.saveLeads(leads);
    return leads;
  },

  removeLead(id: string): BusinessLead[] {
    const leads = this.getLeads().filter((l) => l.id !== id);
    this.saveLeads(leads);
    return leads;
  },

  getSettings(): AppSettings {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;
    try {
      const data = localStorage.getItem(SETTINGS_KEY);
      if (!data) return DEFAULT_SETTINGS;
      const parsed = JSON.parse(data);
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        sellerProfile: {
          ...DEFAULT_SETTINGS.sellerProfile,
          ...(parsed.sellerProfile || {}),
        },
      };
    } catch (e) {
      console.error('Error al leer settings:', e);
      return DEFAULT_SETTINGS;
    }
  },

  saveSettings(settings: AppSettings) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('Error al guardar settings:', e);
    }
  },

  incrementPlacesCalls(count: number = 1): number {
    const settings = this.getSettings();
    const newCount = (settings.placesCallsThisMonth || 0) + count;
    settings.placesCallsThisMonth = newCount;
    this.saveSettings(settings);
    return newCount;
  },

  // Caché de búsquedas
  getCache(key: string): SearchCacheItem | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(`${CACHE_KEY}_${key}`);
      if (!raw) return null;
      const item: SearchCacheItem = JSON.parse(raw);
      // Expira en 7 días
      if (Date.now() - item.timestamp > 7 * 24 * 60 * 60 * 1000) {
        localStorage.removeItem(`${CACHE_KEY}_${key}`);
        return null;
      }
      return item;
    } catch (e) {
      return null;
    }
  },

  setCache(key: string, item: SearchCacheItem) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(`${CACHE_KEY}_${key}`, JSON.stringify(item));
    } catch (e) {
      console.warn('Caché storage lleno:', e);
    }
  },

  clearAllCache() {
    if (typeof window === 'undefined') return;
    try {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith(CACHE_KEY)) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {}
  },
};
