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
      { name: 'Páginas Web Modernas y Rápidas', price: 35000 },
      { name: 'Agente de IA para WhatsApp 24/7', price: 25000 },
      { name: 'Sistema de Citas y Reservas Online', price: 15000 },
      { name: 'Posicionamiento y Optimización Local (SEO)', price: 20000 },
    ],
    tone: 'consultivo',
  },
  presentationPrompts: [
    {
      id: 'video-default',
      name: 'Video Presentación Negocio (HyperFrames)',
      description: 'Genera video 30-60s para Reels/TikTok con datos del negocio',
      type: 'video',
      template: `# PROMPT PARA VIDEO PRESENTACIÓN - COPIA Y PEGA EN COLAB/JUPYTER

## Contexto del Negocio
- **Nombre:** {{displayName}}
- **Categoría:** {{primaryTypeDisplayName}}
- **Ubicación:** {{formattedAddress}}
- **Teléfono:** {{nationalPhoneNumber}}
- **Rating:** {{rating}}★ ({{userRatingCount}} reseñas)
- **Web propia:** {{#if hasOwnWebsite}}Sí{{else}}No{{/if}}
- **Sitio web:** {{websiteUri}}

## NUESTRA PROPUESTA (DigiMarket RD)
{{sellerProfile.valueProposition}}

## SERVICIOS A OFRECER
{{#each sellerProfile.servicesOffered}}
- {{this}}
{{/each}}

## INSTRUCCIONES PARA EL VIDEO
Crea un video de 30-60 segundos (formato vertical 9:16) usando HyperFrames que:
1. **Hook (0-3s):** Problema del negocio sin web propia / web antigua
2. **Solución (3-15s):** Nuestra propuesta de valor + servicios
3. **Prueba social (15-30s):** Rating, reseñas, ubicación privilegiada
4. **CTA (30-60s):** "Agenda tu demo gratis por WhatsApp" + teléfono

Tono: {{sellerProfile.tone}}
Música: Energética, profesional
Estilo: Moderno, limpio, con animaciones de texto

## OUTPUT
- Video MP4 1080x1920
- Subtítulos automáticos
- Marca de agua DigiMarket RD`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'ppt-default',
      name: 'PPT Presentación Comercial (Reveal.js / python-pptx)',
      description: 'Genera presentación 8-10 slides para reunión con cliente',
      type: 'ppt',
      template: `# PROMPT PARA PPT PRESENTACIÓN COMERCIAL - COPIA Y PEGA EN COLAB/JUPYTER

## DATOS DEL PROSPECTO
- **Empresa:** {{displayName}}
- **Rubro:** {{primaryTypeDisplayName}}
- **Dirección:** {{formattedAddress}}
- **Teléfono:** {{nationalPhoneNumber}}
- **Rating Google:** {{rating}}★ ({{userRatingCount}} opiniones)
- **¿Tiene web propia?** {{#if hasOwnWebsite}}Sí{{else}}No{{/if}}
- **Web actual:** {{websiteUri || 'No tiene'}}

## ESTRUCTURA DE LA PRESENTACIÓN (8-10 SLIDES)

### Slide 1: Portada
- Título: "Oportunidad Digital para {{displayName}}"
- Subtítulo: "Análisis de presencia online + Propuesta DigiMarket RD"
- Footer: {{sellerProfile.companyName}} | {{sellerProfile.name}} | {{sellerProfile.phone}}

### Slide 2: Diagnóstico Actual
- Captura de Google Maps / Fotos del negocio
- Rating: {{rating}}★ | {{userRatingCount}} reseñas
- {{#if hasOwnWebsite}}Tiene web pero...{{else}}❌ SIN WEB PROPIA{{/if}}
- Problemas detectados: (lista automática)

### Slide 3: Oportunidad de Mercado
- {{userRatingCount}} clientes opinan → demanda real
- Competencia local sin web optimizada
- Zona: {{formattedAddress}} (alto tráfico)

### Slide 4: Nuestra Solución
{{#each sellerProfile.servicesOffered}}
✅ {{this.name}} - RD$ {{this.price}}
{{/each}}

### Slide 5: Casos de Éxito / Metodología
- Web en 7 días | IA WhatsApp 24/7 | Citas online
- Metodología: Diagnóstico → Diseño → Lanzamiento → Optimización

### Slide 6: Inversión y Paquetes
- Básico: $X | Pro: $Y | Premium: $Z
- Incluye: Hosting, SSL, Dominio, Mantenimiento 3 meses

### Slide 7: Próximos Pasos
1. Demo gratis esta semana
2. Firma contrato → 50% inicio
3. Entrega en 7 días hábiles

### Slide 8: Cierre + Contacto
- WhatsApp: {{sellerProfile.phone}}
- Web: {{sellerProfile.website}}
- "¿Empezamos hoy?"

## TONO: {{sellerProfile.tone}}
## OUTPUT: Archivo .pptx o HTML (Reveal.js) listo para presentar`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
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
        presentationPrompts: parsed.presentationPrompts || DEFAULT_SETTINGS.presentationPrompts,
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
