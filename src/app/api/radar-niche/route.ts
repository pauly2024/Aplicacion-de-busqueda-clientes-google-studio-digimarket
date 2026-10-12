import { NextRequest, NextResponse } from 'next/server';
import { NicheScanResult } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { zone, scanResults, apiKey: clientKey } = body;

    if (!zone || !Array.isArray(scanResults)) {
      return NextResponse.json({ error: 'Faltan parámetros requeridos' }, { status: 400 });
    }

    const apiKey = clientKey || process.env.GEMINI_API_KEY;

    // Si tenemos clave de Gemini, le pedimos un análisis estratégico y ranking
    if (apiKey) {
      try {
        const prompt = `Actúa como estratega de negocios y prospección B2B para una agencia digital (DigiMarket RD).
Hemos analizado la zona geográfica de "${zone}" y recopilado datos reales de Google Maps para las siguientes categorías de negocios:

${JSON.stringify(scanResults, null, 2)}

INSTRUCCIONES:
1. Analiza los datos de cada categoría (volumen de negocios, % de negocios sin página web propia, reputación media y volumen de reseñas).
2. Recuerda que un nicho es más lucrativo si hay muchos negocios con alta afluencia (muchas reseñas) pero un alto % SIN sitio web propia o con digitalización precaria.
3. Clasifica las categorías de mejor a peor oportunidad comercial.
4. Selecciona exactamente las 3 MEJORES categorías recomendadas (poniendo "recommended": true en esas 3).
5. Para cada una, explica la razón comercial y qué servicio digital vender (ej. Páginas Web de Alta Conversión, Agentes de IA por WhatsApp, Sistemas de Citas y Reservas, Optimización de Ficha de Google).

Responde ÚNICAMENTE un array JSON válido con este formato:
[
  {
    "category": "Nombre de la categoría",
    "rank": 1,
    "recommended": true,
    "reason": "Explicación concisa y persuasiva...",
    "serviceToSell": "Servicio digital recomendado de DigiMarket"
  },
  ...
]`;

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        const res = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              response_mime_type: 'application/json',
              temperature: 0.2,
            },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (raw) {
            const parsed = JSON.parse(raw);
            return NextResponse.json({ rankings: parsed });
          }
        }
      } catch (e) {
        console.warn('Error en llamada Gemini para nichos:', e);
      }
    }

    // Respaldo heurístico si no hay Gemini o falla
    // Ordenamos por oportunidad ponderada: (% sin web * 0.6) + (media reseñas * 0.4)
    const sorted = [...scanResults].sort((a: NicheScanResult, b: NicheScanResult) => {
      const scoreA = a.withoutOwnWebPercent * 1.5 + Math.min(50, a.averageReviews);
      const scoreB = b.withoutOwnWebPercent * 1.5 + Math.min(50, b.averageReviews);
      return scoreB - scoreA;
    });

    const rankings = sorted.map((item: NicheScanResult, idx: number) => ({
      category: item.category,
      rank: idx + 1,
      recommended: idx < 3,
      reason:
        item.withoutOwnWebPercent > 40
          ? `Alta tasa de negocios sin web propia (${item.withoutOwnWebPercent}%) y fuerte afluencia de clientes.`
          : `Sector activo con ${item.averageReviews} reseñas promedio y clientes frecuentes que requieren citas.`,
      serviceToSell:
        item.withoutOwnWebPercent > 40
          ? 'Página Web de Alta Conversión con WhatsApp'
          : 'Agente de IA para WhatsApp 24/7 y Sistema de Reservas',
    }));

    return NextResponse.json({ rankings });
  } catch (err: any) {
    console.error('Error en /api/radar-niche:', err);
    return NextResponse.json(
      { error: err.message || 'Error al procesar radar de nichos' },
      { status: 500 }
    );
  }
}
