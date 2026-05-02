import React from "react";
import { TrendingUp, Users, Award, BarChart3 } from "lucide-react";

interface TrendingPanelProps {
  stats: {
    totalMembers: number;
    postsThisMonth: number;
    activeSocieties: number;
  };
  societyStats: Array<{ name: string; count: number; color: string }>;
  trendingTags: Array<{ tag: string; count: string }>;
}

export function TrendingPanel({ stats, societyStats, trendingTags }: TrendingPanelProps) {
  return (
    <div className="space-y-6 sticky top-24">
      {/* Trending Tags */}
      <div className="glass-card border border-white/5 overflow-hidden">
        <div className="p-4 border-b border-white/5 bg-white/5 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-400" />
          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Trending Topics</h4>
        </div>
        <div className="p-4 space-y-4">
          {trendingTags.length === 0 ? (
            <p className="text-[10px] text-gray-600 font-medium italic">No trending topics yet</p>
          ) : (
            trendingTags.map((item) => (
              <div key={item.tag} className="group cursor-pointer">
                <p className="text-sm font-bold text-gray-300 group-hover:text-blue-400 transition-colors">#{item.tag}</p>
                <p className="text-[10px] text-gray-600 font-medium">{item.count}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Active Societies */}
      <div className="glass-card border border-white/5 overflow-hidden">
        <div className="p-4 border-b border-white/5 bg-white/5 flex items-center gap-2">
          <Award className="w-4 h-4 text-orange-400" />
          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Active Societies</h4>
        </div>
        <div className="p-4 space-y-4">
          {societyStats.length === 0 ? (
            <p className="text-[10px] text-gray-600 font-medium italic">No activity data yet</p>
          ) : (
            societyStats.map((s) => (
              <div key={s.name} className="flex items-center justify-between group cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${s.color}`} />
                  <span className="text-sm text-gray-400 group-hover:text-white transition-colors">{s.name}</span>
                </div>
                <span className="px-2 py-0.5 bg-white/5 rounded text-[10px] font-bold text-gray-500">{s.count}</span>
              </div>
            ))
          )}
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
              <p className="text-lg font-bold text-white">{stats.totalMembers}</p>
              <p className="text-[10px] text-gray-500 font-bold uppercase">Members Joined</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <BarChart3 className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-white">{stats.postsThisMonth}</p>
              <p className="text-[10px] text-gray-500 font-bold uppercase">Posts This Month</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <Award className="w-4 h-4 text-orange-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-white">{stats.activeSocieties}</p>
              <p className="text-[10px] text-gray-500 font-bold uppercase">Active Societies</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
