import { NextRequest, NextResponse } from 'next/server';

const GEOAPIFY_API_KEY = 'a8b11066ecdd44c59d834fef15280d99';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, pageToken, languageCode = 'es', regionCode = 'DO' } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Debes proporcionar una consulta de búsqueda' }, { status: 400 });
    }

    // Geoapify Places API
    const geoapifyUrl = 'https://api.geoapify.com/v2/places';
    const params = new URLSearchParams({
      text: query,
      apiKey: GEOAPIFY_API_KEY,
      limit: '20',
      lang: languageCode || 'es',
      filter: regionCode ? `countrycode:${regionCode.toLowerCase()}` : '',
    });

    const res = await fetch(`${geoapifyUrl}?${params}`, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Error ${res.status} en Geoapify` }, { status: res.status });
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