'use client';

import React from 'react';
import Image from 'next/image';
import {
  Search,
  Compass,
  Users,
  Settings,
  Sparkles,
  AlertTriangle,
  MapPin,
} from 'lucide-react';
import { AppSettings } from '@/types';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  settings: AppSettings;
  leadsCount: number;
}

export function Sidebar({ currentTab, setCurrentTab, settings, leadsCount }: SidebarProps) {
  const usage = settings.placesCallsThisMonth || 0;
  const limit = settings.placesQuotaLimit || 800;
  const percent = Math.min(100, Math.round((usage / limit) * 100));
  const isNearLimit = usage >= limit;

  const navItems = [
    { id: 'search', label: 'Buscador de Leads', icon: Search, badge: null },
    { id: 'niche', label: 'Radar de Nichos', icon: Compass, badge: 'IA' },
    { id: 'crm', label: 'Mis Leads', icon: Users, badge: leadsCount > 0 ? leadsCount : null },
    { id: 'settings', label: 'Ajustes', icon: Settings, badge: null },
  ];

  return (
    <aside className="digi-sidebar w-64 flex flex-col justify-between shrink-0 select-none">
      <div>
        {/* Logo Header — mismo estilo que admin */}
        <div className="digi-sidebar-header p-5 border-b border-white/5">
          <div className="flex flex-col items-center gap-3">
            <Image
              src="/logo.png"
              alt="DigiMarket RD"
              width={160}
              height={80}
              className="object-contain drop-shadow-lg"
              priority
            />
            {/* Zona objetivo */}
            <div className="flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/20 rounded-full px-3 py-1">
              <MapPin className="w-3 h-3 text-orange-400 shrink-0" />
              <span className="text-[11px] font-bold text-orange-300 tracking-wide">
                Puerto Plata · Santiago
              </span>
            </div>
          </div>

          {/* App name badge */}
          <div className="mt-3 text-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              ⚡ Radar de Clientes
            </span>
            <span className="ml-1.5 text-[9px] bg-[#FF8C00] text-black rounded-full px-1.5 py-0.5 font-bold">
              v2.0
            </span>
          </div>
        </div>

        {/* Navigation — igual al .nav-item del admin */}
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={`digi-nav-item w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-semibold transition-all ${
                  active
                    ? 'digi-nav-active'
                    : 'text-slate-400 hover:text-black hover:bg-[#FF8C00]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${active ? 'text-black' : ''}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== null && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                      active
                        ? 'bg-black/20 text-black'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Quota & Footer — mismo glass del admin */}
      <div className="p-4 m-3 rounded-2xl digi-glass border border-white/5">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-slate-400 font-medium">Llamadas Places</span>
          <span className={`font-bold ${isNearLimit ? 'text-rose-400' : 'text-[#FF8C00]'}`}>
            {usage} / {limit}
          </span>
        </div>
        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              isNearLimit ? 'bg-rose-500' : percent > 70 ? 'bg-amber-500' : 'bg-[#FF8C00]'
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
        {isNearLimit && (
          <div className="flex items-center gap-1.5 text-[11px] text-rose-400 mt-2 font-medium">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>Límite mensual alcanzado</span>
          </div>
        )}
        <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
          <span className="font-semibold text-slate-400">DigiMarket RD</span>
          <Sparkles className="w-3.5 h-3.5 text-[#FF8C00]" />
        </div>
      </div>
    </aside>
  );
}
