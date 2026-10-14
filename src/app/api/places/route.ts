import { NextRequest, NextResponse } from 'next/server';

const GEOAPIFY_API_KEY = 'a8b11066ecdd44c59d834fef15280d99';

// Mapeo de términos de búsqueda a categorías de Geoapify (solo categorías válidas)
const QUERY_TO_CATEGORIES: Record<string, string[]> = {
  // Salud - usar healthcare general o subcategorías válidas
  'clínica': ['healthcare'],
  'clínicas': ['healthcare'],
  'dental': ['healthcare'],
  'dentista': ['healthcare'],
  'dentistas': ['healthcare'],
  'hospital': ['healthcare.hospital'],
  'hospitales': ['healthcare.hospital'],
  'farmacia': ['healthcare.pharmacy'],
  'farmacias': ['healthcare.pharmacy'],
  'laboratorio': ['healthcare'],
  'laboratorios': ['healthcare'],
  'fisioterapia': ['healthcare'],
  'fisioterapeuta': ['healthcare'],
  'fisioterapeutas': ['healthcare'],
  'médico': ['healthcare'],
  'médicos': ['healthcare'],
  'doctor': ['healthcare'],
  'doctores': ['healthcare'],
  'salud': ['healthcare'],

  // Comida
  'restaurante': ['catering.restaurant'],
  'restaurantes': ['catering.restaurant'],
  'comida': ['catering.restaurant'],
  'pizza': ['catering.restaurant'],
  'hamburguesa': ['catering.fast_food'],
  'hamburguesas': ['catering.fast_food'],
  'café': ['catering.cafe'],
  'cafe': ['catering.cafe'],
  'cafetería': ['catering.cafe'],
  'cafeteria': ['catering.cafe'],
  'bar': ['catering.bar'],
  'bars': ['catering.bar'],

  // Servicios personales
  'peluquería': ['service.beauty', 'service.hairdresser', 'service.barber'],
  'peluquerías': ['service.beauty', 'service.hairdresser', 'service.barber'],
  'barbería': ['service.barber', 'service.hairdresser'],
  'barberia': ['service.barber', 'service.hairdresser'],
  'barberías': ['service.barber', 'service.hairdresser'],
  'barberias': ['service.barber', 'service.hairdresser'],
  'estética': ['service.beauty'],
  'estetica': ['service.beauty'],
  'estéticas': ['service.beauty'],
  'esteticas': ['service.beauty'],
  'belleza': ['service.beauty'],
  'spa': ['service.spa'],
  'masaje': ['service.massage'],
  'masajes': ['service.massage'],

  // Automotriz
  'taller': ['service.vehicle.repair'],
  'talleres': ['service.vehicle.repair'],
  'mecánico': ['service.vehicle.repair'],
  'mecanico': ['service.vehicle.repair'],
  'mecánicos': ['service.vehicle.repair'],
  'mecanicos': ['service.vehicle.repair'],
  'mecánica': ['service.vehicle.repair'],
  'mecanica': ['service.vehicle.repair'],
  'automóvil': ['service.vehicle.repair'],
  'automovil': ['service.vehicle.repair'],
  'coche': ['service.vehicle.repair'],
  'carro': ['service.vehicle.repair'],
  'neumáticos': ['service.tyre'],

  // Hogar/Construcción
  'construcción': ['construction'],
  'construccion': ['construction'],
  'reformas': ['construction.renovation'],
  'plomero': ['service.plumber'],
  'plomeros': ['service.plumber'],
  'electricista': ['service.electrician'],
  'electricistas': ['service.electrician'],
  'pintor': ['service.painter'],
  'pintores': ['service.painter'],
  'cerrajero': ['service.locksmith'],
  'cerrajeros': ['service.locksmith'],

  // Profesionales - usar office.company (categoría válida)
  'abogado': ['office.company'],
  'abogados': ['office.company'],
  'contador': ['office.company'],
  'contadores': ['office.company'],
  'arquitecto': ['office.company'],
  'arquitectos': ['office.company'],
  'ingeniero': ['office.company'],
  'ingenieros': ['office.company'],
  'inmobiliaria': ['office.company'],
  'inmobiliarias': ['office.company'],

  // Educación
  'academia': ['education'],
  'academias': ['education'],
  'escuela': ['education.school'],
  'escuelas': ['education.school'],
  'colegio': ['education.school'],
  'colegios': ['education.school'],
  'universidad': ['education.university'],
  'universidades': ['education.university'],

  // Deportes/Fitness
  'gimnasio': ['sport.fitness_center'],
  'gimnasios': ['sport.fitness_center'],
  'gym': ['sport.fitness_center'],
  'fitness': ['sport.fitness_center'],

  // Compras
  'supermercado': ['commercial.supermarket'],
  'supermercados': ['commercial.supermarket'],
  'tienda': ['commercial'],
  'tiendas': ['commercial'],
  'centro comercial': ['commercial.shopping_mall'],
};

// Categorías amplias de fallback para búsquedas que no coinciden
const FALLBACK_CATEGORIES = [
  'commercial',
  'service',
  'healthcare',
  'catering',
  'education',
  'sport',
  'office',
  'construction',
  'building',
];

function getCategoriesForQuery(query: string): string[] {
  const lowerQuery = query.toLowerCase();
  
  // Buscar coincidencias exactas primero
  for (const [key, categories] of Object.entries(QUERY_TO_CATEGORIES)) {
    if (lowerQuery.includes(key)) {
      return categories;
    }
  }
  
  // Categorías por defecto para búsquedas genéricas
  return ['commercial', 'service', 'healthcare', 'catering', 'education', 'sport'];
}

async function searchWithCategories(categories: string[], lat: number, lon: number, radius: number, limit: number): Promise<any[]> {
  const categoriesParam = categories.join(',');
  const geoapifyUrl = 'https://api.geoapify.com/v2/places';
  const params = new URLSearchParams({
    categories: categories.join(','),
    filter: `circle:${lon},${lat},${radius}`,
    limit: limit.toString(),
    lang: 'es',
    apiKey: GEOAPIFY_API_KEY,
  });

  const res = await fetch(`https://api.geoapify.com/v2/places?${params.toString()}`, {
    headers: { 'Accept': 'application/json' },
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error('Geoapify error:', res.status, errorText);
    return [];
  }

  const data = await res.json();
  return data.features || [];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, pageToken, languageCode = 'es', regionCode = 'DO' } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Debes proporcionar una consulta de búsqueda' }, { status: 400 });
    }

    // Coordenadas centro Puerto Plata para filtrar por radio
    const lat = 19.79;
    const lon = -70.69;
    const radius = 20000; // 20km radio más amplio
    const limit = 50; // Máximo 50 en free tier

    const categories = getCategoriesForQuery(query);
    
    // Buscar con categorías específicas primero
    let allFeatures: any[] = [];
    let seenIds = new Set<string>();

    for (const category of categories) {
      const features = await searchWithCategories([category], 19.79, -70.69, 20000, 50);
      for (const feature of features) {
        const id = feature.properties.place_id || feature.id;
        if (!seenIds.has(id)) {
          seenIds.add(id);
          allFeatures.push(feature);
        }
        if (allFeatures.length >= 50) break;
      }
      if (allFeatures.length >= 50) break;
    }

    // Si no hay suficientes resultados, usar categorías amplias de fallback
    if (allFeatures.length < 10) {
      for (const fallbackCat of FALLBACK_CATEGORIES) {
        if (categories.includes(fallbackCat)) continue;
        const features = await searchWithCategories([fallbackCat], 19.79, -70.69, 25000, 50);
        for (const feature of features) {
          const id = feature.properties.place_id || feature.id;
          if (!seenIds.has(id)) {
            seenIds.add(id);
            allFeatures.push(feature);
          }
          if (allFeatures.length >= 50) break;
        }
        if (allFeatures.length >= 50) break;
      }
    }

    // Filtrar resultados: solo los que tengan nombre y información útil
    const filteredFeatures = allFeatures
      .filter((feature: any) => {
        const props = feature.properties;
        const name = props.name?.trim();
        return name && name.length > 1 && name !== 'Sin nombre';
      })
      .slice(0, 50);

    // Mapear resultados al formato que espera el frontend
    const places = filteredFeatures.map((feature: any) => {
      const props = feature.properties;
      return {
        id: `geoapify-${props.place_id || feature.id || Math.random()}`,
        displayName: { text: props.name || 'Sin nombre' },
        formattedAddress: props.formatted || '',
        location: {
          latitude: props.lat,
          longitude: props.lon,
        },
        nationalPhoneNumber: props.contact?.phone || props.phone || null,
        internationalPhoneNumber: props.contact?.phone || props.phone || null,
        websiteUri: props.website || props.contact?.website || null,
        rating: null,
        userRatingCount: null,
        primaryTypeDisplayName: { text: props.categories?.[0]?.split('.').pop() || 'Negocio' },
        types: props.categories || [],
        googleMapsUri: `https://www.openstreetmap.org/?mlat=${props.lat}&mlon=${props.lon}#map=18/${props.lat}/${props.lon}`,
        businessStatus: 'OPERATIONAL',
      };
    });

    return NextResponse.json({
      places,
      nextPageToken: null,
    });
  } catch (err: any) {
    console.error('Error en /api/places (Geoapify):', err);
    return NextResponse.json(
      { error: err.message || 'Error inesperado al conectar con Geoapify' },
      { status: 500 }
    );
  }
}