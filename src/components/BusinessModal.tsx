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

  // Ejecuta la auditoría completa (PageSpeed + Gemini)
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

      // Llamamos al análisis de Gemini Flash + Scraper
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
          apiKey: settings.geminiApiKey || undefined,
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
          apiKey: settings.geminiApiKey || undefined,
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

          {/* Section: Auditoría Web & Gemini */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-orange-400" />
                  <span>Auditoría Técnica y Diagnóstico de IA</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Análisis con Google PageSpeed Insights (móvil) y Gemini Flash para detectar cuellos de botella.
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

                {/* Servicio Recomendado a Ofrecer */}
                {analysis.recommendedService && (
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-500/15 via-amber-500/10 to-transparent border border-orange-500/30">
                    <div className="text-[10px] uppercase font-black text-orange-400 tracking-wider">
                      Servicio Recomendado de DigiMarket RD
                    </div>
                    <div className="text-sm font-black text-white mt-0.5">
                      {analysis.recommendedService.service}
                    </div>
                    <p className="text-slate-300 mt-1.5 leading-relaxed">
                      {analysis.recommendedService.reason}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-500">
                Pulsa «Analizar Web con IA» para obtener las notas de PageSpeed, la captura de pantalla y el diagnóstico comercial de Gemini.
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
      </div>
    </div>
  );
}
