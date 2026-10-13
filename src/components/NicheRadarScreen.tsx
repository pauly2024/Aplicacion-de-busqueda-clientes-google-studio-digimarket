'use client';

import React, { useState } from 'react';
import {
  Compass,
  Sparkles,
  MapPin,
  Play,
  Loader2,
  AlertTriangle,
  Award,
  ArrowRight,
  TrendingUp,
  Globe,
  Star,
  CheckCircle,
  Plus,
  X,
  Flame,
  Copy,
  FileText,
} from 'lucide-react';
import { AppSettings, NicheScanResult, PresentationPrompt, ServiceOffered } from '@/types';
import { checkHasOwnWebsite } from '@/utils/opportunity';
import { Storage } from '@/utils/storage';

const DEFAULT_CATEGORIES = [
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

interface NicheRadarScreenProps {
  settings: AppSettings;
  onExploreNiche: (zone: string, niche: string) => void;
  onUpdateSettings: (settings: AppSettings) => void;
}

export function NicheRadarScreen({
  settings,
  onExploreNiche,
  onUpdateSettings,
}: NicheRadarScreenProps) {
  const [zone, setZone] = useState('Puerto Plata');
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [newCatInput, setNewCatInput] = useState('');

  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; currentCat: string } | null>(
    null
  );
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [results, setResults] = useState<NicheScanResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);

  // Renderiza template con datos del negocio y vendedor
  const renderPrompt = (template: string, business: any) => {
    const seller = settings.sellerProfile;
    const services = (seller.servicesOffered || []).join('\n- ');
    return template
      .replace(/\{\{displayName\}\}/g, business.displayName || '')
      .replace(/\{\{primaryTypeDisplayName\}\}/g, business.primaryTypeDisplayName || '')
      .replace(/\{\{formattedAddress\}\}/g, business.formattedAddress || '')
      .replace(/\{\{nationalPhoneNumber\}\}/g, business.nationalPhoneNumber || '')
      .replace(/\{\{rating\}\}/g, business.rating?.toString() || 'N/A')
      .replace(/\{\{userRatingCount\}\}/g, business.userRatingCount?.toString() || '0')
      .replace(/\{\{hasOwnWebsite\}\}/g, business.hasOwnWebsite ? 'Sí' : 'No')
      .replace(/\{\{websiteUri\}\}/g, business.websiteUri || 'No tiene')
      .replace(/\{\{sellerProfile\.name\}\}/g, seller.name || '')
      .replace(/\{\{sellerProfile\.companyName\}\}/g, seller.companyName || '')
      .replace(/\{\{sellerProfile\.phone\}\}/g, seller.phone || '')
      .replace(/\{\{sellerProfile\.website\}\}/g, seller.website || '')
      .replace(/\{\{sellerProfile\.valueProposition\}\}/g, seller.valueProposition || '')
      .replace(/\{\{sellerProfile\.servicesOffered\}\}/g, services)
      .replace(/\{\{sellerProfile\.tone\}\}/g, seller.tone || '')
      .replace(/\{\{#each sellerProfile\.servicesOffered\}\}([\s\S]*?)\{\{\/each\}\}/g, (_, content) => {
        return (seller.servicesOffered || []).map((s: ServiceOffered) => content.replace(/\{\{this\}\}/g, `${s.name} - RD$ ${s.price}`)).join('\n');
      })
      .replace(/\{\{#if hasOwnWebsite\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, ifTrue, ifFalse) => {
        return business.hasOwnWebsite ? ifTrue : ifFalse;
      });
  };

  const handleCopyPrompt = async (prompt: PresentationPrompt, business: any) => {
    const rendered = renderPrompt(prompt.template, business);
    await navigator.clipboard.writeText(rendered);
    setCopiedPromptId(prompt.id);
    setTimeout(() => setCopiedPromptId(null), 2000);
  };

  const getFirstVideoPrompt = () => {
    return settings.presentationPrompts?.find((p) => p.type === 'video') || settings.presentationPrompts?.[0];
  };

  const getFirstPptPrompt = () => {
    return settings.presentationPrompts?.find((p) => p.type === 'ppt') || settings.presentationPrompts?.[0];
  };

  const handleAddCategory = () => {
    if (!newCatInput.trim()) return;
    if (!categories.includes(newCatInput.trim())) {
      setCategories([...categories, newCatInput.trim()]);
    }
    setNewCatInput('');
  };

  const handleRemoveCategory = (cat: string) => {
    setCategories(categories.filter((c) => c !== cat));
  };

  // Solicita confirmación antes de gastar las llamadas
  const triggerScan = () => {
    if (!zone.trim()) {
      setError('Por favor indica una zona para escanear');
      return;
    }
    if (categories.length === 0) {
      setError('Añade al menos una categoría');
      return;
    }
    setError(null);
    setShowConfirmModal(true);
  };

  // Ejecución del escaneo en lote de nichos
  const executeScan = async () => {
    setShowConfirmModal(false);
    setScanning(true);
    setError(null);
    setProgress({ current: 0, total: categories.length, currentCat: categories[0] });

    const scanList: NicheScanResult[] = [];

    for (let i = 0; i < categories.length; i++) {
      const cat = categories[i];
      setProgress({ current: i + 1, total: categories.length, currentCat: cat });

      try {
        const query = `${cat} en ${zone.trim()}`;
        const res = await fetch('/api/places', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            languageCode: 'es',
            regionCode: settings.defaultRegion || 'DO',
            apiKey: settings.googleMapsApiKey || undefined,
          }),
        });

        // Incrementamos llamada en settings
        const newCalls = Storage.incrementPlacesCalls(1);
        onUpdateSettings({ ...settings, placesCallsThisMonth: newCalls });

        if (res.ok) {
          const data = await res.json();
          const places: any[] = data.places || [];

          let noOwnWeb = 0;
          let sumRating = 0;
          let sumReviews = 0;
          let validRatings = 0;

          places.forEach((p) => {
            const { hasOwnWebsite } = checkHasOwnWebsite(p.websiteUri);
            if (!hasOwnWebsite) noOwnWeb++;
            if (p.rating) {
              sumRating += p.rating;
              validRatings++;
            }
            if (p.userRatingCount) {
              sumReviews += p.userRatingCount;
            }
          });

          const totalFound = places.length;
          const withoutPercent =
            totalFound > 0 ? Math.round((noOwnWeb / totalFound) * 100) : 0;
          const avgRating = validRatings > 0 ? +(sumRating / validRatings).toFixed(1) : 0;
          const avgReviews = totalFound > 0 ? Math.round(sumReviews / totalFound) : 0;

          // Puntuación de oportunidad de nicho: % sin web + nivel de actividad
          const oppScore = Math.min(100, Math.round(withoutPercent * 0.7 + Math.min(30, avgReviews * 0.5)));

          scanList.push({
            category: cat,
            totalFound,
            withoutOwnWebCount: noOwnWeb,
            withoutOwnWebPercent: withoutPercent,
            averageRating: avgRating,
            averageReviews: avgReviews,
            opportunityScore: oppScore,
          });
        }
      } catch (e) {
        console.error(`Error escaneando categoría ${cat}:`, e);
      }
    }

// Ahora enviamos a OpenRouter (Nemotron 3 Ultra) para ranking y recomendación de los top 3
      try {
        const nicheRes = await fetch('/api/radar-niche', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            zone,
            scanResults: scanList,
            apiKey: settings.openRouterApiKey || undefined,
          }),
        });

      if (nicheRes.ok) {
        const nicheData = await nicheRes.json();
        const rankings: any[] = nicheData.rankings || [];

        // Mezclamos el veredicto de Nemotron con los resultados
        const combined = scanList.map((item) => {
          const v = rankings.find(
            (r) => r.category?.toLowerCase() === item.category.toLowerCase()
          );
          return {
            ...item,
            geminiVerdict: v
              ? {
                  rank: v.rank || 99,
                  recommended: Boolean(v.recommended),
                  reason: v.reason || '',
                  serviceToSell: v.serviceToSell || 'Servicio DigiMarket',
                }
              : undefined,
          };
        });

        // Ordenamos por rango de Nemotron
        combined.sort((a, b) => {
          const rankA = a.geminiVerdict?.rank ?? 99;
          const rankB = b.geminiVerdict?.rank ?? 99;
          return rankA - rankB;
        });

        setResults(combined);
      } else {
        setResults(scanList);
      }
    } catch (nErr) {
      console.warn('Error en ranking de nichos:', nErr);
      setResults(scanList);
    } finally {
      setScanning(false);
      setProgress(null);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <span>Radar de Nichos</span>
            <span className="text-xs px-2.5 py-1 bg-gradient-to-r from-orange-500 to-amber-500 text-black font-extrabold rounded-lg uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              <span>Inteligencia de Mercado</span>
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Compara múltiples sectores en una misma zona y descubre dónde hay mayor oportunidad de captar clientes.
          </p>
        </div>
      </div>

      {/* Control Panel Card */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-6">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Zona de Estudio
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-orange-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                placeholder="Ej: Puerto Plata, Santiago..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:border-orange-500 focus:outline-none"
              />
            </div>
            {/* Zone quick chips */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {[
                { label: '\ud83c\udf0a Puerto Plata', value: 'Puerto Plata' },
                { label: '\ud83c\udfd9\ufe0f Santiago', value: 'Santiago de los Caballeros' },
                { label: '\ud83c\udf34 Sos\u00faa', value: 'Sos\u00faa, Puerto Plata' },
                { label: '\ud83c\udfd6\ufe0f Cabarete', value: 'Cabarete, Puerto Plata' },
              ].map((z) => (
                <button
                  key={z.value}
                  type="button"
                  onClick={() => setZone(z.value)}
                  className={`text-[11px] px-2 py-1 rounded-lg transition-all ${
                    zone === z.value
                      ? 'bg-cyan-500 text-black font-bold'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {z.label}
                </button>
              ))}
            </div>
          </div>

          <div className="md:col-span-6">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Añadir otra categoría al estudio
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newCatInput}
                onChange={(e) => setNewCatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                placeholder="Ej: cerrajeros, ópticas..."
                className="flex-1 px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:border-orange-500 focus:outline-none"
              />
              <button
                onClick={handleAddCategory}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Añadir</span>
              </button>
            </div>
          </div>
        </div>

        {/* Selected Categories Tags */}
        <div>
          <div className="text-xs font-semibold text-slate-400 mb-2">
            Categorías que se analizarán ({categories.length}):
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <span
                key={cat}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs font-medium"
              >
                <span>{cat}</span>
                <button
                  onClick={() => handleRemoveCategory(cat)}
                  className="text-slate-500 hover:text-rose-400 transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Launch Button */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Cada nicho consumirá 1 consulta a Google Places API.
          </div>

          <button
            onClick={triggerScan}
            disabled={scanning}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-black font-extrabold text-sm shadow-lg shadow-orange-500/20 transition-all disabled:opacity-50"
          >
            {scanning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Analizando Nichos...</span>
              </>
            ) : (
              <>
                <Compass className="w-4 h-4" />
                <span>Escanear Oportunidad de Nichos</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Progress Bar during Scanning */}
      {scanning && progress && (
        <div className="p-4 rounded-xl bg-orange-950/30 border border-orange-500/30 text-orange-300 text-xs space-y-2">
          <div className="flex items-center justify-between font-bold">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
              <span>
                Consultando: «{progress.currentCat} en {zone}»...
              </span>
            </div>
            <span>
              {progress.current} de {progress.total}
            </span>
          </div>
          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
            <div
              className="bg-orange-500 h-full transition-all duration-300"
              style={{
                width: `${Math.round((progress.current / progress.total) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Top 3 Nemotron Recommendations Podium */}
      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-black text-white tracking-tight">
              Recomendación Estratégica de Nemotron 3 Ultra: Top 3 Nichos con Mayor Potencial
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {results.slice(0, 3).map((item, idx) => (
              <div
                key={item.category}
                className="p-5 rounded-2xl bg-gradient-to-b from-slate-900 to-[#0c1427] border border-amber-500/30 shadow-xl relative flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 font-black flex items-center justify-center border border-amber-500/30 text-sm">
                      #{idx + 1}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 font-extrabold text-xs border border-emerald-500/30">
                      {item.withoutOwnWebPercent}% Sin Web
                    </span>
                  </div>

                  <h3 className="text-lg font-black text-white capitalize mb-1">
                    {item.category}
                  </h3>

                  <div className="space-y-2 my-3 text-xs text-slate-300">
                    <p className="leading-relaxed">
                      {item.geminiVerdict?.reason ||
                        `Alta demanda local con ${item.averageReviews} reseñas medias y una enorme oportunidad para vender digitalización.`}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
                    <div className="text-[10px] uppercase font-bold text-orange-400 tracking-wider">
                      Servicio a Vender:
                    </div>
                    <div className="font-bold text-white mt-0.5">
                      {item.geminiVerdict?.serviceToSell || 'Web de Alta Conversión con WhatsApp'}
                    </div>
                  </div>
                </div>

<div className="pt-4 mt-4 border-t border-slate-800 flex flex-col gap-2">
                    <button
                      onClick={() => onExploreNiche(zone, item.category)}
                      className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-black font-extrabold text-xs transition flex items-center justify-center gap-1.5 shadow"
                    >
                      <span>Ver Negocios de este Nicho</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    {(() => {
                      const videoPrompt = getFirstVideoPrompt();
                      const pptPrompt = getFirstPptPrompt();
                      if (!videoPrompt && !pptPrompt) return null;
                      return (
                        <div className="flex gap-2">
                          {videoPrompt && (
                            <button
                              onClick={() => handleCopyPrompt(videoPrompt, item)}
                              disabled={copiedPromptId === videoPrompt.id}
                              className="flex-1 py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 text-xs font-bold transition flex items-center justify-center gap-1 border border-purple-500/30"
                              title="Copiar prompt video"
                            >
                              {copiedPromptId === videoPrompt.id ? (
                                <>
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  <span>¡Copiado!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>🎬 Video</span>
                                </>
                              )}
                            </button>
                          )}
                          {pptPrompt && pptPrompt !== videoPrompt && (
                            <button
                              onClick={() => handleCopyPrompt(pptPrompt, item)}
                              disabled={copiedPromptId === pptPrompt.id}
                              className="flex-1 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-xs font-bold transition flex items-center justify-center gap-1 border border-blue-500/30"
                              title="Copiar prompt PPT"
                            >
                              {copiedPromptId === pptPrompt.id ? (
                                <>
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  <span>¡Copiado!</span>
                                </>
                              ) : (
                                <>
                                  <FileText className="w-3.5 h-3.5" />
                                  <span>📊 PPT</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
              </div>
            ))}
          </div>

          {/* Full Comparison Table */}
          <div className="mt-8 rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-800 font-bold text-sm text-white">
              Tabla Comparativa Completa de Categorías en {zone}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="p-4">Rango</th>
                    <th className="p-4">Categoría</th>
                    <th className="p-4">Total Negocios</th>
                    <th className="p-4">% Sin Web Propia</th>
                    <th className="p-4">Rating Promedio</th>
                    <th className="p-4">Reseñas Promedio</th>
                    <th className="p-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {results.map((res, idx) => (
                    <tr key={res.category} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-4 font-black text-amber-400">#{idx + 1}</td>
                      <td className="p-4 font-bold text-white capitalize">{res.category}</td>
                      <td className="p-4">{res.totalFound} encontrados</td>
                      <td className="p-4 font-bold text-orange-400">
                        {res.withoutOwnWebPercent}% ({res.withoutOwnWebCount} negocios)
                      </td>
                      <td className="p-4 font-bold text-white">{res.averageRating || '-'} ★</td>
                      <td className="p-4">{res.averageReviews} opiniones</td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onExploreNiche(zone, res.category)}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition"
                          >
                            Ver Negocios
                          </button>
                          {(() => {
                            const videoPrompt = getFirstVideoPrompt();
                            const pptPrompt = getFirstPptPrompt();
                            if (!videoPrompt && !pptPrompt) return null;
                            return (
                              <div className="flex gap-1">
                                {videoPrompt && (
                                  <button
                                    onClick={() => handleCopyPrompt(videoPrompt, res)}
                                    disabled={copiedPromptId === videoPrompt.id}
                                    className="p-1.5 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 transition border border-purple-500/30"
                                    title="Copiar prompt video"
                                  >
                                    {copiedPromptId === videoPrompt.id ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                  </button>
                                )}
                                {pptPrompt && pptPrompt !== videoPrompt && (
                                  <button
                                    onClick={() => handleCopyPrompt(pptPrompt, res)}
                                    disabled={copiedPromptId === pptPrompt.id}
                                    className="p-1.5 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 transition border border-blue-500/30"
                                    title="Copiar prompt PPT"
                                  >
                                    {copiedPromptId === pptPrompt.id ? <CheckCircle className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#0f172a] border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="font-bold text-white text-base">Confirmar Escaneo de Nichos</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Vas a escanear <strong>{categories.length} categorías</strong> en la zona de{' '}
              <strong>"{zone}"</strong>.
              <br />
              Esto consumirá aproximadamente <strong>{categories.length} llamadas</strong> a la API de Google Places.
            </p>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400">
              Uso actual este mes: {settings.placesCallsThisMonth || 0} / {settings.placesQuotaLimit || 800} llamadas.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
              >
                Cancelar
              </button>
              <button
                onClick={executeScan}
                className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-black text-xs font-extrabold transition shadow"
              >
                Sí, iniciar escaneo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
