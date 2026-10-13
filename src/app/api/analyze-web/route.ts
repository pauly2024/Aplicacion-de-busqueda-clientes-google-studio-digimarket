import { NextRequest, NextResponse } from 'next/server';

interface ExtractedWebData {
  title: string;
  description: string;
  hasHttps: boolean;
  isMobileFriendly: boolean;
  hasWhatsApp: boolean;
  hasBooking: boolean;
  hasContactForm: boolean;
  outdatedSignals: string;
  emails: string[];
  socials: string[];
  sampleText: string;
  screenshot?: string; // base64
  performanceMetrics?: {
    loadTime: number;
    domContentLoaded: number;
  };
}

// Tipos para Playwright (solo para TypeScript, no se bundlean)
type PlaywrightBrowser = any;
type PlaywrightChromium = { launch: (options: any) => Promise<PlaywrightBrowser> };

let browser: PlaywrightBrowser | null = null;
let playwrightModule: { chromium: PlaywrightChromium } | null = null;

async function loadPlaywright(): Promise<{ chromium: PlaywrightChromium }> {
  if (!playwrightModule) {
    playwrightModule = await import('playwright');
  }
  return playwrightModule;
}

async function getBrowser(): Promise<PlaywrightBrowser> {
  if (!browser) {
    const { chromium } = await loadPlaywright();
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      executablePath: process.env.PLAYWRIGHT_BROWSERS_PATH
        ? `${process.env.PLAYWRIGHT_BROWSERS_PATH}/chromium-1248/chrome-win64/chrome.exe`
        : undefined,
    });
  }
  return browser;
}

// Analiza la web con Playwright (renderiza JS, toma screenshot, detecta elementos reales)
async function analyzeWithPlaywright(url: string): Promise<ExtractedWebData> {
  const bw = await getBrowser();
  const context = await bw.newContext({
    viewport: { width: 390, height: 844 }, // móvil
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    locale: 'es-ES',
  });

  const page = await context.newPage();
  const startTime = Date.now();
  let domContentLoaded = 0;

  page.on('domcontentloaded', () => {
    domContentLoaded = Date.now() - startTime;
  });

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 25000 });
  } catch (err) {
    // Si falla networkidle, intenta solo load
    try {
      await page.goto(url, { waitUntil: 'load', timeout: 15000 });
    } catch {
      // Último intento sin waitUntil
      await page.goto(url, { timeout: 10000 });
    }
  }

  const loadTime = Date.now() - startTime;

  // Espera un poco a que se renderice todo (lazy loading, etc.)
  await page.waitForTimeout(2000);

  // Screenshot (base64)
  const screenshotBuffer = await page.screenshot({ fullPage: true, type: 'jpeg', quality: 70 });
  const screenshot = `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`;

  // Extrae datos del DOM renderizado
  const data = await page.evaluate(() => {
    const html = document.documentElement.outerHTML;
    const lowerHtml = html.toLowerCase();

    // Title
    const title = document.title.trim();

    // Meta description
    const metaDesc = document.querySelector('meta[name="description"]');
    const description = metaDesc?.getAttribute('content')?.trim() || '';

    // HTTPS
    const hasHttps = location.protocol === 'https:';

    // Mobile viewport
    const viewport = document.querySelector('meta[name="viewport"]');
    const isMobileFriendly = !!viewport;

    // WhatsApp - detecta botones/enlaces reales en el DOM
    const hasWhatsApp = !!(
      document.querySelector('a[href*="wa.me"], a[href*="api.whatsapp.com"], a[href*="chat.whatsapp.com"], a[href*="whatsapp.com"]') ||
      document.querySelector('[class*="whatsapp" i], [id*="whatsapp" i]') ||
      document.querySelector('img[src*="whatsapp" i]')
    );

    // Online booking - detecta formularios/botones de reserva reales
    const hasBooking = !!(
      document.querySelector('a[href*="calendly"], a[href*="booking"], a[href*="reserv"], a[href*="agendar"], a[href*="turnero"]') ||
      document.querySelector('[class*="booking" i], [class*="reserv" i], [class*="calendly" i], [id*="booking" i], [id*="reserv" i]') ||
      document.querySelector('button:has-text("Reserv"), button:has-text("Cita"), button:has-text("Agendar")') ||
      document.querySelector('iframe[src*="calendly"], iframe[src*="booking"]')
    );

    // Contact form - detecta formularios reales en el DOM
    const forms = document.querySelectorAll('form');
    let hasContactForm = false;
    for (const form of forms) {
      const inputs = form.querySelectorAll('input, textarea, select');
      if (inputs.length >= 2) {
        hasContactForm = true;
        break;
      }
    }

    // Outdated signals / copyright
    let outdatedSignals = '';
    const copyrightMatch = html.match(/©|copyright\s*(\d{4})/i);
    if (copyrightMatch && copyrightMatch[1]) {
      const year = parseInt(copyrightMatch[1], 10);
      const currentYear = new Date().getFullYear();
      if (year < currentYear - 2) {
        outdatedSignals = `Copyright desactualizado (año ${year})`;
      }
    }
    if (!isMobileFriendly) {
      outdatedSignals = outdatedSignals ? `${outdatedSignals}, no adaptada a móviles` : 'No adaptada a móviles (sin viewport)';
    }

    // Emails
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
    const emails = Array.from(new Set((html.match(emailRegex) || []).map((e) => e.toLowerCase()))).slice(0, 5);

    // Socials - detecta enlaces reales
    const socials: string[] = [];
    const links = document.querySelectorAll('a[href]');
    for (const link of links) {
      const href = link.getAttribute('href') || '';
      if (href.includes('instagram.com/')) socials.push('Instagram');
      else if (href.includes('facebook.com/')) socials.push('Facebook');
      else if (href.includes('tiktok.com/')) socials.push('TikTok');
      else if (href.includes('linkedin.com/')) socials.push('LinkedIn');
      else if (href.includes('youtube.com/')) socials.push('YouTube');
      else if (href.includes('twitter.com/') || href.includes('x.com/')) socials.push('Twitter/X');
    }

    // Text sample (texto visible, no HTML)
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    let text = '';
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.parentElement && !['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(node.parentElement.tagName)) {
        text += node.textContent + ' ';
      }
    }
    const plainText = text.replace(/\s+/g, ' ').trim().slice(0, 3000);

    return {
      title,
      description,
      hasHttps,
      isMobileFriendly,
      hasWhatsApp,
      hasBooking,
      hasContactForm,
      outdatedSignals,
      emails: [...new Set(emails)],
      socials: [...new Set(socials)],
      sampleText: plainText,
    };
  });

  await context.close();

  return {
    ...data,
    screenshot,
    performanceMetrics: { loadTime, domContentLoaded },
  };
}

// Fallback: análisis rápido solo con fetch (para producción/Vercel sin Playwright)
async function analyzeWithFetch(url: string): Promise<ExtractedWebData> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7000);

  const res = await fetch(url, {
    signal: controller.signal,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  clearTimeout(timeoutId);

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const html = await res.text();
  const lowerHtml = html.toLowerCase();

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';

  const metaDescMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
  const description = metaDescMatch ? metaDescMatch[1].trim() : '';

  const hasHttps = url.toLowerCase().startsWith('https://');
  const isMobileFriendly = lowerHtml.includes('name="viewport"') || lowerHtml.includes("name='viewport'");

  const hasWhatsApp =
    lowerHtml.includes('wa.me') ||
    lowerHtml.includes('api.whatsapp.com') ||
    lowerHtml.includes('whatsapp') ||
    lowerHtml.includes('chat.whatsapp.com');

  const hasBooking =
    lowerHtml.includes('reserv') ||
    lowerHtml.includes('pedir cita') ||
    lowerHtml.includes('agendar') ||
    lowerHtml.includes('calendly') ||
    lowerHtml.includes('turnero') ||
    lowerHtml.includes('book-now') ||
    lowerHtml.includes('booking');

  const hasContactForm = lowerHtml.includes('<form') && (lowerHtml.includes('input') || lowerHtml.includes('textarea'));

  let outdatedSignals = '';
  const copyrightMatch = html.match(/©|copyright\s*(\d{4})/i);
  if (copyrightMatch && copyrightMatch[1]) {
    const year = parseInt(copyrightMatch[1], 10);
    const currentYear = new Date().getFullYear();
    if (year < currentYear - 2) {
      outdatedSignals = `Copyright desactualizado (año ${year})`;
    }
  }
  if (!isMobileFriendly) {
    outdatedSignals = outdatedSignals ? `${outdatedSignals}, no adaptada a móviles` : 'No adaptada a móviles (sin viewport)';
  }

  const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
  const emails = Array.from(new Set((html.match(emailRegex) || []).map((e) => e.toLowerCase()))).slice(0, 3);

  const socials: string[] = [];
  if (lowerHtml.includes('instagram.com/')) socials.push('Instagram');
  if (lowerHtml.includes('facebook.com/')) socials.push('Facebook');
  if (lowerHtml.includes('tiktok.com/')) socials.push('TikTok');
  if (lowerHtml.includes('linkedin.com/')) socials.push('LinkedIn');

  const plainText = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2000);

  return {
    title,
    description,
    hasHttps,
    isMobileFriendly,
    hasWhatsApp,
    hasBooking,
    hasContactForm,
    outdatedSignals,
    emails,
    socials,
    sampleText: plainText,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      url,
      businessName,
      businessCategory = '',
      address = '',
      phone = '',
      rating,
      userRatingCount,
      sellerProfile,
      apiKey: clientKey,
      pageSpeedScores,
    } = body;

    const apiKey = clientKey || process.env.GEMINI_API_KEY;

    let webData: ExtractedWebData | null = null;
    let fetchError: string | null = null;

    // Si tiene URL y no está vacía, intentamos leer la web
    if (url && typeof url === 'string' && url.trim() !== '') {
      let fullUrl = url.trim();
      if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
        fullUrl = `https://${fullUrl}`;
      }

      try {
        // Usa Playwright en local (si hay PLAYWRIGHT_BROWSERS_PATH), sino fetch simple
        const usePlaywright = !!process.env.PLAYWRIGHT_BROWSERS_PATH;
        
        if (usePlaywright) {
          console.log('[analyze-web] Usando Playwright para análisis completo con renderizado JS');
          webData = await analyzeWithPlaywright(fullUrl);
        } else {
          console.log('[analyze-web] Usando fetch simple (modo producción/Vercel)');
          webData = await analyzeWithFetch(fullUrl);
        }
      } catch (err: any) {
        fetchError = err.message || 'Error al analizar la web';
        console.error('[analyze-web] Error:', fetchError);
        
        // Fallback a fetch si Playwright falla
        if (!!process.env.PLAYWRIGHT_BROWSERS_PATH) {
          try {
            console.log('[analyze-web] Fallback a fetch simple...');
            webData = await analyzeWithFetch(fullUrl);
          } catch (fetchErr: any) {
            fetchError = fetchErr.message;
          }
        }
      }
    }

    const sellerName = sellerProfile?.name || 'Asesor DigiMarket';
    const sellerCompany = sellerProfile?.companyName || 'DigiMarket RD';
    const sellerValueProp =
      sellerProfile?.valueProposition ||
      'Ayudamos a negocios locales a digitalizarse, captar clientes en autom\u00E1tico con p\u00E1ginas web y agentes de IA por WhatsApp.';
    const tone = sellerProfile?.tone || 'consultivo';

    // Construcci\u00F3n del Prompt para NVIDIA NIM
    const systemPrompt = `\u00C9res un consultor experto en prospecci\u00F3n y digitalizaci\u00F3n de negocios locales para la agencia digital "${sellerCompany}".
Tu objetivo es analizar un negocio local y generar un diagn\u00F3stico certero y 3 borradores de primer contacto personalizados (llamada de 30s, WhatsApp y correo) para vender **paquetes combinados** de servicios digitales de DigiMarket RD:

SERVICIOS DISPONIBLES (se pueden combinar):
1. **P\u00E1gina Web Moderna y R\u00E1pida** (Astro + Tailwind, 95+ PageSpeed m\u00F3vil, WhatsApp integrado)
2. **Agente de IA para WhatsApp 24/7** (responde FAQ, califica leads, agenda citas, transfiere a humano)
3. **Sistema de Citas y Reservas Online** (calendario sincronizado, recordatorios WhatsApp, confirmaciones)
4. **Posicionamiento y Optimizaci\u00F3n SEO Local** (Google Business, "cerca de m\u00ED", contenido geolocalizado)
5. **Redise\u00F1o Web Performance** (solo si ya tiene web pero lenta/desactualizada)

REGLAS DE PAQUETES:
- Sin web \u2192 **Pack Web + WhatsApp IA** (a\u00F1ade Citas si es nicho con citas: talleres, cl\u00EDnicas, est\u00E9tica, peluquer\u00EDa, etc.)
- Web mala (lenta, sin WhatsApp, sin citas) \u2192 **Pack Transformaci\u00F3n Completa** (redise\u00F1o + IA + Citas)
- Web decente pero sin WhatsApp ni citas \u2192 **Pack Automatizaci\u00F3n WhatsApp + Citas**
- Solo falta WhatsApp \u2192 **Agente IA WhatsApp 24/7 + Bot\u00F3n Conversi\u00F3n**
- Solo falta Citas \u2192 **Sistema de Citas Online Automatizado**
- Web lenta/desactualizada pero con WhatsApp y Citas \u2192 **Redise\u00F1o Web Performance + SEO Local**
- Web OK pero SEO bajo \u2192 **SEO Local Dominante**
- Todo bien \u2192 **Plan Crecimiento Continuo** (Ads + Monitor IA)

El paquete debe tener nombre comercial, lista de servicios incluidos, rango de precio estimado y raz\u00F3n convincente.

DATOS DEL NEGOCIO:
- Nombre: ${businessName}
- Categor\u00EDa / Nicho: ${businessCategory}
- Direcci\u00F3n: ${address}
- Tel\u00E9fono: ${phone || 'No registrado'}
- Valoraci\u00F3n Google Maps: ${rating ? `\${rating} \u2605 (\${userRatingCount || 0} rese\u00F1as)` : 'Sin rese\u00F1as'}
- URL de la Web: ${url || 'NO TIENE SITIO WEB'}
${
  webData
    ? `
- T\u00EDtulo web: ${webData.title}
- Descripci\u00F3n: ${webData.description}
- HTTPS: ${webData.hasHttps ? 'S\u00ED' : 'No'}
- Adaptada a m\u00F3vil: ${webData.isMobileFriendly ? 'S\u00ED' : 'No'}
- Bot\u00F3n WhatsApp detectado: ${webData.hasWhatsApp ? 'S\u00ED' : 'No'}
- Sistema de reservas/citas detectado: ${webData.hasBooking ? 'S\u00ED' : 'No'}
- Formulario de contacto: ${webData.hasContactForm ? 'S\u00ED' : 'No'}
- Correos encontrados: ${webData.emails.join(', ') || 'Ninguno'}
- Redes sociales: ${webData.socials.join(', ') || 'Ninguna'}
- Se\u00F1ales de abandono: ${webData.outdatedSignals || 'Ninguna'}
- Tiempo de carga (ms): ${webData.performanceMetrics?.loadTime || 'N/A'}
- DOMContentLoaded (ms): ${webData.performanceMetrics?.domContentLoaded || 'N/A'}
- Screenshot disponible: ${webData.screenshot ? 'S\u00ED (base64 JPEG)' : 'No'}
- Muestra de contenido visible: ${webData.sampleText.slice(0, 1500)}
`
    : ''
}
${
  pageSpeedScores
    ? `
- Notas PageSpeed M\u00F3vil: Rendimiento ${pageSpeedScores.performance}/100, SEO ${pageSpeedScores.seo}/100, Accesibilidad ${pageSpeedScores.accessibility}/100, Buenas pr\u00E1cticas ${pageSpeedScores.bestPractices}/100
`
    : ''
}

PERFIL DEL VENDEDOR (${sellerCompany}):
- Nombre del asesor: ${sellerName}
- Propuesta de valor: ${sellerValueProp}
- Tono preferido: ${tone} (profesional, cercano, directo y centrado en beneficios comerciales tangibles).

REGLAS DE RESPUESTA:
  1. Responde \u00DANICAMENTE un objeto JSON v\u00E1lido con este esquema exacto, sin texto antes ni despu\u00E9s.
  2. CR\u00CDTICO: Si el negocio NO tiene sitio web (URL: NO TIENE SITIO WEB), NO generes texto que sugiera que analizaste su web. Evita frases como "analizamos su web", "su página web", "su sitio web", "tras analizar su web", etc. En su lugar, usa: "No tienen web propia", "carecen de sitio web", "sin presencia web propia".
{
  "summary": "Resumen en dos frases concisas de a qu\u00E9 se dedica el negocio y su reputaci\u00F3n.",
  "checklist": {
    "https": true/false,
    "mobileFriendly": true/false,
    "whatsappButton": true/false,
    "onlineBooking": true/false,
    "contactForm": true/false,
    "outdatedSignals": "Explicaci\u00F3n breve o vac\u00EDo si est\u00E1 actualizada"
  },
  "emails": ["lista de emails encontrados o deducidos"],
  "socials": ["redes encontradas"],
  "problems": [
    "Problema 1 explicado en lenguaje llano (evita tecnicismos oscuros)",
    "Problema 2...",
    "Problema 3...",
    "Problema 4...",
    "Problema 5..."
  ],
  "recommendedService": {
    "service": "Nombre del paquete/servicio (ej. Pack Web + WhatsApp IA / Pack Transformaci\u00F3n Completa / Agente IA WhatsApp 24/7)",
    "reason": "Explicaci\u00F3n convincente de por qu\u00E9 este paquete le solucionar\u00E1 los problemas y generar\u00E1 m\u00E1s clientes/ventas.",
    "services": ["Lista de servicios incluidos en el paquete"],
    "priceRange": "Rango de precio estimado (ej. 1.200\u20AC pago \u00FAnico + 97\u20AC/mes)",
    "isPackage": true
  },
  "drafts": {
    "phoneScript": "Guion telef\u00F3nico de 30 segundos: saludo educado, menci\u00F3n de su negocio/rese\u00F1as, se\u00F1alamiento del cuello de botella y propuesta para mostrarle una soluci\u00F3n sin compromiso.",
    "whatsapp": "Mensaje de WhatsApp: corto, directo, respetuoso, con emojis sutiles, mencionando c\u00F3mo ayudarle a no perder clientes que buscan en Google.",
    "email": "Asunto y cuerpo de correo estructurado, cordial y orientado a resultados comerciales."
  }
}
`;

    // Si tenemos API Key de Gemini, llamamos a la API
    if (apiKey) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        const geminiRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 2000,
              responseMimeType: 'application/json',
            },
          }),
        });

        const geminiData = await geminiRes.json();

        if (geminiRes.ok) {
          const rawText =
            geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (rawText) {
            try {
              const parsed = JSON.parse(rawText);
              return NextResponse.json({
                ...parsed,
                analyzedAt: new Date().toISOString(),
              });
            } catch (jsonErr) {
              console.warn('Gemini devolvi\u00F3 texto no-JSON directo:', rawText);
            }
          }
        } else {
          console.error('Error de Gemini API:', geminiData);
        }
      } catch (geminiCallErr) {
        console.error('Fallo de llamada a Gemini:', geminiCallErr);
      }
    }

    // Heurística de respaldo de alta calidad (si la API de NVIDIA NIM no está disponible o falla)
    const hasWeb = Boolean(url && url.trim() !== '');
    const safeChecklist = {
      https: webData ? webData.hasHttps : false,
      mobileFriendly: webData ? webData.isMobileFriendly : false,
      whatsappButton: webData ? webData.hasWhatsApp : false,
      onlineBooking: webData ? webData.hasBooking : false,
      contactForm: webData ? webData.hasContactForm : false,
      outdatedSignals: webData ? webData.outdatedSignals : hasWeb ? 'Web no optimizada' : 'Sin sitio web propio',
    };

    const detectedProblems: string[] = [];
    if (!hasWeb) {
      detectedProblems.push('No tienen página web propia: los clientes que buscan en Google no encuentran un catálogo ni cómo agendar.');
      detectedProblems.push('Pierden clientes frente a competidores que sí aparecen con web profesional en Google Maps.');
      detectedProblems.push('Dependen únicamente de llamadas o de que el cliente visite el local físico.');
    } else {
      if (!safeChecklist.whatsappButton) {
        detectedProblems.push('No tienen botón flotante de WhatsApp para atender consultas rápidas desde el teléfono móvil.');
      }
      if (!safeChecklist.onlineBooking) {
        detectedProblems.push('No cuentan con un sistema directo para pedir citas o reservar en línea sin llamar.');
      }
      if (pageSpeedScores && pageSpeedScores.performance < 60) {
        detectedProblems.push(`La página web tarda mucho en abrir en celulares (nota de velocidad: ${pageSpeedScores.performance}/100), provocando que los visitantes salgan.`);
      }
      if (safeChecklist.outdatedSignals) {
        detectedProblems.push(`La web luce desactualizada (${safeChecklist.outdatedSignals}), lo que transmite desconfianza.`);
      }
      if (!safeChecklist.contactForm) {
        detectedProblems.push('No tienen formulario de contacto funcional para captar leads fuera de horario.');
      }
      if (pageSpeedScores && pageSpeedScores.seo < 60) {
        detectedProblems.push(`Su visibilidad en búsquedas locales es baja (SEO: ${pageSpeedScores.seo}/100), pierden clientes que buscan sus servicios.`);
      }
      if (detectedProblems.length < 3) {
        detectedProblems.push('La interfaz no tiene llamadas a la acción claras para convertir visitas en llamadas o mensajes.');
      }
    }

    // --- NUEVO: Recomendación de PAQUETES COMBINADOS según problemas detectados ---
    const needsWeb = !hasWeb;
    const needsWhatsApp = hasWeb && !safeChecklist.whatsappButton;
    const needsBooking = hasWeb && !safeChecklist.onlineBooking;
    const needsSpeed = hasWeb && pageSpeedScores && pageSpeedScores.performance < 60;
    const needsSEO = hasWeb && pageSpeedScores && pageSpeedScores.seo < 60;
    const needsRedesign = hasWeb && (safeChecklist.outdatedSignals || needsSpeed);
    const hasGoodReviews = (userRatingCount || 0) >= 20 && (rating || 0) >= 4.0;

    // Construir paquete recomendado
    let packageName = '';
    let packageReason = '';
    let packageServices: string[] = [];
    let packagePriceRange = '';

    if (needsWeb) {
      // Sin web: paquete base completo
      packageServices = ['Página Web Moderna y Rápida', 'Agente de IA para WhatsApp 24/7'];
      if (needsBooking || businessCategory?.toLowerCase().includes('taller') || businessCategory?.toLowerCase().includes('clínica') || businessCategory?.toLowerCase().includes('dental') || businessCategory?.toLowerCase().includes('fisio') || businessCategory?.toLowerCase().includes('estética') || businessCategory?.toLowerCase().includes('peluquer')) {
        packageServices.push('Sistema de Citas y Reservas Online');
      }
      packageName = packageServices.length === 3 ? 'Pack Digital Completo' : 'Pack Web + WhatsApp IA';
      packageReason = `Negocio con ${userRatingCount || 0}+ reseñas y ${rating || 'buena'}★ en Google pero SIN web propia. Cada día pierden clientes que buscan en móvil y no encuentran cómo contactar. El paquete incluye web rápida con WhatsApp integrado${packageServices.includes('Sistema de Citas y Reservas Online') ? ' + sistema de citas automático' : ''} para capturar el 100% de la demanda.`;
      packagePriceRange = 'Desde 1.200€ pago único + 97€/mes (IA + hosting)';
    } else if (needsWhatsApp && needsBooking && (needsSpeed || needsRedesign)) {
      // Web mala + sin WhatsApp + sin booking = rediseño completo
      packageServices = ['Rediseño Web Móvil Ultrarrápido (95+ PageSpeed)', 'Agente de IA para WhatsApp 24/7', 'Sistema de Citas y Reservas Online'];
      packageName = 'Pack Transformación Digital Completa';
      packageReason = `Tienen web pero pierde clientes por velocidad (${pageSpeedScores?.performance || 'baja'}/100), sin WhatsApp directo ni citas online. Reconstruimos la web optimizada para móvil + IA que responde y agenda 24/7 + calendario sincronizado.`;
      packagePriceRange = 'Desde 1.800€ pago único + 147€/mes (IA + hosting + mantenimiento)';
    } else if (needsWhatsApp && needsBooking) {
      // Web decente pero sin WhatsApp ni booking
      packageServices = ['Agente de IA para WhatsApp 24/7', 'Sistema de Citas y Reservas Online', 'Botón WhatsApp + CTA flotante en web actual'];
      packageName = 'Pack Automatización WhatsApp + Citas';
      packageReason = `Su web funciona pero no convierte: faltan canal directo WhatsApp y citas online. Instalamos IA que atiende, califica y agenda en automático + botones de conversión en su web actual.`;
      packagePriceRange = '497€ setup + 97€/mes (IA)';
    } else if (needsWhatsApp) {
      // Solo falta WhatsApp
      packageServices = ['Agente de IA para WhatsApp 24/7', 'Botón WhatsApp flotante en web'];
      packageName = 'Agente IA WhatsApp 24/7 + Botón Conversión';
      packageReason = `Reciben consultas por web pero no responden al instante. La IA atiende FAQ, cotiza y agenda citas 24/7 sin que pierdan ni un lead.`;
      packagePriceRange = '297€ setup + 79€/mes';
    } else if (needsBooking) {
      // Solo falta booking
      packageServices = ['Sistema de Citas y Reservas Online', 'Integración en web actual'];
      packageName = 'Sistema de Citas Online Automatizado';
      packageReason = `Clientes quieren reservar sin llamar. Sistema 24/7 sincronizado con su calendario, recordatorios automáticos y confirmación por WhatsApp.`;
      packagePriceRange = '197€ setup + 39€/mes';
    } else if (needsSpeed || needsRedesign) {
      // Web lenta/desactualizada pero con WhatsApp y booking
      packageServices = ['Rediseño Web Móvil Ultrarrápido (95+ PageSpeed)', 'Optimización SEO Local'];
      packageName = 'Rediseño Web Performance + SEO Local';
      packageReason = `Web actual frena conversiones: velocidad ${pageSpeedScores?.performance || 'baja'}/100 y SEO ${pageSpeedScores?.seo || 'bajo'}/100. Reconstruimos solo lo técnico: Astro + Tailwind, 95+ PageSpeed, schema.org, Core Web Vitals verdes.`;
      packagePriceRange = 'Desde 900€ pago único + 49€/mes (hosting + SEO)';
    } else if (needsSEO) {
      // Web OK pero SEO bajo
      packageServices = ['Posicionamiento y Optimización SEO Local', 'Ficha Google Business optimizada', 'Contenido geolocalizado mensual'];
      packageName = 'SEO Local Dominante';
      packageReason = `Web funcional pero invisible en búsquedas locales (SEO: ${pageSpeedScores?.seo}/100). Optimización técnica + contenido + ficha Google para aparecer en "cerca de mí" y mapas.`;
      packagePriceRange = '397€ setup + 197€/mes';
    } else {
      // Todo bien - upsell mantenimiento/crecimiento
      packageServices = ['Mantenimiento Web Pro + Monitor IA', 'Campañas Google Ads Local'];
      packageName = 'Plan Crecimiento Continuo';
      packageReason = `Todo funcionando bien (${rating}★, ${userRatingCount} reseñas). El siguiente nivel: escalar leads con Ads geolocalizados + monitor IA que detecta oportunidades en tiempo real.`;
      packagePriceRange = '297€/mes (gestión completa)';
    }

    const recommended = {
      service: packageName,
      reason: packageReason,
      services: packageServices,
      priceRange: packagePriceRange,
      isPackage: true,
    };

    const phoneScript = `Hola, buenos días. ¿Hablo con el encargado de ${businessName}? Mi nombre es ${sellerName} de ${sellerCompany}. Le llamo rápido porque estuve viendo las excelentes valoraciones que tienen en Google (${rating || 4.8} estrellas), pero noté que ${
      !hasWeb
        ? 'no tienen una web propia donde los clientes puedan pedir cita o ver sus servicios'
        : 'su web no tiene canal directo de WhatsApp para responder citas al instante'
    }. En DigiMarket ayudamos a negocios de ${businessCategory || 'su sector'} a captar entre 10 y 20 clientes extra al mes con herramientas automáticas. ¿Me permitiría enviarle un ejemplo de 1 minuto por WhatsApp para que vea cómo quedaría?`;

    const whatsappDraft = `¡Hola ${businessName}! 👋 Les escribe ${sellerName} de ${sellerCompany}.\n\nEstuve viendo su negocio en Google Maps y me llamó la atención su excelente reputación. Sin embargo, noté que ${
      !hasWeb
        ? 'actualmente no tienen una página web donde los clientes puedan consultar y pedir citas directamente.'
        : 'su sitio web pierde clientes móviles porque no tiene botón directo de WhatsApp ni sistema de citas.'
    }\n\nDiseñamos soluciones digitales llave en mano para negocios locales. ¿Les gustaría ver una propuesta rápida sin ningún compromiso?`;

    const emailDraft = `Asunto: Oportunidad de captación de clientes para ${businessName}\n\nEstimado equipo de ${businessName},\n\nMi nombre es ${sellerName}, especialista en digitalización en ${sellerCompany}.\n\nAl analizar su presencia digital en Google, identificamos que ${
      !hasWeb
        ? 'carecen de una web oficial adaptada a teléfonos móviles'
        : 'su web actual presenta puntos de fricción para convertir visitas en clientes (velocidad y falta de WhatsApp directo)'
    }.\n\nPodemos ayudarles a implementar una solución que duplique sus solicitudes de servicio de forma automática.\n\n¿Tendrían 5 minutos esta semana para una breve demostración?\n\nAtentamente,\n${sellerName}\n${sellerCompany} | ${sellerProfile?.phone || ''}`;

    return NextResponse.json({
      summary: `${businessName} es un establecimiento destacado en el nicho de ${businessCategory || 'servicios locales'} con ${userRatingCount || 0} valoraciones de clientes en Google Maps.`,
      checklist: safeChecklist,
      emails: webData?.emails || [],
      socials: webData?.socials || [],
      problems: detectedProblems,
      recommendedService: recommended,
      drafts: {
        phoneScript,
        whatsapp: whatsappDraft,
        email: emailDraft,
      },
      analyzedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Error en /api/analyze-web:', err);
    return NextResponse.json(
      { error: err.message || 'Error inesperado al analizar web' },
      { status: 500 }
    );
  }
}
