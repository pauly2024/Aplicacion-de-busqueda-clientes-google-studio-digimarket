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
}

// Extrae información clave del HTML
function parseHtmlContent(html: string, url: string): ExtractedWebData {
  const lowerHtml = html.toLowerCase();

  // Title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';

  // Meta description
  const metaDescMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
  const description = metaDescMatch ? metaDescMatch[1].trim() : '';

  // HTTPS
  const hasHttps = url.toLowerCase().startsWith('https://');

  // Mobile viewport
  const isMobileFriendly = lowerHtml.includes('name="viewport"') || lowerHtml.includes("name='viewport'");

  // WhatsApp
  const hasWhatsApp =
    lowerHtml.includes('wa.me') ||
    lowerHtml.includes('api.whatsapp.com') ||
    lowerHtml.includes('whatsapp') ||
    lowerHtml.includes('chat.whatsapp.com');

  // Online booking / citas
  const hasBooking =
    lowerHtml.includes('reserv') ||
    lowerHtml.includes('pedir cita') ||
    lowerHtml.includes('agendar') ||
    lowerHtml.includes('calendly') ||
    lowerHtml.includes('turnero') ||
    lowerHtml.includes('book-now') ||
    lowerHtml.includes('booking');

  // Contact form
  const hasContactForm = lowerHtml.includes('<form') && (lowerHtml.includes('input') || lowerHtml.includes('textarea'));

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
  const emails = Array.from(new Set((html.match(emailRegex) || []).map((e) => e.toLowerCase()))).slice(0, 3);

  // Socials
  const socials: string[] = [];
  if (lowerHtml.includes('instagram.com/')) socials.push('Instagram');
  if (lowerHtml.includes('facebook.com/')) socials.push('Facebook');
  if (lowerHtml.includes('tiktok.com/')) socials.push('TikTok');
  if (lowerHtml.includes('linkedin.com/')) socials.push('LinkedIn');

  // Text sample (strip tags)
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
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7000);

        const res = await fetch(fullUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const html = await res.text();
          webData = parseHtmlContent(html, fullUrl);
        } else {
          fetchError = `Servidor respondió con código ${res.status}`;
        }
      } catch (err: any) {
        fetchError = err.name === 'AbortError' ? 'Tiempo de espera agotado (servidor lento)' : err.message;
      }
    }

    const sellerName = sellerProfile?.name || 'Asesor DigiMarket';
    const sellerCompany = sellerProfile?.companyName || 'DigiMarket RD';
    const sellerValueProp =
      sellerProfile?.valueProposition ||
      'Ayudamos a negocios locales a digitalizarse, captar clientes en automático con páginas web y agentes de IA por WhatsApp.';
    const tone = sellerProfile?.tone || 'consultivo';

    // Construcción del Prompt para Gemini
    const systemPrompt = `Eres un consultor experto en prospección y digitalización de negocios locales para la agencia digital "${sellerCompany}".
Tu objetivo es analizar un negocio local y generar un diagnóstico certero y 3 borradores de primer contacto personalizados (llamada de 30s, WhatsApp y correo) para vender servicios digitales (Página Web de alta conversión, Agente de IA para WhatsApp 24/7, Sistema de Citas y Reservas, o Rediseño Web).

DATOS DEL NEGOCIO:
- Nombre: ${businessName}
- Categoría / Nicho: ${businessCategory}
- Dirección: ${address}
- Teléfono: ${phone || 'No registrado'}
- Valoración Google Maps: ${rating ? `${rating} ★ (${userRatingCount || 0} reseñas)` : 'Sin reseñas'}
- URL de la Web: ${url || 'NO TIENE SITIO WEB'}
${
  webData
    ? `
- Título web: ${webData.title}
- Descripción: ${webData.description}
- HTTPS: ${webData.hasHttps ? 'Sí' : 'No'}
- Adaptada a móvil: ${webData.isMobileFriendly ? 'Sí' : 'No'}
- Botón WhatsApp detectado: ${webData.hasWhatsApp ? 'Sí' : 'No'}
- Sistema de reservas/citas detectado: ${webData.hasBooking ? 'Sí' : 'No'}
- Formulario de contacto: ${webData.hasContactForm ? 'Sí' : 'No'}
- Correos encontrados: ${webData.emails.join(', ') || 'Ninguno'}
- Redes sociales: ${webData.socials.join(', ') || 'Ninguna'}
- Señales de abandono: ${webData.outdatedSignals || 'Ninguna'}
- Muestra de contenido: ${webData.sampleText.slice(0, 1000)}
`
    : ''
}
${
  pageSpeedScores
    ? `
- Notas PageSpeed Móvil: Rendimiento ${pageSpeedScores.performance}/100, SEO ${pageSpeedScores.seo}/100, Accesibilidad ${pageSpeedScores.accessibility}/100, Buenas prácticas ${pageSpeedScores.bestPractices}/100
`
    : ''
}

PERFIL DEL VENDEDOR (${sellerCompany}):
- Nombre del asesor: ${sellerName}
- Propuesta de valor: ${sellerValueProp}
- Tono preferido: ${tone} (profesional, cercano, directo y centrado en beneficios comerciales tangibles).

REGLAS DE RESPUESTA:
1. Responde ÚNICAMENTE un objeto JSON válido con este esquema exacto, sin texto antes ni después:
{
  "summary": "Resumen en dos frases concisas de a qué se dedica el negocio y su reputación.",
  "checklist": {
    "https": true/false,
    "mobileFriendly": true/false,
    "whatsappButton": true/false,
    "onlineBooking": true/false,
    "contactForm": true/false,
    "outdatedSignals": "Explicación breve o vacío si está actualizada"
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
    "service": "Nombre del servicio principal a ofrecer (ej. Página Web de Alta Conversión / Agente de WhatsApp con IA / Sistema de Citas Online)",
    "reason": "Explicación convincente de por qué este servicio específico le solucionará los problemas detectados y generará más clientes/ventas."
  },
  "drafts": {
    "phoneScript": "Guion telefónico de 30 segundos: saludo educado, mención de su negocio/reseñas, señalamiento del cuello de botella y propuesta para mostrarle una solución sin compromiso.",
    "whatsapp": "Mensaje de WhatsApp: corto, directo, respetuoso, con emojis sutiles, mencionando cómo ayudarle a no perder clientes que buscan en Google.",
    "email": "Asunto y cuerpo de correo estructurado, cordial y orientado a resultados comerciales."
  }
}
`;

    // Si tenemos API Key de Gemini, llamamos a la API oficial
    if (apiKey) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        const geminiRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt }] }],
            generationConfig: {
              response_mime_type: 'application/json',
              temperature: 0.3,
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
              console.warn('Gemini devolvió texto no-JSON directo:', rawText);
            }
          }
        } else {
          console.error('Error de Gemini API:', geminiData);
        }
      } catch (geminiCallErr) {
        console.error('Fallo de llamada a Gemini:', geminiCallErr);
      }
    }

    // Heurística de respaldo de alta calidad (si la API de Gemini no está disponible o falla)
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
      if (detectedProblems.length < 3) {
        detectedProblems.push('La interfaz no tiene llamadas a la acción claras para convertir visitas en llamadas o mensajes.');
      }
    }

    const recommended = !hasWeb
      ? {
          service: 'Página Web de Alta Conversión con WhatsApp Integrado',
          reason: `Un negocio con ${userRatingCount || 10}+ opiniones en Google pierde hasta un 40% de contactos por no tener una web rápida con botón de cita directa.`,
        }
      : !safeChecklist.whatsappButton
      ? {
          service: 'Agente de IA para WhatsApp & Botón de Conversión',
          reason: 'Permite responder preguntas frecuentes, cotizar y agendar citas 24/7 en automático por WhatsApp.',
        }
      : {
          service: 'Rediseño Web Móvil Ultrarrápido & Automatización de Citas',
          reason: 'Mejora la velocidad en móviles al 95+ de PageSpeed y conecta reservas directas al calendario.',
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
