'use client';

import React, { useState } from 'react';
import {
  X,
  Phone,
  Globe,
  MapPin,
  Star,
  ExternalLink,
  Cpu,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  Printer,
  Calendar,
  AlertTriangle,
  ShieldCheck,
  Smartphone,
  MessageSquare,
  Clock,
  Sparkles,
  Info,
  CheckCircle,
  XCircle,
  FileText,
  Send,
  Zap,
  Globe2,
  Rocket,
  Wifi,
} from 'lucide-react';
import { AppSettings, BusinessLead, LeadStatus } from '@/types';
import { calculateOpportunityScore } from '@/utils/opportunity';

interface BusinessModalProps {
  lead: BusinessLead;
  settings: AppSettings;
  onClose: () => void;
  onUpdateLead: (updated: BusinessLead) => void;
  onPrintLead: (lead: BusinessLead) => void;
}

export function BusinessModal({
  lead,
  settings,
  onClose,
  onUpdateLead,
  onPrintLead,
}: BusinessModalProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeDraftTab, setActiveDraftTab] = useState<'whatsapp' | 'phone' | 'email'>('whatsapp');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [creatingWebAndCRM, setCreatingWebAndCRM] = useState(false);
  const [createWebError, setCreateWebError] = useState<string | null>(null);
  const [createdSiteUrl, setCreatedSiteUrl] = useState<string | null>(null);
  const [propuestaData, setPropuestaData] = useState<{
    slides: any[];
    notebookPrompt: string;
  } | null>(null);
  const [showPropuesta, setShowPropuesta] = useState(false);

  // Notas y próxima acción editables
  const [notes, setNotes] = useState(lead.notes || '');
  const [status, setStatus] = useState<LeadStatus>(lead.status || 'Nuevo');
  const [nextActionDate, setNextActionDate] = useState(lead.nextActionDate || '');

  // Tono para regenerar borradores
  const [selectedTone, setSelectedTone] = useState<'cercano' | 'consultivo' | 'directo'>(
    settings.sellerProfile.tone || 'consultivo'
  );
  const [regeneratingDrafts, setRegeneratingDrafts] = useState(false);

  const handleSaveNotesAndStatus = () => {
    const updated: BusinessLead = {
      ...lead,
      notes,
      status,
      nextActionDate,
      updatedAt: new Date().toISOString(),
    };
    onUpdateLead(updated);
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Ejecuta la auditoría completa (PageSpeed + NVIDIA NIM)
  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError(null);

    try {
      let pageSpeedData = null;

      // Si tiene web propia, auditamos con PageSpeed
      if (lead.hasOwnWebsite && lead.websiteUri) {
        try {
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
        } catch (psErr) {
          console.warn('PageSpeed falló o tardó demasiado:', psErr);
        }
      }

      // Llamamos al análisis con NVIDIA NIM + Scraper
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
          sellerProfile: {
            ...settings.sellerProfile,
            tone: selectedTone,
          },
          apiKey: settings.nvidiaApiKey || undefined,
          pageSpeedScores: pageSpeedData,
        }),
      });

      if (!aiRes.ok) {
        const errJson = await aiRes.json();
        throw new Error(errJson.error || 'Error al analizar con IA');
      }

      const aiData = await aiRes.json();
      const recalculated = calculateOpportunityScore(lead, pageSpeedData, aiData.checklist);

      const updatedLead: BusinessLead = {
        ...lead,
        opportunityScore: recalculated.score,
        opportunityBreakdown: recalculated.breakdown,
        status: 'Analizado',
        notes,
        nextActionDate,
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

      onUpdateLead(updatedLead);
    } catch (err: any) {
      console.error('Error analizando:', err);
      setError(err.message || 'Error inesperado durante la auditoría');
    } finally {
      setAnalyzing(false);
    }
  };

  // Regenerar borradores con otro tono
  const handleRegenerateDrafts = async () => {
    setRegeneratingDrafts(true);
    try {
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
          sellerProfile: {
            ...settings.sellerProfile,
            tone: selectedTone,
          },
          apiKey: settings.nvidiaApiKey || undefined,
          pageSpeedScores: lead.analysis?.pageSpeed,
        }),
      });

      if (aiRes.ok) {
        const aiData = await aiRes.json();
        if (lead.analysis) {
          const updated: BusinessLead = {
            ...lead,
            analysis: {
              ...lead.analysis,
              drafts: aiData.drafts,
            },
            updatedAt: new Date().toISOString(),
          };
          onUpdateLead(updated);
        }
      }
    } catch (e) {
      console.error('Error regenerando borradores:', e);
    } finally {
      setRegeneratingDrafts(false);
    }
  };

  // Crear Web en Caso 2 + Activar CRM en Caso 3 + Generar Propuesta Caso 4
  const handleCreateWebAndCRM = async () => {
    if (!lead.analysis?.recommendedService) {
      setCreateWebError('Primero analiza la web para obtener el paquete recomendado');
      return;
    }

    setCreatingWebAndCRM(true);
    setCreateWebError(null);
    setCreatedSiteUrl(null);

    try {
      const packageInfo = lead.analysis.recommendedService;
      const servicesCount = packageInfo.services?.length ?? 0;
      const packageType = servicesCount > 2 ? 'premium'
        : servicesCount > 1 ? 'pro' : 'basico';

      // URLs desde variables de entorno (configurar en Vercel Dashboard)
      const caso2Url = process.env.NEXT_PUBLIC_CASO2_API_URL || 'https://caso2-web-taller.pages.dev';
      const caso3Url = process.env.NEXT_PUBLIC_CASO3_API_URL || 'https://caso3-crm-whatsapp.vercel.app';

      // 1. Generar sitio en Caso 2 (Astro + Vercel)
      console.log('[Crear Web] Paso 1: Generando configuración del sitio...');
      const genRes = await fetch(`${caso2Url}/api/web/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadData: {
            id: lead.id,
            nombre: lead.displayName,
            direccion: lead.formattedAddress,
            telefono: lead.internationalPhoneNumber || lead.nationalPhoneNumber,
            email: lead.analysis?.emails?.[0],
            servicios: lead.analysis?.recommendedService?.services,
            whatsapp: lead.internationalPhoneNumber || lead.nationalPhoneNumber,
          },
          packageType,
          packagePrice: packageInfo.priceRange,
        }),
      });

      if (!genRes.ok) {
        const err = await genRes.json();
        throw new Error(`Error generando sitio: ${err.error || genRes.statusText}`);
      }

      const genData = await genRes.json();
      console.log('[Crear Web] Configuración generada:', genData.config);

      // 2. Deploy en Vercel
      console.log('[Crear Web] Paso 2: Desplegando en Vercel...');
      const deployRes = await fetch(`${caso2Url}/api/web/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: genData.config }),
      });

      if (!deployRes.ok) {
        const err = await deployRes.json();
        throw new Error(`Error en deploy: ${err.error || deployRes.statusText}`);
      }

      const deployData = await deployRes.json();
      const siteUrl = deployData.siteUrl;
      console.log('[Crear Web] Sitio desplegado:', siteUrl);
      setCreatedSiteUrl(siteUrl);

      // 3. Importar lead en Caso 3 (CRM WhatsApp)
      console.log('[Crear Web] Paso 3: Importando lead al CRM WhatsApp...');
      const crmRes = await fetch(`${caso3Url}/api/crm/leads/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: lead.id,
          displayName: lead.displayName,
          formattedAddress: lead.formattedAddress,
          phoneNumber: lead.internationalPhoneNumber || lead.nationalPhoneNumber,
          email: lead.analysis?.emails?.[0],
          website: siteUrl,
          opportunityScore: lead.opportunityScore,
          packageType,
          packagePrice: packageInfo.priceRange,
          siteUrl,
        }),
      });

      if (!crmRes.ok) {
        const err = await crmRes.json();
        throw new Error(`Error importando a CRM: ${err.error || crmRes.statusText}`);
      }

      const crmData = await crmRes.json();
      console.log('[Crear Web] Lead importado a CRM:', crmData);

      // 4. Generar Propuesta en Caso 4 (NotebookLM / Slides)
      console.log('[Crear Web] Paso 4: Generando propuesta comercial (Caso 4)...');
      const propuestaRes = await fetch('/api/propuesta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          negocio: lead.displayName,
          categoria: lead.primaryTypeDisplayName,
          direccion: lead.formattedAddress,
          telefono: lead.internationalPhoneNumber || lead.nationalPhoneNumber,
          email: lead.analysis?.emails?.[0],
          sitioWeb: lead.websiteUri,
          siteUrl,
          rating: lead.rating,
          reviews: lead.userRatingCount,
          oportunidadScore: lead.opportunityScore,
          problemas: lead.analysis?.problems || [],
          paquetesRecomendados: [{
            nombre: packageInfo.service,
            precio: packageInfo.priceRange,
            servicios: packageInfo.services || [],
            razon: packageInfo.reason,
          }],
          timeline: "Fase 1: Web + IA WhatsApp (Sem 1-2) | Fase 2: Citas + CRM (Sem 3) | Fase 3: SEO + Ads (Mes 2)",
          contactoWhatsApp: lead.internationalPhoneNumber || lead.nationalPhoneNumber,
        }),
      });

      let propuestaData = null;
      if (propuestaRes.ok) {
        const propuestaResult = await propuestaRes.json();
        console.log('[Crear Web] Propuesta generada:', propuestaResult);
        setPropuestaData({
          slides: propuestaResult.slides || [],
          notebookPrompt: propuestaResult.notebookPrompt || '',
        });
        setShowPropuesta(true);
      } else {
        console.warn('[Crear Web] Error generando propuesta (no bloqueante):', await propuestaRes.text());
      }

      // Actualizar lead local con el estado, URL del sitio y datos de propuesta
      const updatedLead: BusinessLead = {
        ...lead,
        status: 'Contactado',
        siteUrl,
        notes: `${notes}\n\n[Auto] Web creada: ${siteUrl} | CRM activado: ${new Date().toLocaleString()}${propuestaData ? ' | Propuesta generada: ' + JSON.stringify(propuestaData.slides?.length || 0) + ' slides' : ''}`,
        updatedAt: new Date().toISOString(),
      };
      onUpdateLead(updatedLead);

      // Mostrar resultado completo con propuesta
      const propuestaMsg = propuestaData
        ? `\n📊 Propuesta: ${propuestaData.slides?.length || 8} diapositivas generadas\n📋 Prompt NotebookLM listo para copiar`
        : '';

      alert(`✅ ¡Flujo Completo Ejecutado!\n\n🌐 Sitio web: ${siteUrl}\n📱 CRM WhatsApp: Lead importado y conversación creada\n📦 Paquete: ${packageInfo.service}${propuestaMsg}\n\nEl CRM enviará el primer mensaje por WhatsApp automáticamente.\nLa propuesta está lista para enviar por WhatsApp/Email.`);
    } catch (err: any) {
      console.error('[Crear Web] Error:', err);
      setCreateWebError(err.message || 'Error inesperado al crear web y activar CRM');
    } finally {
      setCreatingWebAndCRM(false);
    }
  };

  const analysis = lead.analysis;
  const pageSpeed = analysis?.pageSpeed;

  const getPageSpeedColor = (val: number) => {
    if (val >= 90) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (val >= 50) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="bg-[#0b1222] border border-slate-700/80 rounded-3xl max-w-4xl w-full my-8 overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Modal Top Bar */}
        <div className="p-6 border-b border-slate-800 flex items-start justify-between gap-4 bg-slate-900/60 shrink-0">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-2xl font-black text-white tracking-tight">{lead.displayName}</h2>
              <span className="text-xs px-2.5 py-1 rounded-lg bg-orange-500/20 text-orange-400 border border-orange-500/30 font-bold">
                {lead.primaryTypeDisplayName || 'Negocio Local'}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400 mt-2 flex-wrap">
              <div className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                <span>{lead.formattedAddress}</span>
              </div>
              <div className="flex items-center gap-1 text-amber-400 font-bold">
                <Star className="w-3.5 h-3.5 fill-amber-400" />
                <span>{lead.rating ? lead.rating.toFixed(1) : '-'}</span>
                <span className="text-slate-500 font-normal">({lead.userRatingCount || 0} reseñas)</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onPrintLead(lead)}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1.5 text-xs font-bold"
              title="Exportar ficha o imprimir"
            >
              <Printer className="w-4 h-4 text-orange-400" />
              <span className="hidden sm:inline">Exportar Ficha</span>
            </button>
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Action Callouts */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              {lead.nationalPhoneNumber && (
                <a
                  href={`tel:${lead.nationalPhoneNumber}`}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30 font-bold transition"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Llamar ({lead.nationalPhoneNumber})</span>
                </a>
              )}

              {lead.websiteUri ? (
                <a
                  href={lead.websiteUri}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/30 font-bold transition"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Abrir Web</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <span className="px-3 py-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold">
                  Sin sitio web
                </span>
              )}

              {lead.googleMapsUri && (
                <a
                  href={lead.googleMapsUri}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white border border-slate-700 font-bold transition"
                >
                  <MapPin className="w-3.5 h-3.5 text-orange-400" />
                  <span>Ver en Maps</span>
                </a>
              )}

              {/* Botón PRINCIPAL: Crear Web + Activar CRM (Caso 2 + 3) */}
              {lead.analysis?.recommendedService && !creatingWebAndCRM && (
                <button
                  onClick={handleCreateWebAndCRM}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-emerald-500 hover:from-orange-600 hover:via-amber-600 hover:to-emerald-600 text-black font-extrabold text-xs transition shadow-lg shadow-orange-500/40 animate-pulse"
                  title="Generar sitio web según paquete + Activar CRM WhatsApp automáticamente"
                >
                  <Rocket className="w-4 h-4" />
                  <span>Crear Web + Activar CRM</span>
                  <Globe2 className="w-4 h-4" />
                </button>
              )}

              {/* Loading state */}
              {creatingWebAndCRM && (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500/50 via-amber-500/50 to-emerald-500/50 text-black font-bold text-xs">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generando web y activando CRM...</span>
                </div>
              )}

              {/* Error state */}
              {createWebError && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{createWebError}</span>
                </div>
              )}

              {/* Success state with link */}
              {createdSiteUrl && !creatingWebAndCRM && (
                <a
                  href={createdSiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold text-xs transition hover:bg-emerald-500/30"
                >
                  <Wifi className="w-3.5 h-3.5" />
                  <span>Ver Sitio: {createdSiteUrl.replace('https://', '')}</span>
                </a>
              )}

              {/* Botón SECUNDARIO: Solo CRM WhatsApp (Caso 3) */}
              <button
                onClick={handleCreateWebAndCRM}
                disabled={creatingWebAndCRM}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-black font-extrabold text-xs transition shadow-lg shadow-emerald-500/30 opacity-70 hover:opacity-100"
                title="Solo enviar al CRM WhatsApp sin crear web"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Solo CRM WhatsApp</span>
                <Zap className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Score pill */}
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-semibold">Puntuación de Oportunidad:</span>
              <span
                className={`px-3 py-1.5 rounded-xl font-black text-sm border ${
                  lead.opportunityScore >= 70
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : lead.opportunityScore >= 45
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                    : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                }`}
              >
                {lead.opportunityScore} / 100
              </span>
            </div>
          </div>

{/* Section: Auditoría Web & NVIDIA NIM */}
           <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
             <div className="flex items-center justify-between">
               <div>
                 <h3 className="text-sm font-bold text-white flex items-center gap-2">
                   <Sparkles className="w-4 h-4 text-orange-400" />
                   <span>Auditoría Técnica y Diagnóstico de IA</span>
                 </h3>
                 <p className="text-[11px] text-slate-400 mt-0.5">
                   Análisis con Google PageSpeed Insights (móvil) y NVIDIA NIM (Llama 3.1) para detectar cuellos de botella.
                 </p>
               </div>

              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-black font-extrabold text-xs transition shadow-lg shadow-orange-500/20 disabled:opacity-50"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Auditando (10-25s)...</span>
                  </>
                ) : (
                  <>
                    <Cpu className="w-4 h-4" />
                    <span>{analysis ? 'Volver a Analizar' : 'Analizar Web con IA'}</span>
                  </>
                )}
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Analysis Results Display */}
            {analysis ? (
              <div className="space-y-5 pt-2">
                {/* Resumen de actividad */}
                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-300">
                  <span className="font-bold text-white">Resumen del Negocio: </span>
                  {analysis.summary}
                </div>

                {/* PageSpeed Gauges & Mobile Screenshot */}
                {pageSpeed && (
                  <div>
                    <div className="font-bold text-slate-300 mb-2.5">
                      Notas de Google PageSpeed en Móvil:
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div
                        className={`p-3 rounded-xl border text-center ${getPageSpeedColor(
                          pageSpeed.performance
                        )}`}
                      >
                        <div className="text-2xl font-black">{pageSpeed.performance}</div>
                        <div className="text-[10px] uppercase font-bold tracking-wider mt-1">
                          Rendimiento
                        </div>
                      </div>
                      <div className={`p-3 rounded-xl border text-center ${getPageSpeedColor(pageSpeed.seo)}`}>
                        <div className="text-2xl font-black">{pageSpeed.seo}</div>
                        <div className="text-[10px] uppercase font-bold tracking-wider mt-1">SEO</div>
                      </div>
                      <div
                        className={`p-3 rounded-xl border text-center ${getPageSpeedColor(
                          pageSpeed.accessibility
                        )}`}
                      >
                        <div className="text-2xl font-black">{pageSpeed.accessibility}</div>
                        <div className="text-[10px] uppercase font-bold tracking-wider mt-1">
                          Accesibilidad
                        </div>
                      </div>
                      <div
                        className={`p-3 rounded-xl border text-center ${getPageSpeedColor(
                          pageSpeed.bestPractices
                        )}`}
                      >
                        <div className="text-2xl font-black">{pageSpeed.bestPractices}</div>
                        <div className="text-[10px] uppercase font-bold tracking-wider mt-1">
                          Buenas Prácticas
                        </div>
                      </div>
                    </div>

                    {/* Captura de pantalla móvil real */}
                    {pageSpeed.screenshot && (
                      <div className="mt-4 p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-center gap-4">
                        <div className="w-28 h-48 rounded-xl overflow-hidden border-2 border-slate-700 shadow-xl shrink-0 bg-black">
                          <img
                            src={pageSpeed.screenshot}
                            alt="Captura Móvil"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="space-y-1.5 text-xs">
                          <div className="font-bold text-white flex items-center gap-1.5">
                            <Smartphone className="w-4 h-4 text-orange-400" />
                            <span>Captura de pantalla real en dispositivo móvil</span>
                          </div>
                          <p className="text-slate-400">
                            Así es exactamente como visualizan la página web los clientes que buscan este negocio desde su teléfono celular.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Checklist de comprobación */}
                <div>
                  <div className="font-bold text-slate-300 mb-2">Lista de Comprobación Digital:</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                      <span className="text-slate-300">Certificado Seguro (HTTPS)</span>
                      {analysis.checklist.https ? (
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400" />
                      )}
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                      <span className="text-slate-300">Adaptada a Móviles (Viewport)</span>
                      {analysis.checklist.mobileFriendly ? (
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400" />
                      )}
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                      <span className="text-slate-300">Botón Flotante de WhatsApp</span>
                      {analysis.checklist.whatsappButton ? (
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400" />
                      )}
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                      <span className="text-slate-300">Sistema de Citas / Reserva Online</span>
                      {analysis.checklist.onlineBooking ? (
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400" />
                      )}
                    </div>
                  </div>
                  {analysis.checklist.outdatedSignals && (
                    <div className="mt-2 text-[11px] text-amber-400 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                      ⚠️ Señales de abandono: {analysis.checklist.outdatedSignals}
                    </div>
                  )}
                </div>

                {/* Problemas detectados */}
                {analysis.problems.length > 0 && (
                  <div>
                    <div className="font-bold text-slate-300 mb-2">
                      Problemas Detectados (Lenguaje Llano para el Cliente):
                    </div>
                    <div className="space-y-1.5">
                      {analysis.problems.map((p, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start gap-2.5"
                        >
                          <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <span className="text-slate-300">{p}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Servicio/Paquete Recomendado a Ofrecer */}
                {analysis.recommendedService && (
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-500/15 via-amber-500/10 to-transparent border border-orange-500/30">
                    <div className="text-[10px] uppercase font-black text-orange-400 tracking-wider">
                      {analysis.recommendedService.isPackage ? 'Paquete Recomendado de DigiMarket RD' : 'Servicio Recomendado de DigiMarket RD'}
                    </div>
                    <div className="text-sm font-black text-white mt-0.5">
                      {analysis.recommendedService.service}
                    </div>
                    {analysis.recommendedService.priceRange && (
                      <div className="text-xs font-bold text-amber-400 mt-1">
                        {analysis.recommendedService.priceRange}
                      </div>
                    )}
                    <p className="text-slate-300 mt-1.5 leading-relaxed">
                      {analysis.recommendedService.reason}
                    </p>
                    {analysis.recommendedService.services && analysis.recommendedService.services.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-orange-500/20">
                        <div className="text-[10px] uppercase font-bold text-orange-400 tracking-wider mb-2">
                          Servicios Incluidos:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {analysis.recommendedService.services.map((s, i) => (
                            <span key={i} className="px-2 py-1 text-[10px] font-semibold bg-orange-500/20 text-orange-300 border border-orange-500/30 rounded-lg">
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-500">
                Pulsa «Analizar Web con IA» para obtener las notas de PageSpeed, la captura de pantalla y el diagnóstico comercial con NVIDIA NIM.
              </div>
            )}
          </div>

          {/* Section: Borradores de Prospección Personalizados */}
          {analysis && analysis.drafts && (
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-emerald-400" />
                    <span>Borradores de Primer Contacto</span>
                  </h3>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Generados con la propuesta de valor de {settings.sellerProfile.companyName}
                  </div>
                </div>

                {/* Selector de Tono & Regenerar */}
                <div className="flex items-center gap-2">
                  <select
                    value={selectedTone}
                    onChange={(e) => setSelectedTone(e.target.value as any)}
                    className="px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs font-semibold focus:outline-none"
                  >
                    <option value="consultivo">Tono Consultivo</option>
                    <option value="directo">Tono Directo</option>
                    <option value="cercano">Tono Cercano</option>
                  </select>

                  <button
                    onClick={handleRegenerateDrafts}
                    disabled={regeneratingDrafts}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                    title="Regenerar con este tono"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${regeneratingDrafts ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Tabs WhatsApp / Phone / Email */}
              <div className="flex border-b border-slate-800 gap-2">
                <button
                  onClick={() => setActiveDraftTab('whatsapp')}
                  className={`pb-2 px-3 text-xs font-bold transition-all border-b-2 ${
                    activeDraftTab === 'whatsapp'
                      ? 'border-emerald-500 text-emerald-400'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  Mensaje WhatsApp
                </button>
                <button
                  onClick={() => setActiveDraftTab('phone')}
                  className={`pb-2 px-3 text-xs font-bold transition-all border-b-2 ${
                    activeDraftTab === 'phone'
                      ? 'border-orange-500 text-orange-400'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  Guion de Llamada (30s)
                </button>
                <button
                  onClick={() => setActiveDraftTab('email')}
                  className={`pb-2 px-3 text-xs font-bold transition-all border-b-2 ${
                    activeDraftTab === 'email'
                      ? 'border-cyan-500 text-cyan-400'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  Correo Electrónico
                </button>
              </div>

              {/* Draft Box */}
              <div className="relative">
                <textarea
                  readOnly
                  rows={activeDraftTab === 'email' ? 8 : 6}
                  value={
                    activeDraftTab === 'whatsapp'
                      ? analysis.drafts.whatsapp
                      : activeDraftTab === 'phone'
                      ? analysis.drafts.phoneScript
                      : analysis.drafts.email
                  }
                  className="w-full p-4 pr-12 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs leading-relaxed font-mono resize-none focus:outline-none"
                />

                <button
                  onClick={() =>
                    handleCopy(
                      activeDraftTab === 'whatsapp'
                        ? analysis.drafts.whatsapp
                        : activeDraftTab === 'phone'
                        ? analysis.drafts.phoneScript
                        : analysis.drafts.email,
                      activeDraftTab
                    )
                  }
                  className="absolute top-3 right-3 p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition shadow"
                  title="Copiar borrador"
                >
                  {copiedKey === activeDraftTab ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* Mandatory Legal Spam Warning */}
              <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] leading-relaxed">
                <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Aviso:</strong> Borradores para contactar de forma personal. No envíes mensajes comerciales masivos sin consentimiento.
                </span>
              </div>
            </div>
          )}

          {/* Section: Estado CRM, Notas y Próxima Acción */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-orange-400" />
              <span>Seguimiento y CRM del Lead</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Estado en el Pipeline
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as LeadStatus)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold"
                >
                  <option value="Nuevo">Nuevo</option>
                  <option value="Analizado">Analizado</option>
                  <option value="Contactado">Contactado</option>
                  <option value="Respondió">Respondió</option>
                  <option value="Reunión">Reunión Agendada</option>
                  <option value="Cliente">Cliente Ganado</option>
                  <option value="Descartado">Descartado</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Fecha Próxima Acción
                </label>
                <input
                  type="date"
                  value={nextActionDate}
                  onChange={(e) => setNextActionDate(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">
                Notas internas del prospecto
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Escribe aquí acuerdos, comentarios de llamada o detalles relevantes..."
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white resize-none focus:outline-none focus:border-orange-500"
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleSaveNotesAndStatus}
                className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-black font-extrabold transition"
              >
                Guardar Cambios del Lead
              </button>
            </div>
          </div>
        </div>

        {/* Section: Propuesta Comercial (Caso 4) */}
        {(showPropuesta || propuestaData) && (
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>Propuesta Comercial Generada (Caso 4)</span>
              </h3>
              <button
                onClick={() => setShowPropuesta(!showPropuesta)}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                title={showPropuesta ? 'Ocultar propuesta' : 'Ver propuesta'}
              >
                <span className="text-xs">{showPropuesta ? '▲' : '▼'}</span>
              </button>
            </div>

            {showPropuesta && propuestaData && (
              <div className="space-y-4">
                {/* Slides Preview */}
                <div className="space-y-3">
                  <div className="text-xs font-bold text-slate-400">Diapositivas (8):</div>
                  {propuestaData.slides.map((slide, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-orange-500/30 transition"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[10px] font-bold text-orange-400 bg-orange-500/20 px-2 py-0.5 rounded">
                          {slide.type?.toUpperCase() || `SLIDE ${idx + 1}`}
                        </span>
                        <span className="text-[10px] text-slate-500">#{idx + 1}/8</span>
                      </div>
                      <div className="font-bold text-white mt-1">{slide.title}</div>
                      <div className="text-slate-300 text-xs mt-1 whitespace-pre-wrap">{slide.content}</div>
                      {slide.bulletPoints && slide.bulletPoints.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {slide.bulletPoints.map((bp, bi) => (
                            <div key={bi} className="text-slate-400 text-xs flex items-start gap-1.5">
                              <span className="text-orange-400">•</span>
                              <span>{bp}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* NotebookLM Prompt */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-400">Prompt para NotebookLM:</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(propuestaData.notebookPrompt);
                        setCopiedKey('notebooklm');
                        setTimeout(() => setCopiedKey(null), 2500);
                      }}
                      className="p-1.5 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 hover:text-orange-300 transition text-xs font-bold"
                    >
                      {copiedKey === 'notebooklm' ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                      <span className="ml-1 hidden sm:inline">Copiar Prompt</span>
                    </button>
                  </div>
                  <textarea
                    readOnly
                    rows={12}
                    value={propuestaData.notebookPrompt}
                    className="w-full p-3 rounded-lg bg-black/50 border border-slate-700 text-slate-300 text-[10px] font-mono leading-relaxed resize-none"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        propuestaData.slides
                          .map((s, i) => `${i + 1}. ${s.title}\n${s.content}\n${s.bulletPoints?.map(b => `  • ${b}`).join('\n') || ''}`)
                          .join('\n\n')
                      );
                      setCopiedKey('slides');
                      setTimeout(() => setCopiedKey(null), 2500);
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 font-bold text-xs transition"
                  >
                    {copiedKey === 'slides' ? (
                      <>
                        <Check className="w-3.5 h-3.5 inline" /> Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 inline" /> Copiar Slides
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      const fullProposal = `PROPUESTA COMERCIAL - ${lead.displayName}\n\n${propuestaData.notebookPrompt}`;
                      navigator.clipboard.writeText(fullProposal);
                      setCopiedKey('full');
                      setTimeout(() => setCopiedKey(null), 2500);
                    }}
                    className="px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/30 font-bold text-xs transition"
                  >
                    {copiedKey === 'full' ? (
                      <>
                        <Check className="w-3.5 h-3.5 inline" /> Copiado
                      </>
                    ) : (
                      <>
                        <FileText className="w-3.5 h-3.5 inline" /> Copiar Todo
                      </>
                    )}
                  </button>
                  <a
                    href={`https://wa.me/${(lead.internationalPhoneNumber || lead.nationalPhoneNumber).replace(/\D/g, '')}?text=${encodeURIComponent(propuestaData.slides[6]?.content || '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 rounded-xl bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 font-bold text-xs transition flex items-center gap-1.5"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Enviar WhatsApp</span>
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
