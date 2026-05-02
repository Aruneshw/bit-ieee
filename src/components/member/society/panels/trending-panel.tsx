import React from "react";
import { TrendingUp, Users, Award, BarChart3, ChevronRight } from "lucide-react";

const TRENDING_TAGS = [
  { tag: "IEEEXtreme", count: "1.2k posts" },
  { tag: "MachineLearning", count: "850 posts" },
  { tag: "Robotics", count: "420 posts" },
  { tag: "WIE", count: "310 posts" },
  { tag: "EnergyFuture", count: "150 posts" }
];

const ACTIVE_SOCIETIES = [
  { name: "Computer Society", count: 12, color: "bg-blue-500" },
  { name: "WIE", count: 11, color: "bg-purple-500" },
  { name: "Robotics", count: 10, color: "bg-orange-500" }
];

export function TrendingPanel() {
  return (
    <div className="space-y-6 sticky top-24">
      {/* Trending Tags */}
      <div className="glass-card border border-white/5 overflow-hidden">
        <div className="p-4 border-b border-white/5 bg-white/5 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-400" />
          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Trending Topics</h4>
        </div>
        <div className="p-4 space-y-4">
          {TRENDING_TAGS.map((item) => (
            <div key={item.tag} className="group cursor-pointer">
              <p className="text-sm font-bold text-gray-300 group-hover:text-blue-400 transition-colors">#{item.tag}</p>
              <p className="text-[10px] text-gray-600 font-medium">{item.count}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Active Societies */}
      <div className="glass-card border border-white/5 overflow-hidden">
        <div className="p-4 border-b border-white/5 bg-white/5 flex items-center gap-2">
          <Award className="w-4 h-4 text-orange-400" />
          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Active Societies</h4>
        </div>
        <div className="p-4 space-y-4">
          {ACTIVE_SOCIETIES.map((s) => (
            <div key={s.name} className="flex items-center justify-between group cursor-pointer">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${s.color}`} />
                <span className="text-sm text-gray-400 group-hover:text-white transition-colors">{s.name}</span>
              </div>
              <span className="px-2 py-0.5 bg-white/5 rounded text-[10px] font-bold text-gray-500">{s.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Community Stats */}
      <div className="glass-card p-6 border border-white/5 bg-gradient-to-br from-[#00629B]/10 to-transparent relative overflow-hidden">
        <div className="absolute -bottom-6 -right-6 opacity-10">
          <BarChart3 className="w-24 h-24 text-blue-400" />
        </div>
        <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-6">Community Pulse</h4>
        <div className="space-y-5 relative z-10">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Users className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-white">342</p>
              <p className="text-[10px] text-gray-500 font-bold uppercase">Members Joined</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <BarChart3 className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-white">56</p>
              <p className="text-[10px] text-gray-500 font-bold uppercase">Posts This Month</p>
            </div>
          </div>
        </div>
      </div>

      {/* IEEE Ad / Promo */}
      <div className="p-4 rounded-2xl bg-[#00629B] shadow-xl shadow-blue-500/20 text-white flex items-center justify-between group cursor-pointer">
        <div>
          <p className="text-[10px] font-bold opacity-70 uppercase">IEEE Xtreme 18.0</p>
          <p className="text-sm font-bold">Register Now</p>
        </div>
        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-1 transition-transform">
          <ChevronRight className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
