import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, pageToken, languageCode = 'es', regionCode = 'DO' } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Debes proporcionar una consulta de búsqueda' }, { status: 400 });
    }

    // Nominatim (OpenStreetMap) - GRATIS, sin API key, sin billing
    const nominatimUrl = 'https://nominatim.openstreetmap.org/search';
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: '20',
      addressdetails: '1',
      extratags: '1',
      namedetails: '1',
      'accept-language': languageCode || 'es',
      countrycodes: regionCode?.toLowerCase() || 'do',
    });

    const res = await fetch(`${nominatimUrl}?${params}`, {
      headers: {
        'User-Agent': 'DigiMarket-Radar/1.0 (contacto@digimarketrd.com)',
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Error ${res.status} en Nominatim` }, { status: res.status });
    }

    const data = await res.json();

    // Mapear resultados de Nominatim al formato que espera el frontend
    const places = (data || []).map((item: any) => ({
      id: `osm-${item.place_id}`,
      displayName: { text: item.display_name?.split(',')[0] || 'Sin nombre' },
      formattedAddress: item.display_name || '',
      location: {
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
      },
      nationalPhoneNumber: item.extratags?.phone || null,
      internationalPhoneNumber: item.extratags?.phone || null,
      websiteUri: item.extratags?.website || item.extratags?.contact_website || null,
      rating: null,
      userRatingCount: null,
      primaryTypeDisplayName: { text: item.class || item.type || 'Negocio' },
      types: item.class ? [item.class] : [],
      googleMapsUri: `https://www.openstreetmap.org/?mlat=${item.lat}&mlon=${item.lon}#map=18/${item.lat}/${item.lon}`,
      businessStatus: 'OPERATIONAL',
    }));

    return NextResponse.json({
      places,
      nextPageToken: null,
    });
  } catch (err: any) {
    console.error('Error en /api/places (Nominatim):', err);
    return NextResponse.json(
      { error: err.message || 'Error inesperado al conectar con Nominatim' },
      { status: 500 }
    );
  }
}