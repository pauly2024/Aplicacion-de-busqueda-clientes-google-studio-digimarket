import { NextResponse } from "next/server";

interface Slide {
  title: string;
  content: string;
  bulletPoints?: string[];
  type: "cover" | "diagnosis" | "opportunity" | "problems" | "solution" | "timeline" | "contact" | "closing";
}

interface PropuestaData {
  negocio: string;
  categoria: string;
  direccion: string;
  telefono: string;
  email?: string;
  sitioWeb?: string;
  rating?: number;
  reviews?: number;
  oportunidadScore: number;
  problemas: string[];
  paquetesRecomendados: {
    nombre: string;
    precio: string;
    servicios: string[];
    razon: string;
  }[];
  timeline: string;
  contactoWhatsApp?: string;
  siteUrl?: string; // URL del sitio generado en Caso 2
}

const NOTEBOOKLM_PROMPT = `
Eres un consultor senior de DigiMarket RD generando una presentación ejecutiva de 8 diapositivas para enviar a un prospecto por WhatsApp/Email.

CONTEXTO DE NEGOCIO:
- Nombre: {negocio}
- Categoría/Nicho: {categoria}
- Ubicación: {direccion}
- Teléfono: {telefono}
- Rating Google: {rating}★ ({reviews} reseñas)
- Puntuación de Oportunidad: {oportunidadScore}/100
- Sitio web actual: {sitioWeb || "Sin sitio web propio"}
- Sitio NUEVO generado: {siteUrl || "Pendiente"}

PROBLEMAS DETECTADOS:
{problemas}

PAQUETE RECOMENDADO:
- Nombre: {paqueteNombre}
- Precio: {paquetePrecio}
- Servicios: {paqueteServicios}
- Razón: {paqueteRazon}

TIMELINE: {timeline}

INSTRUCCIONES PARA CADA DIAPOSITIVA:

1. PORTADA: Impacto inmediato. Título: "Diagnóstico Digital para {negocio}". Subtítulo: "Cómo multiplicar sus clientes con IA y Web moderna". Incluir logo DigiMarket RD.

2. DIAGNÓSTICO ACTUAL: Datos duros del negocio. Tabla visual: Ubicación, Categoría, Rating, Reseñas, Score oportunidad. Frase clave: "Su negocio tiene {oportunidadScore}% de potencial sin explotar".

3. OPORTUNIDAD DE MERCADO: Visual del gap. "Competidores con web + IA captan 3x más leads". Mostrar score vs promedio sector. Frase: "Cada día sin presencia digital pierde X clientes".

4. PROBLEMAS DETECTADOS: Lista visual con iconos de alerta. Top 5 problemas en lenguaje de negocio (no técnico). Ej: "Sin web = invisible en Google", "Sin WhatsApp = pierde 70% consultas móviles", "Sin citas = operación manual".

5. SOLUCIÓN: PAQUETE {paqueteNombre}: Presentar como producto único. 3 columnas: Qué incluye | Beneficio directo | ROI estimado. Precio destacado: {paquetePrecio}. Razón: {paqueteRazon}.

6. TIMELINE DE IMPLEMENTACIÓN: 3 fases visuales con fechas. Fase 1 (Semana 1-2): Web + IA WhatsApp. Fase 2 (Semana 3): Citas + CRM. Fase 3 (Mes 2): SEO + Ads. Entregables por fase.

7. PRIMER CONTACTO - GUIONES: 3 tabs visuales:
   - WhatsApp (160 chars, CTA en primeros 3 seg)
   - Llamada 30 seg (Hook → Valor → Cierre)
   - Email formal (Asunto + 3 párrafos + CTA)

8. CIERRE Y PRÓXIMOS PASOS: "¿Agendamos 15 min para mostrarle demo en vivo?". QR código WhatsApp DigiMarket. Botón "Sí, quiero mi diagnóstico gratis". Contacto: +1 829-XXX-XXXX | digimarketrd.2bd.net
`;

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      negocio,
      categoria,
      direccion,
      telefono,
      email,
      sitioWeb,
      rating,
      reviews,
      oportunidadScore,
      problemas,
      paquetesRecomendados,
      timeline,
      contactoWhatsApp,
      siteUrl,
    } = body;

    if (!negocio || !oportunidadScore || !paquetesRecomendados) {
      return NextResponse.json(
        { error: "Datos requeridos: negocio, oportunidadScore, paquetesRecomendados" },
        { status: 400 }
      );
    }

    const paquetePrincipal = paquetesRecomendados[0];

    // Generar prompt para NotebookLM
    const notebookPrompt = NOTEBOOKLM_PROMPT
      .replace(/{negocio}/g, negocio)
      .replace(/{categoria}/g, categoria || "Negocio local")
      .replace(/{direccion}/g, direccion)
      .replace(/{telefono}/g, telefono)
      .replace(/{rating}/g, String(rating || 0))
      .replace(/{reviews}/g, String(reviews || 0))
      .replace(/{oportunidadScore}/g, String(oportunidadScore))
      .replace(/{sitioWeb}/g, sitioWeb || "Sin sitio web propio")
      .replace(/{siteUrl}/g, siteUrl || "Pendiente")
      .replace(/{problemas}/g, problemas.map((p, i) => `${i + 1}. ${p}`).join("\n"))
      .replace(/{paqueteNombre}/g, paquetePrincipal.nombre)
      .replace(/{paquetePrecio}/g, paquetePrincipal.precio)
      .replace(/{paqueteServicios}/g, paquetePrincipal.servicios.join(", "))
      .replace(/{paqueteRazon}/g, paquetePrincipal.razon)
      .replace(/{timeline}/g, timeline || "Fase 1: Web + IA WhatsApp (Sem 1-2) | Fase 2: Citas + CRM (Sem 3) | Fase 3: SEO + Ads (Mes 2)");

    // Generar slides estructuradas
    const slides: Slide[] = [
      {
        type: "cover",
        title: `Diagnóstico Digital para ${negocio}`,
        content: `Cómo multiplicar sus clientes con IA y Web moderna\n\nDigiMarket RD | ${new Date().toLocaleDateString("es-DO")}`,
      },
      {
        type: "diagnosis",
        title: `Situación Actual de ${negocio}`,
        content: `📍 ${direccion}\n🏷️ ${categoria || "No especificada"}\n⭐ ${rating || 0}★ (${reviews || 0} reseñas)\n📞 ${telefono}\n🌐 ${sitioWeb || "Sin sitio web propio"}\n🎯 Score Oportunidad: ${oportunidadScore}/100`,
        bulletPoints: [
          `Score de oportunidad: ${oportunidadScore}% de potencial sin explotar`,
          `${reviews > 0 ? `${reviews} reseñas = reputación base` : "0 reseñas = invisible en Maps"}`,
          sitioWeb ? "Tiene web pero no convierte" : "Sin web = no existe en búsquedas locales",
        ],
      },
      {
        type: "opportunity",
        title: `Oportunidad de Mercado: ${oportunidadScore}%`,
        content: `Su negocio está en el percentil ${oportunidadScore > 70 ? "alto" : oportunidadScore > 40 ? "medio" : "bajo"} de digitalización en su zona.`,
        bulletPoints: [
          "Competidores con Web + IA captan 3x más leads",
          "70% de búsquedas locales terminan en llamada/visita en 24h",
          "WhatsApp Business aumenta conversión 40% vs solo teléfono",
          "Sistema de citas reduce no-shows 60%",
        ],
      },
      {
        type: "problems",
        title: `Problemas Críticos Detectados`,
        content: `Análisis técnico + comercial revela ${problemas.length} brechas que frenan crecimiento:`,
        bulletPoints: problemas.slice(0, 6).map((p, i) => `${i + 1}. ${p}`),
      },
      {
        type: "solution",
        title: `Solución: ${paquetePrincipal.nombre}`,
        content: `Inversión: ${paquetePrincipal.precio}\n${paquetePrincipal.razon}`,
        bulletPoints: [
          ...paquetePrincipal.servicios.map(s => `✅ ${s}`),
          `💡 ROI estimado: 3-5x en 90 días`,
          `🚀 Implementación: ${timeline?.split("|")[0] || "2-3 semanas"}`,
        ],
      },
      {
        type: "timeline",
        title: `Plan de Acción - 3 Fases`,
        content: timeline || "Fase 1: Web + IA WhatsApp | Fase 2: Citas + CRM | Fase 3: SEO + Ads",
        bulletPoints: [
          "📅 FASE 1 (Sem 1-2): Sitio Astro 95+ PageSpeed + IA WhatsApp 24/7",
          "📅 FASE 2 (Sem 3): Agendamiento online + CRM WhatsApp activo",
          "📅 FASE 3 (Mes 2): SEO Local + Google Ads + Reporting mensual",
          "🎯 ENTREGABLES: Web live + CRM entrenado + Dashboard métricas",
        ],
      },
      {
        type: "contact",
        title: `Guiones de Primer Contacto`,
        content: `Tres canales, un mensaje: "Automatizamos su captación de clientes"`,
        bulletPoints: [
          "💬 WhatsApp: \"Hola {negocio}! Vimos su perfil en Google ({reviews} reseñas, ${rating}★). Le ayudamos a captar + clientes con Web + IA WhatsApp 24/7. ¿15 min para demo?\"",
          "📞 Llamada 30s: Hook (Google Maps) → Valor (Web+IA+Citas) → Cierre (Demo gratis)",
          "📧 Email: Asunto: 'Diagnóstico gratis para {negocio}' → 3 párrafos valor → CTA reunión",
        ],
      },
      {
        type: "closing",
        title: `¿Próximo Paso?`,
        content: `🎯 Agende 15 min para demo en vivo de su futuro sitio + IA WhatsApp\n\n📱 WhatsApp DigiMarket: +1 829-XXX-XXXX\n🌐 digimarketrd.2bd.net\n\n"Multiplicamos sus clientes mientras usted atiende su negocio"`,
        bulletPoints: [
          "✅ Demo gratis de su web personalizada",
          "✅ Prueba IA WhatsApp con sus FAQ reales",
          "✅ Presupuesto final sin compromiso",
        ],
      },
    ];

    // Generar prompt optimizado para NotebookLM
    const notebookPromptOptimized = `
# Propuesta Comercial - ${negocio}

## Contexto
Agencia: DigiMarket RD
Fecha: ${new Date().toLocaleDateString("es-DO")}
Prospecto: ${negocio} (${categoria}) - ${direccion}

## Datos de Entrada para NotebookLM
${JSON.stringify({
  negocio,
  categoria,
  direccion,
  telefono,
  rating,
  reviews,
  oportunidadScore,
  sitioWeb,
  siteUrl,
  problemas,
  paquete: paquetePrincipal,
  timeline,
}, null, 2)}

## Prompt para NotebookLM
${notebookPrompt}

## Slides Generadas (8)
${slides.map((s, i) => `${i + 1}. [${s.type.toUpperCase()}] ${s.title}\n${s.content}\n${s.bulletPoints?.map(b => `  • ${b}`).join("\n")}`).join("\n\n")}
`;

    return NextResponse.json({
      success: true,
      slides,
      propuesta: {
        negocio,
        categoria: categoria || "Negocio local",
        direccion,
        telefono,
        email,
        sitioWeb,
        siteUrl,
        rating,
        reviews,
        oportunidadScore,
        problemas,
        paquetesRecomendados,
        timeline: timeline || "Fase 1: Web + IA WhatsApp | Fase 2: Citas + CRM | Fase 3: SEO + Ads",
        contactoWhatsApp: contactoWhatsApp || telefono,
      },
      notebookPrompt: notebookPromptOptimized,
      mensaje: "Propuesta generada - 8 slides + prompt NotebookLM listo para copiar",
    });
  } catch (error) {
    console.error("Error generando propuesta:", error);
    return NextResponse.json(
      { error: "Error interno al generar propuesta" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return NextResponse.json({
    status: "online",
    mensaje: "Endpoint /api/propuesta activo - Genera 8 slides + prompt NotebookLM",
    flujo: "Caso 1 (análisis) → Caso 2 (siteUrl) → Caso 3 (CRM) → Caso 4 (propuesta)",
  });
}