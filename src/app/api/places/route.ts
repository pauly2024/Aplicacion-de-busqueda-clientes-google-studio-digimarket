import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, pageToken, languageCode = 'es', regionCode = 'DO', apiKey: clientKey } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Debes proporcionar una consulta de búsqueda' }, { status: 400 });
    }

    const apiKey = clientKey || process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            'Falta la clave de Google Cloud para Places API. Configúrala en Ajustes o en el archivo de entorno.',
        },
        { status: 400 }
      );
    }

    const url = 'https://places.googleapis.com/v1/places:searchText';

    const fieldMask = [
      'places.id',
      'places.displayName',
      'places.formattedAddress',
      'places.location',
      'places.nationalPhoneNumber',
      'places.internationalPhoneNumber',
      'places.websiteUri',
      'places.rating',
      'places.userRatingCount',
      'places.primaryTypeDisplayName',
      'places.types',
      'places.googleMapsUri',
      'places.businessStatus',
      'nextPageToken',
    ].join(',');

    const requestPayload: Record<string, any> = {
      textQuery: query,
      languageCode: languageCode || 'es',
      pageSize: 20,
    };

    if (regionCode) {
      requestPayload.regionCode = regionCode;
    }

    if (pageToken) {
      requestPayload.pageToken = pageToken;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': fieldMask,
      },
      body: JSON.stringify(requestPayload),
    });

    const data = await res.json();

    if (!res.ok) {
      const errorMsg = data?.error?.message || data?.error?.status || `Error ${res.status} al consultar Google Places`;
      return NextResponse.json({ error: errorMsg, details: data }, { status: res.status });
    }

    return NextResponse.json({
      places: data.places || [],
      nextPageToken: data.nextPageToken || null,
    });
  } catch (err: any) {
    console.error('Error en /api/places:', err);
    return NextResponse.json(
      { error: err.message || 'Error inesperado al conectar con Places API' },
      { status: 500 }
    );
  }
}
