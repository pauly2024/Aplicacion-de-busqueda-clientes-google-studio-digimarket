import { NextRequest, NextResponse } from 'next/server';

const GEOAPIFY_API_KEY = process.env.GEOAPIFY_API_KEY || 'a8b11066ecdd44c59d834fef15280d99';
const GEOAPIFY_PLACES_URL = 'https://api.geoapify.com/v2/places';

const CATEGORY_MAP: Record<string, string> = {
  'talleres': 'service.vehicle.repair',
  'mecánicos': 'service.vehicle.repair',
  'clínicas': 'healthcare',
  'hospitales': 'healthcare.hospital',
  'farmacias': 'healthcare.pharmacy',
  'peluquerías': 'service.hairdresser',
  'barberías': 'service.barber',
  'belleza': 'service.beauty',
  'restaurantes': 'catering.restaurant',
  'comida rápida': 'catering.fast_food',
  'cafés': 'catering.cafe',
  'bares': 'catering.bar',
  'inmobiliarias': 'service.real_estate',
  'oficinas': 'office.company',
  'construcción': 'construction',
  'reformas': 'construction.renovation',
  'fontaneros': 'service.plumber',
  'electricistas': 'service.electrician',
  'pintores': 'service.painter',
  'cerrajeros': 'service.locksmith',
  'abogados': 'service.lawyer',
  'contadores': 'service.accountant',
  'arquitectos': 'service.architect',
  'ingenieros': 'service.engineer',
  'colegios': 'education.school',
  'universidades': 'education.university',
  'gimnasios': 'sport.fitness_center',
  'supermercados': 'commercial.supermarket',
  'centros comerciales': 'commercial.shopping_mall',
};

function getCategoryFromQuery(query: string): string {
  const lower = query.toLowerCase();
  for (const [keyword, category] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(keyword)) return category;
  }
  return 'commercial';
}

async function searchGeoapifyPlaces(
  query: string,
  regionCode: string = 'DO',
  languageCode: string = 'es',
  maxResults: number = 20
): Promise<any[]> {
  const category = getCategoryFromQuery(query);
  
  const params = new URLSearchParams({
    apiKey: GEOAPIFY_API_KEY,
    categories: category,
    limit: String(maxResults),
    lang: languageCode,
    bias: 'proximity:-70.69,19.79',
    filter: `countrycode:${regionCode.toLowerCase()}`,
  });

  const res = await fetch(`${GEOAPIFY_PLACES_URL}?${params.toString()}`);
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    console.error('Geoapify API error:', res.status, errorData);
    throw new Error(`Geoapify API: ${res.status} ${errorData.message || res.statusText}`);
  }

  const data = await res.json();
  return data.features || [];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, languageCode = 'es', regionCode = 'DO' } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Debes proporcionar una consulta de búsqueda' }, { status: 400 });
    }

    if (!GEOAPIFY_API_KEY) {
      return NextResponse.json(
        { error: 'API Key de Geoapify no configurada en el servidor' },
        { status: 500 }
      );
    }

    const places = await searchGeoapifyPlaces(query, regionCode, languageCode, 20);

    const formattedPlaces = places.map((place: any) => {
      const props = place.properties;
      return {
        id: `geoapify-${props.place_id || Math.random()}`,
        displayName: { text: props.name || 'Sin nombre' },
        formattedAddress: props.formatted || '',
        location: {
          latitude: props.lat,
          longitude: props.lon,
        },
        nationalPhoneNumber: props.contact?.phone || null,
        internationalPhoneNumber: props.contact?.phone || null,
        websiteUri: props.website || null,
        rating: props.rating || null,
        userRatingCount: null,
        primaryTypeDisplayName: { text: props.categories?.[0] || 'Negocio' },
        types: props.categories || [],
        googleMapsUri: props.datasource?.raw?.google_places?.url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(props.formatted || '')}`,
        businessStatus: 'OPERATIONAL',
      };
    });

    return NextResponse.json({
      places: formattedPlaces,
      nextPageToken: null,
    });
  } catch (err: any) {
    console.error('Error en /api/places (Geoapify):', err);
    return NextResponse.json(
      { error: err.message || 'Error inesperado al conectar con Geoapify API' },
      { status: 500 }
    );
  }
}