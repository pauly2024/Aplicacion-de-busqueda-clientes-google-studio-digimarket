import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY;

// Google Places API (New) - Text Search
// Docs: https://developers.google.com/maps/documentation/places/web-service/text-search
const GOOGLE_PLACES_URL = 'https://places.googleapis.com/v1/places:searchText';

// Campos que queremos recibir (optimiza costo y latencia)
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
  'places.googleMapsUri',
  'places.businessStatus',
  'places.types',
  'places.primaryTypeDisplayName',
].join(',');

async function searchGooglePlaces(query: string, regionCode: string = 'DO', languageCode: string = 'es', maxResults: number = 20): Promise<any[]> {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error('GOOGLE_MAPS_API_KEY no configurada en variables de entorno');
  }

  const body = {
    textQuery: query,
    languageCode,
    regionCode,
    maxResultCount: maxResults,
    // Opcional: bias por ubicación (centro Puerto Plata)
    locationBias: {
      circle: {
        center: { latitude: 19.79, longitude: -70.69 },
        radius: 25000.0, // 25km
      },
    },
  };

  const res = await fetch(GOOGLE_PLACES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    console.error('Google Places API error:', res.status, errorData);
    throw new Error(`Google Places API: ${res.status} ${errorData.error?.message || res.statusText}`);
  }

  const data = await res.json();
  return data.places || [];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, languageCode = 'es', regionCode = 'DO' } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Debes proporcionar una consulta de búsqueda' }, { status: 400 });
    }

    if (!GOOGLE_MAPS_API_KEY) {
      return NextResponse.json(
        { error: 'API Key de Google Maps no configurada en el servidor' },
        { status: 500 }
      );
    }

    const places = await searchGooglePlaces(query, regionCode, languageCode, 20);

    // Mapear resultados al formato que espera el frontend
    const formattedPlaces = places.map((place: any) => ({
      id: `google-${place.id || Math.random()}`,
      displayName: { text: place.displayName?.text || 'Sin nombre' },
      formattedAddress: place.formattedAddress || '',
      location: {
        latitude: place.location?.latitude,
        longitude: place.location?.longitude,
      },
      nationalPhoneNumber: place.nationalPhoneNumber || null,
      internationalPhoneNumber: place.internationalPhoneNumber || null,
      websiteUri: place.websiteUri || null,
      rating: place.rating || null,
      userRatingCount: place.userRatingCount || null,
      primaryTypeDisplayName: { text: place.primaryTypeDisplayName?.text || place.types?.[0] || 'Negocio' },
      types: place.types || [],
      googleMapsUri: place.googleMapsUri || `https://www.google.com/maps/place/?q=place_id:${place.id}`,
      businessStatus: place.businessStatus || 'OPERATIONAL',
    }));

    return NextResponse.json({
      places: formattedPlaces,
      nextPageToken: null, // Google Places New no usa pageToken en searchText
    });
  } catch (err: any) {
    console.error('Error en /api/places (Google Places):', err);
    return NextResponse.json(
      { error: err.message || 'Error inesperado al conectar con Google Places API' },
      { status: 500 }
    );
  }
}