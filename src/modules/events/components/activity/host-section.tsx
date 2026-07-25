import React from "react";
import { SOCIETIES } from "./constants";
import { HostData } from "./types";
import { X, Plus } from "lucide-react";

interface HostSectionProps {
  data: HostData;
  onChange: (data: HostData) => void;
  onNext: () => void;
}

export function HostSection({ data, onChange, onNext }: HostSectionProps) {
  const handleSocietyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...data, society: e.target.value });
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...data, contactEmail: e.target.value });
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...data, coHostUrl: e.target.value });
  };

  const addCoHost = () => {
    onChange({ ...data, coHosts: [...data.coHosts, ""] });
  };

  const updateCoHost = (index: number, value: string) => {
    const newCoHosts = [...data.coHosts];
    newCoHosts[index] = value;
    onChange({ ...data, coHosts: newCoHosts });
  };

  const removeCoHost = (index: number) => {
    const newCoHosts = data.coHosts.filter((_, i) => i !== index);
    onChange({ ...data, coHosts: newCoHosts });
  };

  const availableSocieties = SOCIETIES.filter(
    (s) => s !== data.society && !data.coHosts.includes(s)
  );

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const canGoNext = data.society && data.contactEmail && isValidEmail(data.contactEmail);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--text-secondary)]">
            Host Society <span className="text-[var(--danger)]">*</span>
          </label>
          <select
            className="input-field"
            value={data.society}
            onChange={handleSocietyChange}
            required
          >
            <option value="">Select your IEEE Society</option>
            {SOCIETIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--text-secondary)]">
            Host Contact Email <span className="text-[var(--danger)]">*</span>
          </label>
          <input
            type="email"
            className="input-field"
            placeholder="Enter your contact email address"
            value={data.contactEmail}
            onChange={handleEmailChange}
            required
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-[var(--text-secondary)]">Co-Hosts</label>
          <button
            type="button"
            onClick={addCoHost}
            className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3"
          >
            <Plus className="w-3.5 h-3.5" /> Add Co-Host
          </button>
        </div>

        {data.coHosts.map((ch, idx) => (
          <div key={idx} className="flex items-center gap-3 animate-in fade-in slide-in-from-top-1">
            <select
              className="input-field flex-1"
              value={ch}
              onChange={(e) => updateCoHost(idx, e.target.value)}
            >
              <option value="">Select co-host society</option>
              {SOCIETIES.filter((s) => s === ch || !data.coHosts.includes(s) && s !== data.society).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => removeCoHost(idx)}
              className="p-2.5 rounded-lg border border-[var(--danger)] text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white transition-all"
              title="Remove"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--text-secondary)]">Co-Host URL (Optional)</label>
        <input
          type="url"
          className="input-field"
          placeholder="Enter co-host event page or website URL (optional)"
          value={data.coHostUrl}
          onChange={handleUrlChange}
        />
      </div>

      <div className="pt-4 flex justify-end">
        <button
          type="button"
          onClick={onNext}
          disabled={!canGoNext}
          className="btn-primary flex items-center gap-2 px-8 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next &rarr;
        </button>
      </div>
    </div>
  );
}
