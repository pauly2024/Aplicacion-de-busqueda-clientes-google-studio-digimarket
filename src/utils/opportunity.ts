import { BusinessLead, OpportunityFactor, PageSpeedScores, WebChecklist } from '@/types';

// Detecta si una URL corresponde a una red social o directorio en vez de una web corporativa propia
export function isSocialOrDirectoryUrl(url?: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  const domains = [
    'facebook.com',
    'fb.me',
    'instagram.com',
    'instagr.am',
    'tiktok.com',
    'linktr.ee',
    'linktree',
    'wa.me',
    'paginasamarillas',
    'yelp.com',
    'foursquare.com',
    'tripadvisor',
    'guiasamarillas',
    'cylex',
    'europages',
    'einforma',
    'doctoralia',
    'infobel',
    'twitter.com',
    'x.com',
  ];
  return domains.some((d) => lower.includes(d));
}

// Determina si el negocio tiene una web propia real
export function checkHasOwnWebsite(websiteUri?: string): {
  hasOwnWebsite: boolean;
  isSocialOrDirectory: boolean;
} {
  if (!websiteUri || websiteUri.trim() === '') {
    return { hasOwnWebsite: false, isSocialOrDirectory: false };
  }
  const isSocial = isSocialOrDirectoryUrl(websiteUri);
  return {
    hasOwnWebsite: !isSocial,
    isSocialOrDirectory: isSocial,
  };
}

// Calcula la puntuación de oportunidad provisional o definitiva con su desglose
export function calculateOpportunityScore(
  lead: Partial<BusinessLead>,
  pageSpeed?: PageSpeedScores | null,
  checklist?: WebChecklist | null
): { score: number; breakdown: OpportunityFactor[] } {
  const breakdown: OpportunityFactor[] = [];
  let score = 20; // Puntuación base neutral

  const { hasOwnWebsite, isSocialOrDirectory } = checkHasOwnWebsite(lead.websiteUri);

  // 1. Web propia vs Sin web vs Redes sociales
  if (!lead.websiteUri || lead.websiteUri.trim() === '') {
    score += 40;
    breakdown.push({
      label: 'Sin presencia web (Oportunidad máxima para desarrollo web)',
      points: 40,
      positive: true,
    });
  } else if (isSocialOrDirectory) {
    score += 35;
    breakdown.push({
      label: 'Usa redes sociales/directorio en vez de web propia',
      points: 35,
      positive: true,
    });
  } else {
    breakdown.push({
      label: 'Tiene sitio web propio',
      points: -5,
      positive: false,
    });
    score -= 5;
  }

  // 2. Actividad y Reputación (negocio activo que factura)
  const reviews = lead.userRatingCount || 0;
  const rating = lead.rating || 0;

  if (reviews >= 50) {
    score += 20;
    breakdown.push({
      label: `Negocio muy activo y con alta afluencia (${reviews} reseñas)`,
      points: 20,
      positive: true,
    });
  } else if (reviews >= 15) {
    score += 10;
    breakdown.push({
      label: `Actividad moderada (${reviews} reseñas)`,
      points: 10,
      positive: true,
    });
  } else if (reviews < 5) {
    score -= 10;
    breakdown.push({
      label: `Baja actividad registrada en Google Maps (${reviews} reseñas)`,
      points: -10,
      positive: false,
    });
  }

  if (rating >= 4.2) {
    score += 10;
    breakdown.push({
      label: `Excelente reputación de clientes (${rating.toFixed(1)} ★)`,
      points: 10,
      positive: true,
    });
  } else if (rating > 0 && rating < 3.5) {
    score -= 5;
    breakdown.push({
      label: `Valoración regular (${rating.toFixed(1)} ★)`,
      points: -5,
      positive: false,
    });
  }

  // 3. Facilidad de contacto
  if (lead.nationalPhoneNumber || lead.internationalPhoneNumber) {
    score += 5;
    breakdown.push({
      label: 'Teléfono directo disponible para prospección',
      points: 5,
      positive: true,
    });
  }

  // 4. Auditoría técnica si ya se analizó la web
  if (pageSpeed) {
    if (pageSpeed.performance < 50) {
      score += 20;
      breakdown.push({
        label: `Rendimiento móvil deficiente (${pageSpeed.performance}/100 PageSpeed)`,
        points: 20,
        positive: true,
      });
    } else if (pageSpeed.performance > 85) {
      score -= 20;
      breakdown.push({
        label: `Web móvil ya optimizada (${pageSpeed.performance}/100 PageSpeed)`,
        points: -20,
        positive: false,
      });
    }
  }

  if (checklist) {
    if (!checklist.whatsappButton) {
      score += 10;
      breakdown.push({
        label: 'No cuenta con botón directo de WhatsApp para clientes',
        points: 10,
        positive: true,
      });
    }
    if (!checklist.onlineBooking) {
      score += 10;
      breakdown.push({
        label: 'Carece de sistema de citas / reservas online',
        points: 10,
        positive: true,
      });
    }
    if (checklist.outdatedSignals) {
      score += 10;
      breakdown.push({
        label: `Señales de desactualización: ${checklist.outdatedSignals}`,
        points: 10,
        positive: true,
      });
    }
  }

  // Limitar entre 0 y 100
  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  return { score: finalScore, breakdown };
}
