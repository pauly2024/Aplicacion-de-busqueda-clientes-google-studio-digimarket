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
  'peluquería': ['service.hairdresser'],
  'peluquerías': ['service.hairdresser'],
  'barbería': ['service.barber'],
  'barberia': ['service.barber'],
  'barberías': ['service.barber'],
  'barberias': ['service.barber'],
  'estética': ['service.beauty'],
  'estetica': ['service.beauty'],
  'estéticas': ['service.beauty'],
  'esteticas': ['service.beauty'],
  'belleza': ['service.beauty'],
  'spa': ['service.spa'],
  'masaje': ['service.massage'],
  'masajes': ['service.massage'],

  // Automotriz
  'taller': ['service.car_repair'],
  'talleres': ['service.car_repair'],
  'mecánico': ['service.car_repair'],
  'mecanico': ['service.car_repair'],
  'mecánicos': ['service.car_repair'],
  'mecanicos': ['service.car_repair'],
  'mecánica': ['service.car_repair'],
  'mecanica': ['service.car_repair'],
  'automóvil': ['service.car_repair'],
  'automovil': ['service.car_repair'],
  'coche': ['service.car_repair'],
  'carro': ['service.car_repair'],
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

  // Profesionales
  'abogado': ['service.lawyer'],
  'abogados': ['service.lawyer'],
  'contador': ['service.accountant'],
  'contadores': ['service.accountant'],
  'arquitecto': ['service.architect'],
  'arquitectos': ['service.architect'],
  'ingeniero': ['service.engineer'],
  'ingenieros': ['service.engineer'],
  'inmobiliaria': ['service.real_estate'],
  'inmobiliarias': ['service.real_estate'],

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, pageToken, languageCode = 'es', regionCode = 'DO' } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Debes proporcionar una consulta de búsqueda' }, { status: 400 });
    }

    const categories = getCategoriesForQuery(query).join(',');
    
    // Coordenadas centro Puerto Plata para filtrar por radio
    const lat = 19.79;
    const lon = -70.69;
    const radius = 15000; // 15km

    const geoapifyUrl = 'https://api.geoapify.com/v2/places';
    const params = new URLSearchParams({
      categories,
      filter: `circle:${lon},${lat},${radius}`,
      limit: '20',
      lang: languageCode || 'es',
      apiKey: GEOAPIFY_API_KEY,
    });

    const res = await fetch(`${geoapifyUrl}?${params}`, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('Geoapify error:', res.status, errorText);
      return NextResponse.json({ error: `Error ${res.status} en Geoapify: ${errorText}` }, { status: res.status });
    }

    const data = await res.json();

    // Mapear resultados de Geoapify al formato que espera el frontend
    const places = (data.features || []).map((feature: any) => {
      const props = feature.properties;
      return {
        id: `geoapify-${props.place_id || feature.id || Math.random()}`,
        displayName: { text: props.name || 'Sin nombre' },
        formattedAddress: props.formatted || '',
        location: {
          latitude: props.lat,
          longitude: props.lon,
        },
        nationalPhoneNumber: props.phone || null,
        internationalPhoneNumber: props.phone || null,
        websiteUri: props.website || null,
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