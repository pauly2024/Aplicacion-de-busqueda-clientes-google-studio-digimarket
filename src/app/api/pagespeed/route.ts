import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, apiKey: clientKey } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL requerida para auditar PageSpeed' }, { status: 400 });
    }

    const apiKey = clientKey || process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY;

    let targetUrl = url.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = `https://${targetUrl}`;
    }

    // Construimos la URL de PageSpeed v5
    const categories = ['performance', 'seo', 'accessibility', 'best-practices'];
    const queryParams = new URLSearchParams({
      url: targetUrl,
      strategy: 'mobile',
    });

    categories.forEach((cat) => queryParams.append('category', cat));
    if (apiKey) {
      queryParams.append('key', apiKey);
    }

    const apiUrl = `https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed?${queryParams.toString()}`;

    const res = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    const data = await res.json();

    if (!res.ok) {
      const errorMsg =
        data?.error?.message || `Error ${res.status} al consultar PageSpeed Insights`;
      return NextResponse.json({ error: errorMsg, details: data }, { status: res.status });
    }

    const lighthouse = data.lighthouseResult;
    const cats = lighthouse?.categories || {};

    const performance = Math.round((cats.performance?.score || 0) * 100);
    const seo = Math.round((cats.seo?.score || 0) * 100);
    const accessibility = Math.round((cats.accessibility?.score || 0) * 100);
    const bestPractices = Math.round((cats['best-practices']?.score || 0) * 100);

    const screenshot =
      lighthouse?.audits?.['final-screenshot']?.details?.data ||
      lighthouse?.fullPageScreenshot?.screenshot?.data ||
      null;

    const fcp = lighthouse?.audits?.['first-contentful-paint']?.displayValue || null;
    const lcp = lighthouse?.audits?.['largest-contentful-paint']?.displayValue || null;
    const cls = lighthouse?.audits?.['cumulative-layout-shift']?.displayValue || null;

    return NextResponse.json({
      performance,
      seo,
      accessibility,
      bestPractices,
      screenshot,
      metrics: { fcp, lcp, cls },
      analyzedUrl: targetUrl,
    });
  } catch (err: any) {
    console.error('Error en /api/pagespeed:', err);
    return NextResponse.json(
      { error: err.message || 'Error inesperado al auditar con PageSpeed' },
      { status: 500 }
    );
  }
}
