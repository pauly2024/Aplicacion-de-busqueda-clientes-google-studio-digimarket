'use client';

import React from 'react';
import { BusinessLead, AppSettings } from '@/types';
import { Printer, X } from 'lucide-react';

interface PrintableViewProps {
  lead: BusinessLead;
  settings: AppSettings;
  onClose: () => void;
}

export function PrintableView({ lead, settings, onClose }: PrintableViewProps) {
  const analysis = lead.analysis;
  const pageSpeed = analysis?.pageSpeed;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md overflow-y-auto p-4 sm:p-8 flex flex-col items-center">
      {/* Top Floating Control Bar */}
      <div className="w-full max-w-4xl flex items-center justify-between pb-4 print:hidden">
        <div className="text-white text-sm font-bold">
          Vista Imprimible / Exportar Ficha a PDF
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-black font-extrabold text-xs shadow-lg transition"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir / Guardar como PDF</span>
          </button>
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Printable Sheet */}
      <div className="w-full max-w-4xl bg-white text-slate-900 rounded-2xl shadow-2xl p-8 sm:p-12 print:p-0 print:shadow-none print:rounded-none space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-slate-900 pb-6">
          <div>
            <div className="text-xs uppercase font-extrabold tracking-widest text-orange-600">
              INFORME DE PROSPECCIÓN & AUDITORÍA DIGITAL
            </div>
            <h1 className="text-3xl font-black text-slate-900 mt-1">{lead.displayName}</h1>
            <div className="text-sm font-bold text-slate-600 mt-1">
              {lead.primaryTypeDisplayName || 'Negocio Local'} • {lead.formattedAddress}
            </div>
          </div>

          <div className="text-right">
            <div className="text-lg font-black text-slate-900">
              <span className="text-sky-600">DIGI</span>
              <span className="text-orange-600">MARKET</span>
              <span className="text-red-600">RD</span>
            </div>
            <div className="text-xs text-slate-500">Agencia Digital & IA</div>
            <div className="text-xs text-slate-500 mt-1">{new Date().toLocaleDateString('es-ES')}</div>
          </div>
        </div>

        {/* Opportunity Score & Quick Stats */}
        <div className="grid grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div>
            <div className="text-xs text-slate-500 font-bold uppercase">Puntuación Oportunidad</div>
            <div className="text-2xl font-black text-orange-600">{lead.opportunityScore} / 100</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 font-bold uppercase">Valoración Google</div>
            <div className="text-2xl font-black text-slate-800">
              {lead.rating ? `${lead.rating.toFixed(1)} ★` : 'N/A'}{' '}
              <span className="text-xs font-normal text-slate-500">({lead.userRatingCount || 0} reseñas)</span>
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 font-bold uppercase">Estado de la Web</div>
            <div className="text-sm font-black text-slate-800 mt-1">
              {!lead.websiteUri
                ? 'Sin sitio web'
                : lead.isSocialOrDirectory
                ? 'Solo Red Social / Directorio'
                : 'Sitio Web Propio'}
            </div>
          </div>
        </div>

        {/* Contact Data */}
        <div className="text-xs grid grid-cols-2 gap-4 border-b border-slate-200 pb-4">
          <div>
            <span className="font-bold text-slate-700">Teléfono: </span>
            <span className="text-slate-900">{lead.nationalPhoneNumber || 'No registrado'}</span>
          </div>
          <div>
            <span className="font-bold text-slate-700">Web Actual: </span>
            <span className="text-slate-900">{lead.websiteUri || 'Ninguna'}</span>
          </div>
        </div>

        {/* Analysis Section */}
        {analysis && (
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-1">
                1. Diagnóstico del Negocio
              </h2>
              <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200">
                {analysis.summary}
              </p>
            </div>

            {/* PageSpeed */}
            {pageSpeed && (
              <div>
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-2">
                  2. Velocidad y Calidad Móvil (Google PageSpeed)
                </h2>
                <div className="grid grid-cols-4 gap-3 text-center">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-xl font-black text-slate-900">{pageSpeed.performance}</div>
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Rendimiento</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-xl font-black text-slate-900">{pageSpeed.seo}</div>
                    <div className="text-[10px] text-slate-500 uppercase font-bold">SEO</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-xl font-black text-slate-900">{pageSpeed.accessibility}</div>
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Accesibilidad</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-xl font-black text-slate-900">{pageSpeed.bestPractices}</div>
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Buenas Prácticas</div>
                  </div>
                </div>
              </div>
            )}

            {/* Checklist */}
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-2">
                3. Checklist de Digitalización
              </h2>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-slate-50 rounded border border-slate-200 flex justify-between">
                  <span>Seguridad HTTPS:</span>
                  <span className="font-bold">{analysis.checklist.https ? '✓ Sí' : '✗ No'}</span>
                </div>
                <div className="p-2 bg-slate-50 rounded border border-slate-200 flex justify-between">
                  <span>Optimizado para Móviles:</span>
                  <span className="font-bold">{analysis.checklist.mobileFriendly ? '✓ Sí' : '✗ No'}</span>
                </div>
                <div className="p-2 bg-slate-50 rounded border border-slate-200 flex justify-between">
                  <span>Botón de WhatsApp directo:</span>
                  <span className="font-bold">{analysis.checklist.whatsappButton ? '✓ Sí' : '✗ No'}</span>
                </div>
                <div className="p-2 bg-slate-50 rounded border border-slate-200 flex justify-between">
                  <span>Citas / Reservas online:</span>
                  <span className="font-bold">{analysis.checklist.onlineBooking ? '✓ Sí' : '✗ No'}</span>
                </div>
              </div>
            </div>

            {/* Problems */}
            {analysis.problems.length > 0 && (
              <div>
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-2">
                  4. Cuellos de Botella Detectados
                </h2>
                <ul className="list-disc pl-5 text-xs text-slate-700 space-y-1">
                  {analysis.problems.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommended Service */}
            {analysis.recommendedService && (
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl">
                <div className="text-[10px] font-black uppercase text-orange-800 tracking-wider">
                  Propuesta DigiMarket RD
                </div>
                <div className="text-sm font-black text-slate-900 mt-0.5">
                  {analysis.recommendedService.service}
                </div>
                <p className="text-xs text-slate-700 mt-1">{analysis.recommendedService.reason}</p>
              </div>
            )}

            {/* Proposal Draft (WhatsApp pitch) */}
            {analysis.drafts?.whatsapp && (
              <div>
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-1">
                  5. Borrador de Primer Contacto Sugerido
                </h2>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 whitespace-pre-wrap">
                  {analysis.drafts.whatsapp}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Notes & Follow Up */}
        {lead.notes && (
          <div className="border-t border-slate-200 pt-4 text-xs">
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-1">
              Notas del Asesor
            </h2>
            <p className="text-slate-700 italic">{lead.notes}</p>
          </div>
        )}

        {/* Footer */}
        <div className="border-t-2 border-slate-900 pt-4 flex justify-between text-[11px] text-slate-500">
          <div>Preparado por: {settings.sellerProfile.name} • {settings.sellerProfile.companyName}</div>
          <div>Contacto: {settings.sellerProfile.phone || settings.sellerProfile.website}</div>
        </div>
      </div>
    </div>
  );
}
