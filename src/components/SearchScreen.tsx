'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Phone,
  Globe,
  MapPin,
  Star,
  ExternalLink,
  Save,
  Cpu,
  Loader2,
  CheckSquare,
  Square,
  LayoutGrid,
  Table as TableIcon,
  ChevronDown,
  Info,
  CheckCircle2,
  AlertCircle,
  Database,
} from 'lucide-react';
import { AppSettings, BusinessLead } from '@/types';
import { calculateOpportunityScore, checkHasOwnWebsite } from '@/utils/opportunity';
import { Storage } from '@/utils/storage';

const ALL_NICHES = [
  'talleres mecánicos',
  'clínicas dentales',
  'fisioterapeutas',
  'peluquerías',
  'centros de estética',
  'restaurantes',
  'gimnasios',
  'academias',
  'inmobiliarias',
  'reformas',
  'veterinarios',
  'autoescuelas',
  'ópticas',
  'gestorías',
];

interface SearchScreenProps {
  settings: AppSettings;
  onOpenLead: (lead: BusinessLead) => void;
  onSaveLeadsBatch: (leads: BusinessLead[]) => void;
  onUpdateSettings: (settings: AppSettings) => void;
}

export function SearchScreen({
  settings,
  onOpenLead,
  onSaveLeadsBatch,
  onUpdateSettings,
}: SearchScreenProps) {
  const [zone, setZone] = useState('Puerto Plata');
  const [niche, setNiche] = useState('talleres mecánicos');
  const [region, setRegion] = useState(settings.defaultRegion || 'DO');

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const [leads, setLeads] = useState<BusinessLead[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [totalFetched, setTotalFetched] = useState(0);

  // Filtros
  const [filterOnlyNoWeb, setFilterOnlyNoWeb] = useState(false);
  const [filterOnlyWithPhone, setFilterOnlyWithPhone] = useState(false);
  const [filterMinRating, setFilterMinRating] = useState<number>(0);
  const [filterMinReviews, setFilterMinReviews] = useState<number>(0);
  const [filterHideClosed, setFilterHideClosed] = useState(true);

  // Selección y vista
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [batchAnalyzing, setBatchAnalyzing] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [scoreModalLead, setScoreModalLead] = useState<BusinessLead | null>(null);

  // Ejecuta la búsqueda
  const handleSearch = async (isLoadMore: boolean = false) => {
    if (!zone.trim() || !niche.trim()) {
      setError('Escribe una zona y un nicho para buscar');
      return;
    }

    const query = `${niche.trim()} en ${zone.trim()}`;
    const cacheKey = `${query}_${region}`.toLowerCase();

    // Si es primera búsqueda, verificamos caché
    if (!isLoadMore) {
      const cached = Storage.getCache(cacheKey);
      if (cached && cached.leads.length > 0) {
        setLeads(cached.leads);
        setNextPageToken(cached.nextPageToken || null);
        setTotalFetched(cached.leads.length);
        setFromCache(true);
        setError(null);
        setSelectedIds(new Set());
        return;
      }
    }

    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setError(null);
      setFromCache(false);
      setSelectedIds(new Set());
    }

    try {
      const res = await fetch('/api/places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          languageCode: 'es',
          regionCode: region,
          pageToken: isLoadMore ? nextPageToken : undefined,
          apiKey: settings.googleMapsApiKey || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al buscar en Google Places');
      }

      // Convertir lugares a BusinessLead con OpportunityScore provisional
      const placesRaw = data.places || [];
      const newLeads: BusinessLead[] = placesRaw.map((p: any) => {
        const { hasOwnWebsite, isSocialOrDirectory } = checkHasOwnWebsite(p.websiteUri);
        const displayName = p.displayName?.text || p.displayName || 'Negocio Local';
        const primaryType =
          p.primaryTypeDisplayName?.text ||
          p.primaryTypeDisplayName ||
          (p.types && p.types[0]?.replace(/_/g, ' ')) ||
          niche;

        const provisionalCalc = calculateOpportunityScore({
          websiteUri: p.websiteUri,
          rating: p.rating,
          userRatingCount: p.userRatingCount,
          nationalPhoneNumber: p.nationalPhoneNumber || p.internationalPhoneNumber,
        });

        return {
          id: p.id || `place_${Math.random().toString(36).substring(2, 9)}`,
          displayName,
          formattedAddress: p.formattedAddress || 'Dirección no disponible',
          primaryTypeDisplayName: primaryType,
          types: p.types || [],
          nationalPhoneNumber: p.nationalPhoneNumber || p.internationalPhoneNumber || '',
          internationalPhoneNumber: p.internationalPhoneNumber || '',
          websiteUri: p.websiteUri || '',
          hasOwnWebsite,
          isSocialOrDirectory,
          rating: p.rating || 0,
          userRatingCount: p.userRatingCount || 0,
          googleMapsUri: p.googleMapsUri || '',
          businessStatus: p.businessStatus || 'OPERATIONAL',
          opportunityScore: provisionalCalc.score,
          opportunityBreakdown: provisionalCalc.breakdown,
          status: 'Nuevo' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });

      // Incrementar contador de llamadas en settings
      const newCalls = Storage.incrementPlacesCalls(1);
      onUpdateSettings({ ...settings, placesCallsThisMonth: newCalls });

      if (isLoadMore) {
        const combined = [...leads, ...newLeads];
        setLeads(combined);
        setTotalFetched(combined.length);
      } else {
        setLeads(newLeads);
        setTotalFetched(newLeads.length);
        // Guardar en caché primera página
        Storage.setCache(cacheKey, {
          query,
          zone,
          niche,
          timestamp: Date.now(),
          leads: newLeads,
          nextPageToken: data.nextPageToken || undefined,
        });
      }

      setNextPageToken(data.nextPageToken || null);
    } catch (err: any) {
      console.error('Error buscando:', err);
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Filtrado reactivo en cliente
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (filterOnlyNoWeb && lead.hasOwnWebsite) return false;
      if (filterOnlyWithPhone && !lead.nationalPhoneNumber) return false;
      if (filterMinRating > 0 && (lead.rating || 0) < filterMinRating) return false;
      if (filterMinReviews > 0 && (lead.userRatingCount || 0) < filterMinReviews) return false;
      if (filterHideClosed && lead.businessStatus === 'CLOSED_PERMANENTLY') return false;
      return true;
    });
  }, [leads, filterOnlyNoWeb, filterOnlyWithPhone, filterMinRating, filterMinReviews, filterHideClosed]);

  // Selección múltiple
  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredLeads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLeads.map((l) => l.id)));
    }
  };

  const handleSaveSelected = () => {
    const selected = leads.filter((l) => selectedIds.has(l.id));
    if (selected.length === 0) return;
    onSaveLeadsBatch(selected);
    setSelectedIds(new Set());
  };

  // Análisis por lotes (de 2 en 2 máximo según reglas)
  const handleBatchAnalyze = async () => {
    const toAnalyze = leads.filter((l) => selectedIds.has(l.id));
    if (toAnalyze.length === 0) return;

    setBatchAnalyzing(true);
    setBatchProgress({ current: 0, total: toAnalyze.length });

    const updatedMap = new Map<string, BusinessLead>();

    // Procesamos en trozos de 2
    for (let i = 0; i < toAnalyze.length; i += 2) {
      const chunk = toAnalyze.slice(i, i + 2);

      await Promise.all(
        chunk.map(async (lead) => {
          try {
            let pageSpeedData = null;
            if (lead.hasOwnWebsite && lead.websiteUri) {
              const psRes = await fetch('/api/pagespeed', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  url: lead.websiteUri,
                  apiKey: settings.googleMapsApiKey || undefined,
                }),
              });
              if (psRes.ok) {
                pageSpeedData = await psRes.json();
              }
            }

            const aiRes = await fetch('/api/analyze-web', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                url: lead.websiteUri,
                businessName: lead.displayName,
                businessCategory: lead.primaryTypeDisplayName,
                address: lead.formattedAddress,
                phone: lead.nationalPhoneNumber,
                rating: lead.rating,
                userRatingCount: lead.userRatingCount,
                sellerProfile: settings.sellerProfile,
                apiKey: settings.nvidiaApiKey || undefined,
                pageSpeedScores: pageSpeedData,
              }),
            });

            if (aiRes.ok) {
              const aiData = await aiRes.json();
              const fullCalc = calculateOpportunityScore(lead, pageSpeedData, aiData.checklist);

              const updated: BusinessLead = {
                ...lead,
                opportunityScore: fullCalc.score,
                opportunityBreakdown: fullCalc.breakdown,
                status: 'Analizado',
                analysis: {
                  summary: aiData.summary,
                  pageSpeed: pageSpeedData,
                  checklist: aiData.checklist,
                  emails: aiData.emails || [],
                  socials: aiData.socials || [],
                  problems: aiData.problems || [],
                  recommendedService: aiData.recommendedService,
                  drafts: aiData.drafts,
                  analyzedAt: new Date().toISOString(),
                },
                updatedAt: new Date().toISOString(),
              };

              updatedMap.set(lead.id, updated);
              Storage.addOrUpdateLead(updated);
            }
          } catch (e) {
            console.error('Error analizando lead en lote:', e);
          }
        })
      );

      setBatchProgress({
        current: Math.min(toAnalyze.length, i + 2),
        total: toAnalyze.length,
      });
    }

    // Actualizar estado general
    setLeads((prev) => prev.map((l) => updatedMap.get(l.id) || l));
    setBatchAnalyzing(false);
    setBatchProgress(null);
    setSelectedIds(new Set());
  };

  const getScoreBadgeClass = (score: number) => {
    if (score >= 70) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (score >= 45) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <span>Buscador de Leads</span>
            <span className="text-xs px-2.5 py-1 bg-gradient-to-r from-orange-500 to-amber-500 text-black font-extrabold rounded-lg uppercase tracking-wider">
              Radar Comercial
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Encuentra negocios en Google Maps, detecta sus carencias digitales y genera propuestas automáticas.
          </p>
        </div>

        {fromCache && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-cyan-950/40 border border-cyan-500/30 rounded-xl text-cyan-400 text-xs">
            <Database className="w-3.5 h-3.5" />
            <span>Resultados desde caché local (0 llamadas a la API)</span>
          </div>
        )}
      </div>

      {/* Main Search Bar Card */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Zona */}
          <div className="md:col-span-5">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Zona (Ciudad, Municipio o Código Postal)
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-orange-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                placeholder="Ej: Santo Domingo, Santiago, Sevilla..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-white text-sm focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Nicho */}
          <div className="md:col-span-5">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Nicho o Sector Comercial
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-orange-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="Ej: talleres mecánicos, clínicas dentales..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-white text-sm focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Región */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              País
            </label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-white text-sm focus:border-orange-500 focus:outline-none"
            >
              <option value="DO">🇩🇴 Rep. Dominicana (DO)</option>
              <option value="ES">🇪🇸 España (ES)</option>
              <option value="US">🇺🇸 Estados Unidos (US)</option>
              <option value="MX">🇲🇽 México (MX)</option>
              <option value="CO">🇨🇴 Colombia (CO)</option>
            </select>
          </div>
        </div>

        {/* Zone Quick Chips */}
        <div>
          <div className="text-xs font-semibold text-slate-400 mb-2">Zonas objetivo (Rep. Dominicana):</div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {[
              { label: '🌊 Puerto Plata', value: 'Puerto Plata' },
              { label: '🏙️ Santiago de los Caballeros', value: 'Santiago de los Caballeros' },
              { label: '🌴 Sosúa', value: 'Sosúa, Puerto Plata' },
              { label: '🏖️ Cabarete', value: 'Cabarete, Puerto Plata' },
              { label: '🏡 San Felipe de Puerto Plata', value: 'San Felipe de Puerto Plata' },
              { label: '🏢 Santiago Centro', value: 'Santiago, República Dominicana' },
            ].map((z) => (
              <button
                key={z.value}
                onClick={() => setZone(z.value)}
                className={`text-xs px-2.5 py-1 rounded-lg transition-all ${
                  zone === z.value
                    ? 'bg-cyan-500 text-black font-bold shadow'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {z.label}
              </button>
            ))}
          </div>
        </div>

        {/* All Niches Included in Search */}
        <div>
          <div className="text-xs font-semibold text-slate-400 mb-2">Nichos incluidos en la búsqueda (click para filtrar):</div>
          <div className="flex flex-wrap gap-1.5">
            {ALL_NICHES.map((item) => (
              <button
                key={item}
                onClick={() => setNiche(item)}
                className={`text-xs px-2.5 py-1 rounded-lg transition-all ${
                  niche.toLowerCase() === item.toLowerCase()
                    ? 'bg-orange-500 text-black font-bold shadow'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {/* Filters and Actions */}
        <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer bg-slate-950/80 px-2.5 py-1.5 rounded-lg border border-slate-800 text-slate-300">
              <input
                type="checkbox"
                checked={filterOnlyNoWeb}
                onChange={(e) => setFilterOnlyNoWeb(e.target.checked)}
                className="rounded accent-orange-500"
              />
              <span>Solo sin web propia</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer bg-slate-950/80 px-2.5 py-1.5 rounded-lg border border-slate-800 text-slate-300">
              <input
                type="checkbox"
                checked={filterOnlyWithPhone}
                onChange={(e) => setFilterOnlyWithPhone(e.target.checked)}
                className="rounded accent-orange-500"
              />
              <span>Solo con teléfono</span>
            </label>

            <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1.5 rounded-lg border border-slate-800 text-slate-300">
              <span>Rating mín:</span>
              <select
                value={filterMinRating}
                onChange={(e) => setFilterMinRating(parseFloat(e.target.value))}
                className="bg-transparent text-white font-bold focus:outline-none"
              >
                <option value={0}>Todos</option>
                <option value={3.5}>3.5+ ★</option>
                <option value={4.0}>4.0+ ★</option>
                <option value={4.5}>4.5+ ★</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1.5 rounded-lg border border-slate-800 text-slate-300">
              <span>Mín. reseñas:</span>
              <select
                value={filterMinReviews}
                onChange={(e) => setFilterMinReviews(parseInt(e.target.value, 10))}
                className="bg-transparent text-white font-bold focus:outline-none"
              >
                <option value={0}>Cualquiera</option>
                <option value={10}>10+</option>
                <option value={25}>25+</option>
                <option value={50}>50+</option>
              </select>
            </div>
          </div>

          <button
            onClick={() => handleSearch(false)}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-black font-extrabold text-sm shadow-lg shadow-orange-500/20 transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>Buscar Negocios</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
          <div>
            <div className="font-bold">Aviso de la API:</div>
            <div>{error}</div>
          </div>
        </div>
      )}

      {/* Results Header & Batch Toolbar */}
      {leads.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center gap-4 text-xs">
            <button
              onClick={handleSelectAll}
              className="flex items-center gap-1.5 text-slate-300 hover:text-white font-semibold"
            >
              {selectedIds.size === filteredLeads.length ? (
                <CheckSquare className="w-4 h-4 text-orange-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-500" />
              )}
              <span>
                Seleccionar todo ({selectedIds.size}/{filteredLeads.length})
              </span>
            </button>

            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2 pl-4 border-l border-slate-800">
                <button
                  onClick={handleSaveSelected}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 border border-orange-500/30 font-semibold"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Guardar en Mis Leads ({selectedIds.size})</span>
                </button>

                <button
                  onClick={handleBatchAnalyze}
                  disabled={batchAnalyzing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/30 font-semibold disabled:opacity-50"
                >
                  {batchAnalyzing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Cpu className="w-3.5 h-3.5" />
                  )}
                  <span>Analizar con IA ({selectedIds.size})</span>
                </button>
              </div>
            )}
          </div>

          {/* Toggle View Mode */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">
              Mostrando {filteredLeads.length} de {leads.length} encontrados
            </span>
            <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md ${
                  viewMode === 'grid' ? 'bg-orange-500 text-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md ${
                  viewMode === 'table' ? 'bg-orange-500 text-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                <TableIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Analysis Progress Bar */}
      {batchAnalyzing && batchProgress && (
        <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/30 text-cyan-300 text-xs space-y-2">
          <div className="flex items-center justify-between font-bold">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
              <span>Analizando webs de 2 en 2 con PageSpeed y NVIDIA NIM...</span>
            </div>
            <span>
              {batchProgress.current} de {batchProgress.total} completados
            </span>
          </div>
          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
            <div
              className="bg-cyan-400 h-full transition-all duration-300"
              style={{
                width: `${Math.round((batchProgress.current / batchProgress.total) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Results View: Grid or Table */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLeads.map((lead) => {
            const isSelected = selectedIds.has(lead.id);
            return (
              <div
                key={lead.id}
                className={`p-5 rounded-2xl bg-slate-900/80 border transition-all hover:border-orange-500/40 relative flex flex-col justify-between ${
                  isSelected ? 'border-orange-500 ring-1 ring-orange-500/50 bg-slate-900' : 'border-slate-800'
                }`}
              >
                <div>
                  {/* Top Bar: Select checkbox & Score */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <button
                      onClick={() => handleToggleSelect(lead.id)}
                      className="p-1 -ml-1 text-slate-400 hover:text-white"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-orange-400" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-600" />
                      )}
                    </button>

                    <button
                      onClick={() => setScoreModalLead(lead)}
                      className={`px-2.5 py-1 rounded-lg border text-xs font-black flex items-center gap-1.5 transition-all hover:scale-105 ${getScoreBadgeClass(
                        lead.opportunityScore
                      )}`}
                      title="Ver desglose de puntuación"
                    >
                      <span>Oportunidad: {lead.opportunityScore}/100</span>
                      <Info className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Business Name & Type */}
                  <h3 className="text-base font-bold text-white leading-snug line-clamp-1">
                    {lead.displayName}
                  </h3>
                  <div className="text-xs text-orange-400 font-medium mb-3">
                    {lead.primaryTypeDisplayName || 'Servicio Local'}
                  </div>

                  {/* Rating & Reviews */}
                  <div className="flex items-center gap-2 mb-3 text-xs">
                    <div className="flex items-center gap-1 text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span>{lead.rating ? lead.rating.toFixed(1) : 'Sin rating'}</span>
                    </div>
                    <span className="text-slate-400">({lead.userRatingCount || 0} reseñas)</span>
                  </div>

                  {/* Address */}
                  <div className="flex items-start gap-2 text-xs text-slate-400 mb-3">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{lead.formattedAddress}</span>
                  </div>

                  {/* Web Status Tag */}
                  <div className="mb-4">
                    {!lead.websiteUri ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-md bg-rose-500/15 text-rose-400 border border-rose-500/30">
                        <Globe className="w-3 h-3" />
                        <span>Sin página web (Oportunidad alta)</span>
                      </span>
                    ) : lead.isSocialOrDirectory ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        <Globe className="w-3 h-3" />
                        <span>Sin web propia (Solo redes o directorio)</span>
                      </span>
                    ) : (
                      <a
                        href={lead.websiteUri}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 hover:text-white border border-slate-700 truncate max-w-full"
                      >
                        <Globe className="w-3 h-3 text-cyan-400" />
                        <span className="truncate">{lead.websiteUri.replace(/^https?:\/\//, '')}</span>
                        <ExternalLink className="w-2.5 h-2.5 ml-1 shrink-0" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Bottom Bar: Action buttons */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  {lead.nationalPhoneNumber ? (
                    <a
                      href={`tel:${lead.nationalPhoneNumber}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20 text-xs font-bold transition-all"
                    >
                      <Phone className="w-3 h-3" />
                      <span>Llamar</span>
                    </a>
                  ) : (
                    <span className="text-xs text-slate-500 italic">Sin teléfono</span>
                  )}

<button
                      type="button"
                      onClick={() => onOpenLead(lead)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-black font-extrabold text-xs transition-all"
                    >
                      <span>Ver Ficha</span>
                    </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
                <tr>
                  <th className="p-4 w-10">
                    <button onClick={handleSelectAll}>
                      {selectedIds.size === filteredLeads.length ? (
                        <CheckSquare className="w-4 h-4 text-orange-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-600" />
                      )}
                    </button>
                  </th>
                  <th className="p-4">Negocio</th>
                  <th className="p-4">Nicho</th>
                  <th className="p-4">Teléfono</th>
                  <th className="p-4">Web</th>
                  <th className="p-4">Rating</th>
                  <th className="p-4">Oportunidad</th>
                  <th className="p-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-4">
                      <button onClick={() => handleToggleSelect(lead.id)}>
                        {selectedIds.has(lead.id) ? (
                          <CheckSquare className="w-4 h-4 text-orange-400" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-600" />
                        )}
                      </button>
                    </td>
                    <td className="p-4 font-bold text-white">{lead.displayName}</td>
                    <td className="p-4 text-orange-400">{lead.primaryTypeDisplayName || 'Local'}</td>
                    <td className="p-4">
                      {lead.nationalPhoneNumber ? (
                        <a
                          href={`tel:${lead.nationalPhoneNumber}`}
                          className="text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
                        >
                          <Phone className="w-3 h-3" />
                          <span>{lead.nationalPhoneNumber}</span>
                        </a>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="p-4">
                      {!lead.websiteUri ? (
                        <span className="text-rose-400 font-bold">Sin web</span>
                      ) : lead.isSocialOrDirectory ? (
                        <span className="text-amber-400 font-semibold">Red social</span>
                      ) : (
                        <a
                          href={lead.websiteUri}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan-400 hover:underline flex items-center gap-1 max-w-[150px] truncate"
                        >
                          <Globe className="w-3 h-3 shrink-0" />
                          <span className="truncate">{lead.websiteUri.replace(/^https?:\/\//, '')}</span>
                        </a>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span className="font-bold text-white">{lead.rating?.toFixed(1) || '-'}</span>
                        <span className="text-slate-500">({lead.userRatingCount || 0})</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => setScoreModalLead(lead)}
                        className={`px-2 py-0.5 rounded-md font-black border text-[11px] ${getScoreBadgeClass(
                          lead.opportunityScore
                        )}`}
                      >
                        {lead.opportunityScore}/100
                      </button>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        type="button"
                        onClick={() => onOpenLead(lead)}
                        className="px-3 py-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-black font-extrabold text-xs transition"
                      >
                        Ficha
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Button: Cargar Más (nextPageToken) */}
      {nextPageToken && (
        <div className="text-center pt-4">
          <button
            onClick={() => handleSearch(true)}
            disabled={loadingMore || totalFetched >= 60}
            className="px-6 py-3 rounded-xl bg-slate-900 border border-slate-700 hover:border-orange-500 text-white font-bold text-sm transition-all disabled:opacity-40"
          >
            {loadingMore ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
                Cargando más resultados...
              </span>
            ) : totalFetched >= 60 ? (
              'Límite de 60 resultados alcanzado'
            ) : (
              'Cargar más negocios (+20)'
            )}
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && leads.length === 0 && (
        <div className="text-center py-20 p-8 rounded-2xl bg-slate-900/40 border border-slate-800/60 max-w-xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-orange-500/10 text-orange-400 flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Comienza tu prospección inteligente</h3>
          <p className="text-sm text-slate-400">
            Ingresa una ciudad o barrio y selecciona un nicho de negocio para descubrir clientes potenciales con alta necesidad de servicios digitales.
          </p>
        </div>
      )}

      {/* Modal Desglose Puntuación de Oportunidad */}
      {scoreModalLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#0f172a] border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h4 className="text-sm font-bold text-white">{scoreModalLead.displayName}</h4>
                <div className="text-xs text-orange-400">Desglose de Puntuación de Oportunidad</div>
              </div>
              <div
                className={`px-3 py-1 rounded-xl font-black text-sm border ${getScoreBadgeClass(
                  scoreModalLead.opportunityScore
                )}`}
              >
                {scoreModalLead.opportunityScore} / 100
              </div>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {scoreModalLead.opportunityBreakdown.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-900/80 border border-slate-800"
                >
                  <span className="text-slate-300 pr-2">{item.label}</span>
                  <span
                    className={`font-black shrink-0 ${
                      item.points > 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {item.points > 0 ? `+${item.points}` : item.points} pts
                  </span>
                </div>
              ))}
            </div>

            <div className="text-[11px] text-slate-400 bg-slate-950 p-3 rounded-xl border border-slate-800/80">
              💡 La puntuación sube si el negocio no tiene web, si su web móvil es lenta o si carece de WhatsApp, y si demuestra clientela activa.
            </div>

            <button
              onClick={() => setScoreModalLead(null)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
