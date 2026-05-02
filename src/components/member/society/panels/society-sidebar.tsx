import React from "react";
import { SOCIETIES, CATEGORIES } from "../constants";
import { ShieldCheck, UserCircle, LayoutGrid } from "lucide-react";

interface SocietySidebarProps {
  profile: any;
  selectedSocieties: string[];
  onSocietyChange: (id: string) => void;
  selectedCategory: string;
  onCategoryChange: (id: string) => void;
}

export function SocietySidebar({ 
  profile, 
  selectedSocieties, 
  onSocietyChange, 
  selectedCategory, 
  onCategoryChange 
}: SocietySidebarProps) {
  return (
    <div className="space-y-6">
      {/* User Identity Card */}
      <div className="glass-card p-6 border border-white/5 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
          <ShieldCheck className="w-12 h-12 text-blue-400" />
        </div>
        <div className="flex flex-col items-center text-center relative z-10">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#00629B] to-[#00bfff] p-1 mb-4 shadow-xl shadow-blue-500/20">
            <div className="w-full h-full rounded-full bg-[#0a192f] flex items-center justify-center text-2xl font-bold text-white border-4 border-white/5">
              {profile?.name?.[0] || "U"}
            </div>
          </div>
          <h3 className="text-xl font-bold text-white tracking-tight leading-tight">{profile?.name}</h3>
          <p className="text-xs text-gray-500 font-medium mt-1 capitalize">
            {profile?.role?.replace("_", " ") || "IEEE Member"}
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            <span className="px-3 py-1 bg-blue-500/10 text-blue-400 text-[9px] font-bold rounded-full border border-blue-500/20 uppercase tracking-wider">
              IEEE Member
            </span>
            {profile?.society_id && (
              <span className="px-3 py-1 bg-purple-500/10 text-purple-400 text-[9px] font-bold rounded-full border border-purple-500/20 uppercase tracking-wider">
                Officer
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Society List Filters */}
      <div className="glass-card border border-white/5 overflow-hidden">
        <div className="p-4 border-b border-white/5 bg-white/5 flex items-center gap-2">
          <LayoutGrid className="w-4 h-4 text-gray-400" />
          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Technical Societies</h4>
        </div>
        <div className="p-4 flex flex-wrap gap-2">
          <button
            onClick={() => onSocietyChange("all")}
            className={`px-3 py-2 rounded-xl text-[11px] font-bold transition-all border ${
              selectedSocieties.includes("all")
              ? "bg-[#00629B] border-[#00629B] text-white shadow-lg shadow-blue-500/20"
              : "bg-white/5 border-white/5 text-gray-400 hover:border-white/10"
            }`}
          >
            All Societies
          </button>
          {SOCIETIES.map((s) => (
            <button
              key={s.id}
              onClick={() => onSocietyChange(s.id)}
              className={`px-3 py-2 rounded-xl text-[11px] font-bold transition-all border ${
                selectedSocieties.includes(s.id)
                ? "bg-[#00629B] border-[#00629B] text-white"
                : "bg-white/5 border-white/5 text-gray-400 hover:border-white/10"
              }`}
            >
              {s.abbreviation}
            </button>
          ))}
        </div>
      </div>

      {/* Category Filter */}
      <div className="glass-card p-4 border border-white/5 space-y-4">
        <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Feed Type</h4>
        <div className="space-y-1">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => onCategoryChange(c.id)}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm transition-all ${
                selectedCategory === c.id
                ? "bg-white/5 text-blue-400 font-bold"
                : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.02]"
              }`}
            >
              {c.name}
              {selectedCategory === c.id && <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
