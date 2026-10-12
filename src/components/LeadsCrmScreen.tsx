'use client';

import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Filter,
  Download,
  Trash2,
  Phone,
  Globe,
  ExternalLink,
  Kanban,
  Table as TableIcon,
  ChevronRight,
  MapPin,
  Star,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { BusinessLead, LeadStatus } from '@/types';

const PIPELINE_STAGES: LeadStatus[] = [
  'Nuevo',
  'Analizado',
  'Contactado',
  'Respondió',
  'Reunión',
  'Cliente',
  'Descartado',
];

interface LeadsCrmScreenProps {
  leads: BusinessLead[];
  onOpenLead: (lead: BusinessLead) => void;
  onUpdateLead: (lead: BusinessLead) => void;
  onDeleteLead: (id: string) => void;
}

export function LeadsCrmScreen({
  leads,
  onOpenLead,
  onUpdateLead,
  onDeleteLead,
}: LeadsCrmScreenProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('todos');
  const [selectedNiche, setSelectedNiche] = useState<string>('todos');
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');

  // Nichos únicos presentes en leads
  const uniqueNiches = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => {
      if (l.primaryTypeDisplayName) set.add(l.primaryTypeDisplayName);
    });
    return Array.from(set);
  }, [leads]);

  // Filtrado reactivo
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (selectedStatus !== 'todos' && lead.status !== selectedStatus) return false;
      if (selectedNiche !== 'todos' && lead.primaryTypeDisplayName !== selectedNiche) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesName = lead.displayName.toLowerCase().includes(q);
        const matchesAddress = lead.formattedAddress.toLowerCase().includes(q);
        const matchesPhone = (lead.nationalPhoneNumber || '').includes(q);
        if (!matchesName && !matchesAddress && !matchesPhone) return false;
      }
      return true;
    });
  }, [leads, selectedStatus, selectedNiche, searchTerm]);

  // Exportar a archivo CSV
  const exportToCSV = () => {
    if (filteredLeads.length === 0) return;

    const headers = [
      'Nombre',
      'Categoría',
      'Dirección',
      'Teléfono',
      'Web',
      'Puntuación Oportunidad',
      'Rating',
      'Reseñas',
      'Estado CRM',
      'Próxima Acción',
      'Notas',
      'Fecha Creación',
    ];

    const rows = filteredLeads.map((l) => [
      `"${l.displayName.replace(/"/g, '""')}"`,
      `"${(l.primaryTypeDisplayName || '').replace(/"/g, '""')}"`,
      `"${l.formattedAddress.replace(/"/g, '""')}"`,
      `"${l.nationalPhoneNumber || ''}"`,
      `"${l.websiteUri || ''}"`,
      l.opportunityScore,
      l.rating || 0,
      l.userRatingCount || 0,
      `"${l.status}"`,
      `"${l.nextActionDate || ''}"`,
      `"${(l.notes || '').replace(/"/g, '""')}"`,
      `"${l.createdAt}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `leads_digimarket_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleMoveStage = (lead: BusinessLead, newStatus: LeadStatus) => {
    onUpdateLead({
      ...lead,
      status: newStatus,
      updatedAt: new Date().toISOString(),
    });
  };

  const getStageHeaderColor = (stage: LeadStatus) => {
    switch (stage) {
      case 'Nuevo':
        return 'border-sky-500/50 text-sky-400 bg-sky-500/10';
      case 'Analizado':
        return 'border-indigo-500/50 text-indigo-400 bg-indigo-500/10';
      case 'Contactado':
        return 'border-amber-500/50 text-amber-400 bg-amber-500/10';
      case 'Respondió':
        return 'border-orange-500/50 text-orange-400 bg-orange-500/10';
      case 'Reunión':
        return 'border-purple-500/50 text-purple-400 bg-purple-500/10';
      case 'Cliente':
        return 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10';
      case 'Descartado':
        return 'border-rose-500/50 text-rose-400 bg-rose-500/10';
      default:
        return 'border-slate-700 text-slate-300 bg-slate-800';
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <span>Mis Leads</span>
            <span className="text-xs px-2.5 py-1 bg-orange-500 text-black font-extrabold rounded-lg">
              {leads.length} Guardados
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Gestiona tu embudo de ventas, notas, llamadas y conversiones comerciales.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportToCSV}
            disabled={filteredLeads.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-orange-500 text-white font-bold text-xs transition disabled:opacity-40"
          >
            <Download className="w-4 h-4 text-orange-400" />
            <span>Exportar CSV</span>
          </button>

          {/* Toggle View Mode */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-2 rounded-lg ${
                viewMode === 'kanban' ? 'bg-orange-500 text-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Kanban className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-lg ${
                viewMode === 'table' ? 'bg-orange-500 text-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              <TableIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre, dirección o teléfono..."
              className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-orange-500"
            />
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-semibold">Estado:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none"
            >
              <option value="todos">Todos los estados</option>
              {PIPELINE_STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {uniqueNiches.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 font-semibold">Nicho:</span>
              <select
                value={selectedNiche}
                onChange={(e) => setSelectedNiche(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none"
              >
                <option value="todos">Todos los nichos</option>
                {uniqueNiches.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Kanban Board View */}
      {viewMode === 'kanban' ? (
        <div className="overflow-x-auto pb-6">
          <div className="flex gap-4 min-w-[1200px]">
            {PIPELINE_STAGES.map((stage) => {
              const stageLeads = filteredLeads.filter((l) => l.status === stage);
              return (
                <div
                  key={stage}
                  className="flex-1 bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col max-h-[75vh]"
                >
                  {/* Column Header */}
                  <div
                    className={`flex items-center justify-between p-2.5 rounded-xl border mb-3 font-bold text-xs ${getStageHeaderColor(
                      stage
                    )}`}
                  >
                    <span>{stage}</span>
                    <span className="w-5 h-5 rounded-full bg-black/40 flex items-center justify-center text-[10px]">
                      {stageLeads.length}
                    </span>
                  </div>

                  {/* Cards List */}
                  <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                    {stageLeads.map((lead) => (
                      <div
                        key={lead.id}
                        className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-orange-500/40 transition-all shadow space-y-2.5 cursor-pointer"
                        onClick={() => onOpenLead(lead)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs font-bold text-white line-clamp-1">
                            {lead.displayName}
                          </h4>
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 shrink-0">
                            {lead.opportunityScore} pts
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-400 line-clamp-1">
                          {lead.formattedAddress}
                        </div>

                        {lead.nationalPhoneNumber && (
                          <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                            <Phone className="w-3 h-3" />
                            <span>{lead.nationalPhoneNumber}</span>
                          </div>
                        )}

                        {lead.nextActionDate && (
                          <div className="flex items-center gap-1 text-[10px] text-amber-400 font-medium">
                            <Calendar className="w-3 h-3" />
                            <span>Acción: {lead.nextActionDate}</span>
                          </div>
                        )}

                        {/* Stage Mover Selector */}
                        <div
                          className="pt-2 border-t border-slate-800/60 flex items-center justify-between"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <select
                            value={lead.status}
                            onChange={(e) => handleMoveStage(lead, e.target.value as LeadStatus)}
                            className="bg-slate-900 border border-slate-800 rounded-lg text-[10px] text-slate-300 px-2 py-1 focus:outline-none"
                          >
                            {PIPELINE_STAGES.map((s) => (
                              <option key={s} value={s}>
                                Mover a: {s}
                              </option>
                            ))}
                          </select>

                          <button
                            onClick={() => onDeleteLead(lead.id)}
                            className="p-1 text-slate-500 hover:text-rose-400 transition"
                            title="Eliminar de mis leads"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {stageLeads.length === 0 && (
                      <div className="text-center py-8 text-[11px] text-slate-600 italic">
                        Sin leads aquí
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Table View */
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
                <tr>
                  <th className="p-4">Negocio</th>
                  <th className="p-4">Nicho</th>
                  <th className="p-4">Teléfono</th>
                  <th className="p-4">Web</th>
                  <th className="p-4">Oportunidad</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4">Próxima Acción</th>
                  <th className="p-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-4 font-bold text-white">{lead.displayName}</td>
                    <td className="p-4 text-orange-400">{lead.primaryTypeDisplayName || 'Local'}</td>
                    <td className="p-4 text-emerald-400 font-semibold">
                      {lead.nationalPhoneNumber || '—'}
                    </td>
                    <td className="p-4">
                      {lead.websiteUri ? (
                        <a
                          href={lead.websiteUri}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan-400 hover:underline max-w-[140px] truncate block"
                        >
                          {lead.websiteUri.replace(/^https?:\/\//, '')}
                        </a>
                      ) : (
                        <span className="text-rose-400">Sin web</span>
                      )}
                    </td>
                    <td className="p-4 font-black">{lead.opportunityScore} / 100</td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-800 text-white">
                        {lead.status}
                      </span>
                    </td>
                    <td className="p-4 text-amber-400">{lead.nextActionDate || '—'}</td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onOpenLead(lead)}
                          className="px-3 py-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-black font-extrabold text-xs transition"
                        >
                          Ficha
                        </button>
                        <button
                          onClick={() => onDeleteLead(lead.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {leads.length === 0 && (
        <div className="text-center py-20 p-8 rounded-2xl bg-slate-900/40 border border-slate-800/60 max-w-md mx-auto">
          <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white mb-1">Aún no has guardado leads</h3>
          <p className="text-xs text-slate-400">
            Realiza búsquedas en el Radar de Clientes y haz clic en «Guardar en Mis Leads» para organizar tu prospección aquí.
          </p>
        </div>
      )}
    </div>
  );
}
