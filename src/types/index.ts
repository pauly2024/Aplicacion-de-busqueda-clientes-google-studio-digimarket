export type LeadStatus =
  | 'Nuevo'
  | 'Analizado'
  | 'Contactado'
  | 'Respondió'
  | 'Reunión'
  | 'Cliente'
  | 'Descartado';

export interface OpportunityFactor {
  label: string;
  points: number;
  positive: boolean;
}

export interface PageSpeedScores {
  performance: number;
  seo: number;
  accessibility: number;
  bestPractices: number;
  screenshot?: string;
  loadingExperience?: string;
}

export interface WebChecklist {
  https: boolean;
  mobileFriendly: boolean;
  whatsappButton: boolean;
  onlineBooking: boolean;
  contactForm: boolean;
  outdatedSignals: string;
}

export interface BusinessAnalysis {
  summary: string;
  pageSpeed: PageSpeedScores | null;
  checklist: WebChecklist;
  emails: string[];
  socials: string[];
  problems: string[];
  recommendedService: {
    service: string;
    reason: string;
  };
  drafts: {
    phoneScript: string;
    whatsapp: string;
    email: string;
  };
  analyzedAt: string;
}

export interface BusinessLead {
  id: string;
  displayName: string;
  formattedAddress: string;
  primaryTypeDisplayName?: string;
  types?: string[];
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  hasOwnWebsite: boolean;
  isSocialOrDirectory: boolean;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  businessStatus?: string;
  opportunityScore: number;
  opportunityBreakdown: OpportunityFactor[];
  status: LeadStatus;
  notes?: string;
  nextActionDate?: string;
  analysis?: BusinessAnalysis | null;
  createdAt: string;
  updatedAt: string;
}

export interface SellerProfile {
  name: string;
  companyName: string;
  phone: string;
  website: string;
  valueProposition: string;
  servicesOffered: string[];
  tone: 'cercano' | 'consultivo' | 'directo';
}

export interface AppSettings {
  googleMapsApiKey: string;
  geminiApiKey: string;
  placesCallsThisMonth: number;
  placesQuotaLimit: number;
  defaultRegion: string;
  sellerProfile: SellerProfile;
}

export interface NicheScanResult {
  category: string;
  totalFound: number;
  withoutOwnWebCount: number;
  withoutOwnWebPercent: number;
  averageRating: number;
  averageReviews: number;
  opportunityScore: number;
  geminiVerdict?: {
    rank: number;
    recommended: boolean;
    reason: string;
    serviceToSell: string;
  };
}

export interface SearchCacheItem {
  query: string;
  zone: string;
  niche: string;
  timestamp: number;
  leads: BusinessLead[];
  nextPageToken?: string;
}
