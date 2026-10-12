'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { SearchScreen } from '@/components/SearchScreen';
import { BusinessModal } from '@/components/BusinessModal';
import { NicheRadarScreen } from '@/components/NicheRadarScreen';
import { LeadsCrmScreen } from '@/components/LeadsCrmScreen';
import { SettingsScreen } from '@/components/SettingsScreen';
import { PrintableView } from '@/components/PrintableView';
import { AppSettings, BusinessLead } from '@/types';
import { Storage, DEFAULT_SETTINGS } from '@/utils/storage';
import { Flame, Menu, X, Check } from 'lucide-react';

export default function Home() {
  const [currentTab, setCurrentTab] = useState<string>('search');
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [leads, setLeads] = useState<BusinessLead[]>([]);

  // Modales activos
  const [activeLead, setActiveLead] = useState<BusinessLead | null>(null);
  const [activePrintLead, setActivePrintLead] = useState<BusinessLead | null>(null);

  // Responsive mobile menu
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    // Cargar datos locales al montar
    const loadedSettings = Storage.getSettings();
    const loadedLeads = Storage.getLeads();
    setSettings(loadedSettings);
    setLeads(loadedLeads);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleUpdateLead = (updated: BusinessLead) => {
    const updatedList = Storage.addOrUpdateLead(updated);
    setLeads(updatedList);
    if (activeLead && activeLead.id === updated.id) {
      setActiveLead(updated);
    }
    showToast(`Lead «${updated.displayName}» actualizado`);
  };

  const handleSaveLeadsBatch = (newLeads: BusinessLead[]) => {
    let current = [...leads];
    newLeads.forEach((nl) => {
      current = Storage.addOrUpdateLead(nl);
    });
    setLeads(current);
    showToast(`${newLeads.length} leads guardados en Mis Leads`);
  };

  const handleDeleteLead = (id: string) => {
    const updated = Storage.removeLead(id);
    setLeads(updated);
    if (activeLead && activeLead.id === id) {
      setActiveLead(null);
    }
    showToast('Lead eliminado de Mis Leads');
  };

  const handleSaveSettings = (newSettings: AppSettings) => {
    Storage.saveSettings(newSettings);
    setSettings(newSettings);
    showToast('Ajustes guardados correctamente');
  };

  const handleExploreNiche = (zone: string, nicheCategory: string) => {
    setCurrentTab('search');
    // Si queremos prellenar campos o disparar, el usuario puede buscar directamente
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#070b14] text-slate-100 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-emerald-500 text-black font-bold text-xs rounded-xl shadow-2xl animate-bounce">
          <Check className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Desktop Sidebar */}
      <div className="hidden md:flex h-full">
        <Sidebar
          currentTab={currentTab}
          setCurrentTab={(tab) => {
            setCurrentTab(tab);
            setMobileMenuOpen(false);
          }}
          settings={settings}
          leadsCount={leads.length}
        />
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="w-64 h-full bg-[#0a101f] z-50">
            <Sidebar
              currentTab={currentTab}
              setCurrentTab={(tab) => {
                setCurrentTab(tab);
                setMobileMenuOpen(false);
              }}
              settings={settings}
              leadsCount={leads.length}
            />
          </div>
          <div
            className="flex-1 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 border-b border-slate-800 bg-[#0a101f]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <Flame className="w-4 h-4 text-white" />
            </div>
            <div className="font-black text-lg">
              <span className="text-[#00BFFF]">DIGI</span>
              <span className="text-[#FF8C00]">MARKET</span>
              <span className="text-[#EF4444]">RD</span>
            </div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-400 hover:text-white"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </header>

        {/* Tab Content (Scrollable) */}
        <main className="flex-1 overflow-y-auto">
          {currentTab === 'search' && (
            <SearchScreen
              settings={settings}
              onOpenLead={(lead) => setActiveLead(lead)}
              onSaveLeadsBatch={handleSaveLeadsBatch}
              onUpdateSettings={setSettings}
            />
          )}

          {currentTab === 'niche' && (
            <NicheRadarScreen
              settings={settings}
              onExploreNiche={handleExploreNiche}
              onUpdateSettings={setSettings}
            />
          )}

          {currentTab === 'crm' && (
            <LeadsCrmScreen
              leads={leads}
              onOpenLead={(lead) => setActiveLead(lead)}
              onUpdateLead={handleUpdateLead}
              onDeleteLead={handleDeleteLead}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsScreen settings={settings} onSaveSettings={handleSaveSettings} />
          )}
        </main>
      </div>

      {/* Modal Ficha del Negocio */}
      {activeLead && (
        <BusinessModal
          lead={activeLead}
          settings={settings}
          onClose={() => setActiveLead(null)}
          onUpdateLead={handleUpdateLead}
          onPrintLead={(l) => {
            setActivePrintLead(l);
          }}
        />
      )}

      {/* Modal Vista Imprimible / Exportar PDF */}
      {activePrintLead && (
        <PrintableView
          lead={activePrintLead}
          settings={settings}
          onClose={() => setActivePrintLead(null)}
        />
      )}
    </div>
  );
}
