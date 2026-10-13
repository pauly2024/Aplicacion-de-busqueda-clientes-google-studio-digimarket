'use client';

import React, { useState } from 'react';
import {
  Settings,
  Key,
  User,
  Shield,
  Save,
  Trash2,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  FileText,
  Copy,
  Plus,
  Trash,
  Film,
  Presentation,
} from 'lucide-react';
import { AppSettings, PresentationPrompt } from '@/types';
import { Storage } from '@/utils/storage';

const PH_PLACEHOLDER = 'Escribe el prompt aqui... Variables: {{displayName}}, {{primaryTypeDisplayName}}, {{formattedAddress}}, {{nationalPhoneNumber}}, {{rating}}, {{userRatingCount}}, {{hasOwnWebsite}}, {{websiteUri}}, {{sellerProfile.name}}, {{sellerProfile.companyName}}, {{sellerProfile.phone}}, {{sellerProfile.website}}, {{sellerProfile.valueProposition}}, {{sellerProfile.servicesOffered}}, {{sellerProfile.tone}}';

interface SettingsScreenProps {
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
}

export function SettingsScreen({ settings, onSaveSettings }: SettingsScreenProps) {
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [cacheCleared, setCacheCleared] = useState(false);
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<Partial<PresentationPrompt>>({});
  const [showPromptModal, setShowPromptModal] = useState(false);

  const handleAddPrompt = () => {
    setEditingPrompt({
      name: '',
      description: '',
      template: '',
      type: 'video',
    });
    setEditingPromptId(null);
    setShowPromptModal(true);
  };

  const handleEditPrompt = (prompt: PresentationPrompt) => {
    setEditingPrompt({
      name: prompt.name,
      description: prompt.description,
      template: prompt.template,
      type: prompt.type,
    });
    setEditingPromptId(prompt.id);
    setShowPromptModal(true);
  };

  const handleDeletePrompt = (id: string) => {
    if (!confirm('¿Eliminar este prompt?')) return;
    const updatedPrompts = formData.presentationPrompts.filter((p) => p.id !== id);
    setFormData({ ...formData, presentationPrompts: updatedPrompts });
  };

  const handleSavePrompt = () => {
    if (!editingPrompt.name || !editingPrompt.template) {
      alert('Nombre y template son requeridos');
      return;
    }
    const now = new Date().toISOString();
    let updatedPrompts: PresentationPrompt[];
    if (editingPromptId) {
      updatedPrompts = formData.presentationPrompts.map((p) =>
        p.id === editingPromptId
          ? { ...p, ...editingPrompt, updatedAt: now } as PresentationPrompt
          : p
      );
    } else {
      const newPrompt: PresentationPrompt = {
        id: `prompt-${Date.now()}`,
        ...editingPrompt,
        createdAt: now,
        updatedAt: now,
      } as PresentationPrompt;
      updatedPrompts = [...formData.presentationPrompts, newPrompt];
    }
    setFormData({ ...formData, presentationPrompts: updatedPrompts });
    setShowPromptModal(false);
    setEditingPromptId(null);
    setEditingPrompt({});
  };

  const handlePromptChange = (field: keyof PresentationPrompt, value: string) => {
    setEditingPrompt({ ...editingPrompt, [field]: value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleResetCalls = () => {
    const updated = { ...formData, placesCallsThisMonth: 0 };
    setFormData(updated);
    onSaveSettings(updated);
  };

  const handleClearCache = () => {
    Storage.clearAllCache();
    setCacheCleared(true);
    setTimeout(() => setCacheCleared(false), 3000);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
          <span>Ajustes y Configuración</span>
          <span className="text-xs px-2.5 py-1 bg-slate-800 text-slate-300 font-bold rounded-lg">
            Sistema DigiMarket
          </span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Configura tus claves de Google Cloud, tu perfil comercial de ventas y el control de llamadas mensuales.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Card: Claves de API */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
            <Key className="w-5 h-5 text-orange-400" />
            <h2 className="text-base font-bold text-white">Claves de API (Google Cloud, NVIDIA NIM, OpenRouter)</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 text-xs">
            <div>
              <label className="block text-slate-300 font-bold mb-1">
                Google Cloud API Key (Places API New & PageSpeed Insights)
              </label>
              <input
                type="password"
                value={formData.googleMapsApiKey}
                onChange={(e) => setFormData({ ...formData, googleMapsApiKey: e.target.value })}
                placeholder="AIzaSy... (Dejar vacío para usar la clave de entorno por defecto)"
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-orange-500"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Se usa para Places API (buscar negocios) y PageSpeed Insights (auditar webs). Se almacena solo en este navegador.
              </span>
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">
                NVIDIA NIM API Key (analyze-web: Llama 3.1 8B)
              </label>
              <input
                type="password"
                value={formData.nvidiaApiKey || ''}
                onChange={(e) => setFormData({ ...formData, nvidiaApiKey: e.target.value })}
                placeholder="nvapi-... (Dejar vacío para usar la clave de entorno NVIDIA_API_KEY)"
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-orange-500"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Se usa para analizar la web del negocio y generar el diagnóstico + borradores con IA.
              </span>
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">
                OpenRouter API Key (radar-niche: Nemotron 3 Ultra gratis)
              </label>
              <input
                type="password"
                value={formData.openRouterApiKey || ''}
                onChange={(e) => setFormData({ ...formData, openRouterApiKey: e.target.value })}
                placeholder="sk-or-v1-... (Dejar vacío para usar la clave de entorno OPENROUTER_API_KEY)"
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-orange-500"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Se usa para el ranking estratégico de nichos en el Radar de Nichos.
              </span>
            </div>
          </div>
        </div>

        {/* Card: Perfil del Vendedor (DigiMarket RD) */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
            <User className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-white">Perfil del Vendedor / Agencia</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-300 font-bold mb-1">Tu Nombre o Asesor</label>
              <input
                type="text"
                value={formData.sellerProfile.name}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    sellerProfile: { ...formData.sellerProfile, name: e.target.value },
                  })
                }
                placeholder="Ej: Paul"
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">Nombre de la Agencia</label>
              <input
                type="text"
                value={formData.sellerProfile.companyName}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    sellerProfile: { ...formData.sellerProfile, companyName: e.target.value },
                  })
                }
                placeholder="Ej: DigiMarket RD"
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">Teléfono / WhatsApp de contacto</label>
              <input
                type="text"
                value={formData.sellerProfile.phone}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    sellerProfile: { ...formData.sellerProfile, phone: e.target.value },
                  })
                }
                placeholder="Ej: +1 809 000 0000"
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">Tono Predeterminado de Mensajes</label>
              <select
                value={formData.sellerProfile.tone}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    sellerProfile: { ...formData.sellerProfile, tone: e.target.value as any },
                  })
                }
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold focus:outline-none focus:border-orange-500"
              >
                <option value="consultivo">Consultivo (Profesional y estratégico)</option>
                <option value="directo">Directo (Al grano y comercial)</option>
                <option value="cercano">Cercano (Cálido y empático)</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-300 font-bold mb-1">
                Propuesta de Valor Principal
              </label>
              <textarea
                rows={2}
                value={formData.sellerProfile.valueProposition}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    sellerProfile: { ...formData.sellerProfile, valueProposition: e.target.value },
                  })
                }
                placeholder="Qué problema resuelves y cómo aumentas las ventas de los clientes..."
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white resize-none focus:outline-none focus:border-orange-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-300 font-bold mb-1">
                Servicios que Ofreces (nombre y precio RD$)
              </label>
              <div className="space-y-2">
                {formData.sellerProfile.servicesOffered.map((service, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={service.name}
                      onChange={(e) => {
                        const updated = [...formData.sellerProfile.servicesOffered];
                        updated[index] = { ...updated[index], name: e.target.value };
                        setFormData({
                          ...formData,
                          sellerProfile: { ...formData.sellerProfile, servicesOffered: updated },
                        });
                      }}
                      placeholder="Nombre del servicio"
                      className="flex-1 p-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-orange-500"
                    />
                    <input
                      type="number"
                      value={service.price}
                      onChange={(e) => {
                        const updated = [...formData.sellerProfile.servicesOffered];
                        updated[index] = { ...updated[index], price: parseInt(e.target.value, 10) || 0 };
                        setFormData({
                          ...formData,
                          sellerProfile: { ...formData.sellerProfile, servicesOffered: updated },
                        });
                      }}
                      placeholder="Precio RD$"
                      className="w-32 p-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-orange-500 text-right"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const updated = formData.sellerProfile.servicesOffered.filter((_, i) => i !== index);
                        setFormData({
                          ...formData,
                          sellerProfile: { ...formData.sellerProfile, servicesOffered: updated },
                        });
                      }}
                      className="p-3 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 rounded-xl transition"
                      title="Eliminar servicio"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setFormData({
                      ...formData,
                      sellerProfile: {
                        ...formData.sellerProfile,
                        servicesOffered: [...formData.sellerProfile.servicesOffered, { name: '', price: 0 }],
                      },
                    });
                  }}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Añadir Servicio</span>
                </button>
                <span className="text-[10px] text-slate-500 mt-1 block">Formato: Nombre del servicio + Precio en RD$</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card: Control de Cuota Google Places */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
            <Shield className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white">Contador y Límite de Google Places</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-300 font-bold mb-1">
                Llamadas Realizadas Este Mes
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={formData.placesCallsThisMonth}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      placesCallsThisMonth: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white font-black text-sm"
                />
                <button
                  type="button"
                  onClick={handleResetCalls}
                  className="px-3 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition flex items-center gap-1 shrink-0"
                  title="Reiniciar contador a 0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">
                Límite de Alerta Mensual (de las 1.000 gratuitas)
              </label>
              <input
                type="number"
                value={formData.placesQuotaLimit}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    placesQuotaLimit: parseInt(e.target.value, 10) || 800,
                  })
                }
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white font-black text-sm"
              />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 text-[11px] text-slate-400 border border-slate-800/80">
            Google Maps otorga un crédito mensual en su capa gratuita. Esta alerta te notificará al alcanzar {formData.placesQuotaLimit} llamadas para evitar cargos no deseados.
          </div>
        </div>

        {/* Card: Caché de Búsqueda */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Memoria Caché de Búsquedas</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Libera los resultados cacheados en el navegador para refrescar las búsquedas repetidas.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClearCache}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{cacheCleared ? 'Caché Vaciada' : 'Limpiar Caché'}</span>
          </button>
        </div>

        {/* Card: Prompts de Presentación */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
            <FileText className="w-5 h-5 text-purple-400" />
            <h2 className="text-base font-bold text-white">Prompts de Presentación (Video / PPT)</h2>
          </div>

          <p className="text-xs text-slate-400">
            Templates para generar videos (HyperFrames) o presentaciones (PPT/Reveal.js) en Colab/Jupyter con datos del negocio.
          </p>

          <div className="space-y-3">
            {formData.presentationPrompts.map((prompt) => (
              <div key={prompt.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      prompt.type === 'video' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {prompt.type === 'video' ? '🎬 Video' : '📊 PPT'}
                    </span>
                    <span className="font-bold text-white text-sm truncate">{prompt.name}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate">{prompt.description}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleEditPrompt(prompt)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Editar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeletePrompt(prompt.id)}
                    className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 text-xs font-bold transition flex items-center gap-1"
                  >
                    <Trash className="w-3.5 h-3.5" />
                    <span>Eliminar</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleAddPrompt}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-purple-500 hover:bg-purple-600 text-black font-extrabold text-xs transition flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Prompt</span>
          </button>
        </div>

        {/* Modal Nuevo/Editar Prompt */}
        {showPromptModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[#0f172a] border border-slate-700 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white text-lg">
                  {editingPromptId ? 'Editar Prompt' : 'Nuevo Prompt'}
                </h3>
                <button
                  type="button"
                  onClick={() => { setShowPromptModal(false); setEditingPromptId(null); setEditingPrompt({}); }}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Nombre</label>
                  <input
                    type="text"
                    value={editingPrompt.name || ''}
                    onChange={(e) => handlePromptChange('name', e.target.value)}
                    placeholder="Ej: Video Reels Negocio Local"
                    className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Descripción</label>
                  <input
                    type="text"
                    value={editingPrompt.description || ''}
                    onChange={(e) => handlePromptChange('description', e.target.value)}
                    placeholder="Ej: Genera video 30s para Reels con datos del negocio"
                    className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Tipo</label>
                  <select
                    value={editingPrompt.type || 'video'}
                    onChange={(e) => handlePromptChange('type', e.target.value)}
                    className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold focus:outline-none focus:border-purple-500"
                  >
                    <option value="video">🎬 Video (HyperFrames)</option>
                    <option value="ppt">📊 Presentación (PPT/Reveal.js)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Template (usa variables: displayName, rating, sellerProfile.name, etc.)</label>
                  <textarea
                    rows={12}
                    value={editingPrompt.template || ''}
                    onChange={(e) => handlePromptChange('template', e.target.value)}
                    placeholder={PH_PLACEHOLDER}
                    className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-[11px] resize-none focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => { setShowPromptModal(false); setEditingPromptId(null); setEditingPrompt({}); }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSavePrompt}
                  className="px-4 py-2 rounded-xl bg-purple-500 hover:bg-purple-600 text-black text-xs font-extrabold transition shadow"
                >
                  Guardar Prompt
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex items-center justify-between pt-2">
          {savedSuccess && (
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
              <CheckCircle className="w-4 h-4" />
              <span>Ajustes guardados correctamente</span>
            </div>
          )}

          <div className="ml-auto">
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-black font-extrabold text-sm shadow-lg shadow-orange-500/20 transition-all"
            >
              <Save className="w-4 h-4" />
              <span>Guardar Ajustes</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
